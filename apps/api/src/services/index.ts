import type { Firestore } from "firebase-admin/firestore";

import { getDb } from "../integrations/firebase";
import {
  AppointmentRepository,
  AuditLogRepository,
  ConversationRepository,
  FaqRepository,
  PatientRepository,
  ResourceRepository,
  ServiceRepository,
  SettingsRepository,
  TenantRepository,
} from "../repositories";
import { AppointmentService } from "./appointment.service";
import { AdminService } from "./admin.service";
import { AuditLogService } from "./audit-log.service";
import { AvailabilityService } from "./availability.service";
import { ConversationService } from "./conversation.service";
import { FaqService } from "./faq.service";
import { PatientService } from "./patient.service";
import { ClinicServiceService } from "./service.service";
import { SettingsService } from "./settings.service";

export { AdminService } from "./admin.service";
export { AppointmentService } from "./appointment.service";
export { AuditLogService } from "./audit-log.service";
export { AvailabilityService } from "./availability.service";
export { ConversationService } from "./conversation.service";
export { FaqService } from "./faq.service";
export { PatientService } from "./patient.service";
export { ClinicServiceService } from "./service.service";
export { SettingsService } from "./settings.service";

export interface DomainServices {
  admin: AdminService;
  appointments: AppointmentService;
  auditLogs: AuditLogService;
  availability: AvailabilityService;
  clinicServices: ClinicServiceService;
  conversations: ConversationService;
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
    admin: new AdminService(new TenantRepository(db)),
    appointments: new AppointmentService(appointments, patients, services, resources, settings),
    auditLogs: new AuditLogService(new AuditLogRepository(db)),
    availability: new AvailabilityService(settings, services, resources, appointments),
    clinicServices: new ClinicServiceService(services),
    conversations: new ConversationService(
      new TenantRepository(db),
      new ConversationRepository(db),
      appointments,
      services,
      settings,
    ),
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
