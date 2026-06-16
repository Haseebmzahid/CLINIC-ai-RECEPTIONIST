import type { Appointment, AppointmentStatusSchema } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";
import type { z } from "zod";

import { TenantCollectionRepository, type TimeRangeQuery } from "./base.repository";

export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

export class AppointmentRepository extends TenantCollectionRepository<Appointment> {
  constructor(db: Firestore) {
    super(db, "appointments");
  }

  async findByResourceStatusAndStartRange(
    tenantId: string,
    resourceId: string,
    statuses: AppointmentStatus[],
    range: TimeRangeQuery,
  ): Promise<Array<{ id: string; data: Appointment }>> {
    if (statuses.length === 0) {
      return [];
    }

    return this.getQueryResults(
      this.collection(tenantId)
        .where("resourceId", "==", resourceId)
        .where("status", "in", statuses)
        .where("startsAt", ">=", range.startsAt)
        .where("startsAt", "<", range.endsAt)
        .orderBy("startsAt", "asc"),
    );
  }

  async findByPatientId(
    tenantId: string,
    patientId: string,
  ): Promise<Array<{ id: string; data: Appointment }>> {
    return this.getQueryResults(
      this.collection(tenantId)
        .where("patientId", "==", patientId)
        .orderBy("startsAt", "desc")
        .limit(50),
    );
  }
}
