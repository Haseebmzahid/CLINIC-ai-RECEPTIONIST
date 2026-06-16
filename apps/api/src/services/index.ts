import type { Firestore } from "firebase-admin/firestore";

import { getDb } from "../integrations/firebase";
import {
  AppointmentRepository,
  FaqRepository,
  PatientRepository,
  ResourceRepository,
  ServiceRepository,
  SettingsRepository,
} from "../repositories";
import { AppointmentService } from "./appointment.service";
import { AvailabilityService } from "./availability.service";
import { FaqService } from "./faq.service";
import { PatientService } from "./patient.service";
import { ClinicServiceService } from "./service.service";
import { SettingsService } from "./settings.service";

export interface DomainServices {
  appointments: AppointmentService;
  availability: AvailabilityService;
  clinicServices: ClinicServiceService;
  faqs: FaqService;
  patients: PatientService;
  settings: SettingsService;
}

export type DomainServicesProvider = () => DomainServices;

export function createDomainServices(db: Firestore): DomainServices {
  const appointments = new AppointmentRepository(db);
  const patients = new PatientRepository(db);
  const resources = new ResourceRepository(db);
  const services = new ServiceRepository(db);
  const settings = new SettingsRepository(db);

  return {
    appointments: new AppointmentService(appointments, patients, services, resources, settings),
    availability: new AvailabilityService(settings, services, resources, appointments),
    clinicServices: new ClinicServiceService(services),
    faqs: new FaqService(new FaqRepository(db)),
    patients: new PatientService(patients, appointments),
    settings: new SettingsService(settings),
  };
}

export function createLazyDomainServicesProvider(db?: Firestore): DomainServicesProvider {
  let services: DomainServices | undefined;

  return () => {
    services ??= createDomainServices(db ?? getDb());
    return services;
  };
}
