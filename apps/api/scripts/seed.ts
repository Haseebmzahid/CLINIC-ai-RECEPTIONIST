import type { Faq, Patient, Resource, Service, SettingsProfile, Tenant } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";

import { getDb } from "../src/integrations/firebase";
import {
  FaqRepository,
  PatientRepository,
  ResourceRepository,
  ServiceRepository,
  SettingsRepository,
  TenantRepository,
} from "../src/repositories";

const tenantId = "clinic_a";
const secondTenantId = "clinic_b";
const now = Timestamp.fromDate(new Date("2026-06-15T00:00:00.000Z"));

const tenant: Tenant = {
  name: "Bright Smile Dental",
  slug: "bright-smile",
  status: "active",
  whatsapp: {
    phoneNumberId: "1029384756",
    displayPhone: "+92 300 1234567",
    wabaId: "waba_clinic_a",
    accessTokenRef: "secret://wa_clinic_a",
  },
  subscription: {
    plan: "professional",
    seats: 5,
    renewsAt: Timestamp.fromDate(new Date("2027-06-15T00:00:00.000Z")),
  },
  createdAt: now,
  updatedAt: now,
};

const secondTenant: Tenant = {
  name: "Northside Family Clinic",
  slug: "northside-family",
  status: "active",
  whatsapp: {
    phoneNumberId: "2039485761",
    displayPhone: "+92 300 7654321",
    wabaId: "waba_clinic_b",
    accessTokenRef: "secret://wa_clinic_b",
  },
  subscription: {
    plan: "professional",
    seats: 4,
    renewsAt: Timestamp.fromDate(new Date("2027-06-15T00:00:00.000Z")),
  },
  createdAt: now,
  updatedAt: now,
};

const profile: SettingsProfile = {
  timezone: "Asia/Karachi",
  locale: "en",
  location: {
    address: "12 Mall Rd, Lahore",
    mapsUrl: "https://maps.example.com/bright-smile",
  },
  workingHours: {
    "0": [],
    "1": [{ open: "09:00", close: "17:00" }],
    "2": [{ open: "09:00", close: "17:00" }],
    "3": [{ open: "09:00", close: "17:00" }],
    "4": [{ open: "09:00", close: "17:00" }],
    "5": [{ open: "09:00", close: "17:00" }],
    "6": [{ open: "10:00", close: "14:00" }],
  },
  slotLengthMinutes: 30,
  bufferMinutes: 5,
  minLeadTimeMinutes: 120,
  holidays: ["2026-06-28"],
};

const services: Record<string, Service> = {
  svc_cleaning: {
    name: "Dental Cleaning",
    durationMinutes: 30,
    fee: 350000,
    currency: "PKR",
    active: true,
  },
  svc_checkup: {
    name: "Dental Checkup",
    durationMinutes: 20,
    fee: 200000,
    currency: "PKR",
    active: true,
  },
};

const resources: Record<string, Resource> = {
  res_default: {
    name: "Dr. Khan",
    type: "practitioner",
    active: true,
  },
};

const faqs: Record<string, Faq> = {
  faq_hours: {
    question: "What are your timings?",
    answer: "We're open Mon-Fri 9am-5pm and Sat 10am-2pm.",
    tags: ["hours"],
    active: true,
    updatedAt: now,
  },
  faq_location: {
    question: "Where are you located?",
    answer: "We're at 12 Mall Rd, Lahore.",
    tags: ["location"],
    active: true,
    updatedAt: now,
  },
  faq_fee: {
    question: "How much is a cleaning?",
    answer: "A dental cleaning is PKR 3,500.",
    tags: ["pricing", "services"],
    active: true,
    updatedAt: now,
  },
};

const patients: Record<string, Patient> = {
  pat_sara: {
    waId: "923001234567",
    phone: "+923001234567",
    name: "Sara",
    nameLower: "sara",
    notes: "",
    lastSeenAt: now,
    createdAt: now,
  },
  pat_ahmed: {
    waId: "923009876543",
    phone: "+923009876543",
    name: "Ahmed",
    nameLower: "ahmed",
    notes: "Prefers morning appointments.",
    lastSeenAt: now,
    createdAt: now,
  },
};

const secondTenantPatients: Record<string, Patient> = {
  pat_mina: {
    waId: "923005551111",
    phone: "+923005551111",
    name: "Mina",
    nameLower: "mina",
    notes: "Clinic B seed patient.",
    lastSeenAt: now,
    createdAt: now,
  },
};

async function seed(): Promise<void> {
  const db = getDb();
  const tenants = new TenantRepository(db);
  const settings = new SettingsRepository(db);
  const serviceRepository = new ServiceRepository(db);
  const resourceRepository = new ResourceRepository(db);
  const faqRepository = new FaqRepository(db);
  const patientRepository = new PatientRepository(db);

  await tenants.create(tenantId, tenant);
  await tenants.create(secondTenantId, secondTenant);
  await settings.setProfile(tenantId, profile);
  await settings.setProfile(secondTenantId, {
    ...profile,
    location: {
      address: "44 Canal Rd, Lahore",
      mapsUrl: "https://maps.example.com/northside-family",
    },
  });

  await Promise.all(
    Object.entries(services).map(([id, service]) =>
      serviceRepository.create(tenantId, id, service),
    ),
  );
  await Promise.all(
    Object.entries(services).map(([id, service]) =>
      serviceRepository.create(secondTenantId, id, service),
    ),
  );
  await Promise.all(
    Object.entries(resources).map(([id, resource]) =>
      resourceRepository.create(tenantId, id, resource),
    ),
  );
  await Promise.all(
    Object.entries(resources).map(([id, resource]) =>
      resourceRepository.create(secondTenantId, id, resource),
    ),
  );
  await Promise.all(
    Object.entries(faqs).map(([id, faq]) => faqRepository.create(tenantId, id, faq)),
  );
  await Promise.all(
    Object.entries(faqs).map(([id, faq]) => faqRepository.create(secondTenantId, id, faq)),
  );
  await Promise.all(
    Object.entries(patients).map(([id, patient]) =>
      patientRepository.create(tenantId, id, patient),
    ),
  );
  await Promise.all(
    Object.entries(secondTenantPatients).map(([id, patient]) =>
      patientRepository.create(secondTenantId, id, patient),
    ),
  );
}

await seed();
console.log(`Seeded ${tenantId} and ${secondTenantId}`);
