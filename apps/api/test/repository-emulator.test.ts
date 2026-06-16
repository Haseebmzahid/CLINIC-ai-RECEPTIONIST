import type { Patient, Tenant } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import { beforeAll, describe, expect, it } from "vitest";

import { getDb } from "../src/integrations/firebase";
import { PatientRepository, TenantRepository } from "../src/repositories";

const shouldRunEmulatorTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!shouldRunEmulatorTests)("tenant-scoped Firestore repositories", () => {
  beforeAll(() => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "clinic-ai-test";
  });

  it("round-trips a tenant-scoped repository write and read", async () => {
    const db = getDb();
    const tenants = new TenantRepository(db);
    const patients = new PatientRepository(db);
    const timestamp = Timestamp.fromDate(new Date("2026-06-15T00:00:00.000Z"));
    const tenant: Tenant = {
      name: "Clinic A",
      slug: "clinic-a",
      status: "active",
      whatsapp: {
        phoneNumberId: "phone_clinic_a",
        displayPhone: "+1 555 0100",
        wabaId: "waba_clinic_a",
        accessTokenRef: "secret://clinic_a",
      },
      subscription: {
        plan: "professional",
        seats: 5,
        renewsAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const patient: Patient = {
      waId: "15550101",
      phone: "+15550101",
      name: "Ada",
      nameLower: "ada",
      notes: "",
      lastSeenAt: timestamp,
      createdAt: timestamp,
    };

    await tenants.create("clinic_a", tenant);
    await patients.create("clinic_a", "patient_roundtrip", patient);

    const saved = await patients.getById("clinic_a", "patient_roundtrip");

    expect(saved).toEqual({ id: "patient_roundtrip", data: patient });
  });

  it("does not return clinic_b patient data from a clinic_a scoped read", async () => {
    const db = getDb();
    const patients = new PatientRepository(db);
    const timestamp = Timestamp.fromDate(new Date("2026-06-15T00:00:00.000Z"));
    const clinicBPatient: Patient = {
      waId: "15550202",
      phone: "+15550202",
      name: "Bert",
      nameLower: "bert",
      notes: "Belongs to Clinic B.",
      lastSeenAt: timestamp,
      createdAt: timestamp,
    };

    await patients.create("clinic_b", "patient_isolated", clinicBPatient);

    const leakedById = await patients.getById("clinic_a", "patient_isolated");
    const leakedByPhone = await patients.findByPhone("clinic_a", clinicBPatient.phone);

    expect(leakedById).toBeNull();
    expect(leakedByPhone).toEqual([]);
  });
});
