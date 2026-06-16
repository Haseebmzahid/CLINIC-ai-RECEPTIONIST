import { createHash } from "node:crypto";

import type { SettingsProfile } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";

import type {
  AppointmentRepository,
  ResourceRepository,
  ServiceRepository,
  SettingsRepository,
} from "../repositories";
import { AppError } from "../utils";
import {
  addLocalDays,
  getLocalDateString,
  getLocalDayOfWeek,
  parseRangeBoundary,
  zonedTimeToUtc,
} from "../utils/time";

export interface AvailabilitySlot {
  slotId: string;
  serviceId: string;
  resourceId: string;
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityRequest {
  serviceId: string;
  from: string;
  to: string;
  resourceId?: string;
}

export type Clock = () => Date;

const BOOKING_BLOCKING_STATUSES = ["pending", "confirmed"] as const;

function makeSlotId(tenantId: string, resourceId: string, startIso: string): string {
  return createHash("sha256")
    .update(`${tenantId}:${resourceId}:${startIso}`)
    .digest("hex")
    .slice(0, 24);
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

function resolveRange(
  request: AvailabilityRequest,
  profile: SettingsProfile,
): { from: Date; to: Date } {
  const from = parseRangeBoundary(request.from, profile.timezone);
  const to = parseRangeBoundary(request.to, profile.timezone);

  if (to.getTime() <= from.getTime()) {
    throw new AppError("VALIDATION_ERROR", 400, "`to` must be after `from`.");
  }

  return { from, to };
}

export class AvailabilityService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly services: ServiceRepository,
    private readonly resources: ResourceRepository,
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async getAvailability(
    tenantId: string,
    request: AvailabilityRequest,
  ): Promise<AvailabilitySlot[]> {
    const [profileDocument, serviceDocument, activeResources] = await Promise.all([
      this.settings.getProfile(tenantId),
      this.services.getById(tenantId, request.serviceId),
      this.resources.listActive(tenantId),
    ]);

    if (!profileDocument) {
      throw new AppError("NOT_FOUND", 404, "Settings profile was not found.");
    }

    if (!serviceDocument || !serviceDocument.data.active) {
      throw new AppError("NOT_FOUND", 404, "Service was not found.");
    }

    const resourceId = request.resourceId ?? activeResources[0]?.id;

    if (!resourceId || !activeResources.some((resource) => resource.id === resourceId)) {
      throw new AppError("NOT_FOUND", 404, "Resource was not found.");
    }

    const profile = profileDocument.data;
    const range = resolveRange(request, profile);
    const blockingAppointments = await this.appointments.findOverlappingCandidates(
      tenantId,
      resourceId,
      [...BOOKING_BLOCKING_STATUSES],
      {
        startsAt: Timestamp.fromDate(range.from),
        endsAt: Timestamp.fromDate(range.to),
      },
    );
    const minimumStartMs = this.clock().getTime() + profile.minLeadTimeMinutes * 60_000;
    const slots: AvailabilitySlot[] = [];
    let currentLocalDate = getLocalDateString(range.from, profile.timezone);
    const finalLocalDate = getLocalDateString(new Date(range.to.getTime() - 1), profile.timezone);

    while (currentLocalDate <= finalLocalDate) {
      if (!profile.holidays.includes(currentLocalDate)) {
        const dayOfWeek = getLocalDayOfWeek(currentLocalDate, profile.timezone).toString();
        const ranges = profile.workingHours[dayOfWeek] ?? [];

        for (const workingRange of ranges) {
          let candidateStart = zonedTimeToUtc(
            currentLocalDate,
            `${workingRange.open}:00`,
            profile.timezone,
          );
          const workingClose = zonedTimeToUtc(
            currentLocalDate,
            `${workingRange.close}:00`,
            profile.timezone,
          );

          while (candidateStart.getTime() < workingClose.getTime()) {
            const candidateEnd = new Date(
              candidateStart.getTime() +
                (serviceDocument.data.durationMinutes + profile.bufferMinutes) * 60_000,
            );
            const candidateStartMs = candidateStart.getTime();
            const candidateEndMs = candidateEnd.getTime();
            const isWithinRange =
              candidateStartMs >= range.from.getTime() && candidateStartMs < range.to.getTime();
            const fitsWorkingHours = candidateEndMs <= workingClose.getTime();
            const satisfiesLeadTime = candidateStartMs >= minimumStartMs;
            const hasOverlap = blockingAppointments.some((appointment) =>
              overlaps(
                candidateStartMs,
                candidateEndMs,
                appointment.data.startsAt.toMillis(),
                appointment.data.endsAt.toMillis(),
              ),
            );

            if (isWithinRange && fitsWorkingHours && satisfiesLeadTime && !hasOverlap) {
              const startsAt = candidateStart.toISOString();

              slots.push({
                slotId: makeSlotId(tenantId, resourceId, startsAt),
                serviceId: request.serviceId,
                resourceId,
                startsAt,
                endsAt: candidateEnd.toISOString(),
              });
            }

            candidateStart = new Date(
              candidateStart.getTime() + profile.slotLengthMinutes * 60_000,
            );
          }
        }
      }

      currentLocalDate = addLocalDays(currentLocalDate, 1);
    }

    return slots;
  }
}
