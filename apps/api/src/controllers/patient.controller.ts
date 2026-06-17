import { randomUUID } from "node:crypto";

import {
  CreatePatientDtoSchema,
  PatientSearchQuerySchema,
  UpdatePatientDtoSchema,
} from "@clinic-ai/shared";
import type { Request, Response } from "express";

import type { DomainServicesProvider } from "../services";
import { withId } from "../utils";
import { requireRequestTenantId } from "./controller-utils";

export function createPatientController(getServices: DomainServicesProvider) {
  return {
    search: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const query = PatientSearchQuerySchema.parse(request.query);
      const patients = await getServices().patients.search(tenantId, query.q, query.limit);

      response.status(200).json(patients.map((patient) => withId(patient.id, patient.data)));
    },

    getDetail: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const detail = await getServices().patients.getDetail(tenantId, request.params.id ?? "");

      response.status(200).json({
        patient: withId(detail.patient.id, detail.patient.data),
        appointments: detail.appointments.map((appointment) =>
          withId(appointment.id, appointment.data),
        ),
      });
    },

    create: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = CreatePatientDtoSchema.parse(request.body);
      const created = await getServices().patients.create(tenantId, `pat_${randomUUID()}`, body);
      await getServices().auditLogs.recordStaffMutation(tenantId, request.ctx, {
        action: "patient.create",
        target: `patients/${created.id}`,
      });

      response.status(201).json(withId(created.id, created.data));
    },

    update: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = UpdatePatientDtoSchema.parse(request.body);
      const updated = await getServices().patients.update(tenantId, request.params.id ?? "", body);
      await getServices().auditLogs.recordStaffMutation(tenantId, request.ctx, {
        action: "patient.update",
        target: `patients/${updated.id}`,
      });

      response.status(200).json(withId(updated.id, updated.data));
    },
  };
}
