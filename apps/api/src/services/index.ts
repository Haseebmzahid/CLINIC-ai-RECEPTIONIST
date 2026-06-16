import type { Firestore } from "firebase-admin/firestore";

import { getDb } from "../integrations/firebase";
import {
  AppointmentRepository,
  FaqRepository,
  PatientRepository,
  ServiceRepository,
  SettingsRepository,
} from "../repositories";
import { FaqService } from "./faq.service";
import { PatientService } from "./patient.service";
import { ClinicServiceService } from "./service.service";
import { SettingsService } from "./settings.service";

export interface DomainServices {
  clinicServices: ClinicServiceService;
  faqs: FaqService;
  patients: PatientService;
  settings: SettingsService;
}

export type DomainServicesProvider = () => DomainServices;

export function createDomainServices(db: Firestore): DomainServices {
  return {
    clinicServices: new ClinicServiceService(new ServiceRepository(db)),
    faqs: new FaqService(new FaqRepository(db)),
    patients: new PatientService(new PatientRepository(db), new AppointmentRepository(db)),
    settings: new SettingsService(new SettingsRepository(db)),
  };
}

export function createLazyDomainServicesProvider(db?: Firestore): DomainServicesProvider {
  let services: DomainServices | undefined;

  return () => {
    services ??= createDomainServices(db ?? getDb());
    return services;
  };
}
