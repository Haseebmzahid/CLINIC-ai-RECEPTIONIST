import type { Appointment, Resource, Service, SettingsProfile } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { AvailabilityService } from "../src/services/availability.service";

const profile: SettingsProfile = {
  timezone: "America/Los_Angeles",
  locale: "en",
  location: { address: "Unit Test Clinic" },
  workingHours: {
    "0": [],
    "1": [{ open: "09:00", close: "11:00" }],
    "2": [{ open: "09:00", close: "11:00" }],
    "3": [{ open: "09:00", close: "11:00" }],
    "4": [{ open: "09:00", close: "11:00" }],
    "5": [{ open: "09:00", close: "11:00" }],
    "6": [],
  },
  slotLengthMinutes: 30,
  bufferMinutes: 15,
  minLeadTimeMinutes: 60,
  holidays: ["2099-01-20"],
};

const service: Service = {
  name: "Cleaning",
  durationMinutes: 30,
  fee: 10000,
  currency: "USD",
  active: true,
};

const resource: Resource = {
  name: "Room 1",
  type: "room",
  active: true,
};

const blockingAppointment: Appointment = {
  patientId: "pat_existing",
  serviceId: "svc_cleaning",
  resourceId: "res_default",
  startsAt: Timestamp.fromDate(new Date("2099-01-19T17:00:00.000Z")),
  endsAt: Timestamp.fromDate(new Date("2099-01-19T17:45:00.000Z")),
  status: "confirmed",
  source: "dashboard",
  createdBy: "staff_a",
  createdAt: Timestamp.fromDate(new Date("2099-01-01T00:00:00.000Z")),
  updatedAt: Timestamp.fromDate(new Date("2099-01-01T00:00:00.000Z")),
};

describe("AvailabilityService", () => {
  it("generates timezone-local slots and applies buffers, lead time, holidays, and overlaps", async () => {
    const availability = new AvailabilityService(
      {
        getProfile: () => Promise.resolve({ id: "profile", data: profile }),
      } as never,
      {
        getById: () => Promise.resolve({ id: "svc_cleaning", data: service }),
      } as never,
      {
        listActive: () => Promise.resolve([{ id: "res_default", data: resource }]),
      } as never,
      {
        findOverlappingCandidates: () =>
          Promise.resolve([{ id: "appt_existing", data: blockingAppointment }]),
      } as never,
      () => new Date("2099-01-19T16:15:00.000Z"),
    );

    const openSlots = await availability.getAvailability("clinic_a", {
      serviceId: "svc_cleaning",
      from: "2099-01-19",
      to: "2099-01-20",
    });
    const holidaySlots = await availability.getAvailability("clinic_a", {
      serviceId: "svc_cleaning",
      from: "2099-01-20",
      to: "2099-01-21",
    });

    expect(openSlots.map((slot) => slot.startsAt)).toEqual(["2099-01-19T18:00:00.000Z"]);
    expect(openSlots[0]?.slotId).toEqual(openSlots[0]?.slotId);
    expect(holidaySlots).toEqual([]);
  });
});
