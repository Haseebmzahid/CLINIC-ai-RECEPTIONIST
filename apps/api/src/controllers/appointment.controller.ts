import { randomUUID } from "node:crypto";

import {
  AppointmentListQuerySchema,
  CreateAppointmentDtoSchema,
  UpdateAppointmentDtoSchema,
} from "@clinic-ai/shared";
import type { Request, Response } from "express";

import type { DomainServicesProvider } from "../services";
import { AppError, withId } from "../utils";
import { requireRequestTenantId } from "./controller-utils";

function parseDateBoundary(value: string, field: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("VALIDATION_ERROR", 400, `Invalid ${field} date.`);
  }

  return date;
}

export function createAppointmentController(getServices: DomainServicesProvider) {
  return {
    list: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const query = AppointmentListQuerySchema.parse(request.query);
      const appointments = await getServices().appointments.list(
        tenantId,
        parseDateBoundary(query.from, "from"),
        parseDateBoundary(query.to, "to"),
        query.status,
      );

      response
        .status(200)
        .json(appointments.map((appointment) => withId(appointment.id, appointment.data)));
    },

    create: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = CreateAppointmentDtoSchema.parse(request.body);
      const appointment = await getServices().appointments.create(
        tenantId,
        `appt_${randomUUID()}`,
        body,
        request.ctx?.uid ?? "unknown",
      );

      response.status(201).json(withId(appointment.id, appointment.data));
    },

    update: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = UpdateAppointmentDtoSchema.parse(request.body);
      const appointment = await getServices().appointments.update(
        tenantId,
        request.params.id ?? "",
        body,
      );

      response.status(200).json(withId(appointment.id, appointment.data));
    },

    delete: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);

      await getServices().appointments.cancel(tenantId, request.params.id ?? "");
      response.status(204).send();
    },
  };
}
