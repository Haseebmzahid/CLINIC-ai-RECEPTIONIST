import type {
  Appointment,
  AppointmentStatusSchema,
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import type { z } from "zod";

import type { RepositoryDocument } from "../repositories";
import {
  AppointmentRepository,
  PatientRepository,
  ResourceRepository,
  ServiceRepository,
  SettingsRepository,
} from "../repositories";
import { logInfo, logWarn, metrics } from "../observability";
import { AppError, ConflictError } from "../utils";
import type { Clock } from "./availability.service";

export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "completed", "no_show"],
  cancelled: [],
  completed: [],
  no_show: [],
};

function parseStartsAt(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("VALIDATION_ERROR", 400, "Invalid appointment start time.");
  }

  return date;
}

function assertNotPast(appointment: Appointment, now: Date, action: string): void {
  if (appointment.startsAt.toMillis() <= now.getTime()) {
    throw new AppError("FORBIDDEN", 403, `Cannot ${action} a past appointment.`);
  }
}

export class AppointmentService {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly patients: PatientRepository,
    private readonly services: ServiceRepository,
    private readonly resources: ResourceRepository,
    private readonly settings: SettingsRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async list(
    tenantId: string,
    from: Date,
    to: Date,
    status?: AppointmentStatus,
  ): Promise<Array<RepositoryDocument<Appointment>>> {
    if (to.getTime() <= from.getTime()) {
      throw new AppError("VALIDATION_ERROR", 400, "`to` must be after `from`.");
    }

    return this.appointments.findByStartRange(
      tenantId,
      {
        startsAt: Timestamp.fromDate(from),
        endsAt: Timestamp.fromDate(to),
      },
      status,
    );
  }

  async create(
    tenantId: string,
    appointmentId: string,
    dto: CreateAppointmentDto,
    createdBy: string,
  ): Promise<RepositoryDocument<Appointment>> {
    const [patient, service, activeResources, profile] = await Promise.all([
      this.patients.getById(tenantId, dto.patientId),
      this.services.getById(tenantId, dto.serviceId),
      this.resources.listActive(tenantId),
      this.settings.getProfile(tenantId),
    ]);

    if (!patient) {
      throw new AppError("NOT_FOUND", 404, "Patient was not found.");
    }

    if (!service || !service.data.active) {
      throw new AppError("NOT_FOUND", 404, "Service was not found.");
    }

    if (!profile) {
      throw new AppError("NOT_FOUND", 404, "Settings profile was not found.");
    }

    const resourceId = dto.resourceId ?? activeResources[0]?.id;

    if (!resourceId || !activeResources.some((resource) => resource.id === resourceId)) {
      throw new AppError("NOT_FOUND", 404, "Resource was not found.");
    }

    const startsAt = parseStartsAt(dto.startsAt);
    const endsAt = new Date(
      startsAt.getTime() + (service.data.durationMinutes + profile.data.bufferMinutes) * 60_000,
    );
    const now = Timestamp.fromDate(this.clock());
    const appointment: Appointment = {
      patientId: dto.patientId,
      serviceId: dto.serviceId,
      resourceId,
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: Timestamp.fromDate(endsAt),
      status: "confirmed",
      source: "dashboard",
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const created = await this.appointments.createBookingTransaction(
        tenantId,
        appointmentId,
        appointment,
      );

      logInfo("appointment.booked", {
        appointmentId,
        serviceId: dto.serviceId,
        source: appointment.source,
        tenantId,
      });
      return created;
    } catch (error) {
      if (error instanceof ConflictError) {
        metrics.incrementAppointmentConflict();
        logWarn("appointment.conflict", {
          attemptedSlot: startsAt.toISOString(),
          tenantId,
        });
      }

      throw error;
    }
  }

  async update(
    tenantId: string,
    appointmentId: string,
    dto: UpdateAppointmentDto,
  ): Promise<RepositoryDocument<Appointment>> {
    const existing = await this.appointments.getById(tenantId, appointmentId);

    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Appointment was not found.");
    }

    const now = this.clock();
    const nextStatus = dto.status ?? existing.data.status;
    const isRescheduling = Boolean(dto.startsAt || dto.resourceId);

    if (isRescheduling) {
      assertNotPast(existing.data, now, "reschedule");
    }

    if (dto.status && dto.status !== existing.data.status) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[existing.data.status];

      if (!allowed.includes(dto.status)) {
        throw new AppError("VALIDATION_ERROR", 400, "Invalid appointment status transition.");
      }

      if (dto.status === "cancelled") {
        assertNotPast(existing.data, now, "cancel");
      }
    }

    const [service, profile, activeResources] = await Promise.all([
      this.services.getById(tenantId, existing.data.serviceId),
      this.settings.getProfile(tenantId),
      this.resources.listActive(tenantId),
    ]);

    if (!service || !service.data.active) {
      throw new AppError("NOT_FOUND", 404, "Service was not found.");
    }

    if (!profile) {
      throw new AppError("NOT_FOUND", 404, "Settings profile was not found.");
    }

    const resourceId = dto.resourceId ?? existing.data.resourceId;

    if (!activeResources.some((resource) => resource.id === resourceId)) {
      throw new AppError("NOT_FOUND", 404, "Resource was not found.");
    }

    const startsAtDate = dto.startsAt
      ? parseStartsAt(dto.startsAt)
      : existing.data.startsAt.toDate();
    const endsAtDate = new Date(
      startsAtDate.getTime() + (service.data.durationMinutes + profile.data.bufferMinutes) * 60_000,
    );
    const nextAppointment: Appointment = {
      ...existing.data,
      resourceId,
      startsAt: Timestamp.fromDate(startsAtDate),
      endsAt: Timestamp.fromDate(endsAtDate),
      status: nextStatus,
      updatedAt: Timestamp.fromDate(now),
    };

    try {
      return await this.appointments.updateInTransaction(tenantId, appointmentId, nextAppointment);
    } catch (error) {
      if (error instanceof ConflictError) {
        metrics.incrementAppointmentConflict();
        logWarn("appointment.conflict", {
          appointmentId,
          attemptedSlot: startsAtDate.toISOString(),
          tenantId,
        });
      }

      throw error;
    }
  }

  async cancel(tenantId: string, appointmentId: string): Promise<void> {
    await this.update(tenantId, appointmentId, { status: "cancelled" });
  }
}
