import type { Appointment, AppointmentStatusSchema } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { z } from "zod";

import { TenantCollectionRepository, type TimeRangeQuery } from "./base.repository";
import { ConflictError } from "../utils";

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

  async findOverlappingCandidates(
    tenantId: string,
    resourceId: string,
    statuses: AppointmentStatus[],
    range: TimeRangeQuery,
  ): Promise<Array<{ id: string; data: Appointment }>> {
    if (statuses.length === 0) {
      return [];
    }

    const candidates = await this.getQueryResults(
      this.collection(tenantId)
        .where("resourceId", "==", resourceId)
        .where("status", "in", statuses)
        .where("startsAt", "<", range.endsAt)
        .orderBy("startsAt", "asc"),
    );

    return candidates.filter(
      (candidate) => candidate.data.endsAt.toMillis() > range.startsAt.toMillis(),
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

  async findByStartRange(
    tenantId: string,
    range: TimeRangeQuery,
    status?: AppointmentStatus,
  ): Promise<Array<{ id: string; data: Appointment }>> {
    let query = this.collection(tenantId)
      .where("startsAt", ">=", range.startsAt)
      .where("startsAt", "<", range.endsAt)
      .orderBy("startsAt", "asc");

    if (status) {
      query = query.where("status", "==", status);
    }

    return this.getQueryResults(query);
  }

  async createBookingTransaction(
    tenantId: string,
    appointmentId: string,
    appointment: Appointment,
  ): Promise<{ id: string; data: Appointment }> {
    const appointments = this.collection(tenantId);

    await this.db.runTransaction(async (transaction) => {
      const clashSnapshot = await transaction.get(
        appointments
          .where("resourceId", "==", appointment.resourceId)
          .where("status", "in", ["pending", "confirmed"])
          .where("startsAt", "<", appointment.endsAt),
      );
      const hasClash = clashSnapshot.docs.some((doc) => {
        const data = doc.data() as Appointment;
        return data.endsAt.toMillis() > appointment.startsAt.toMillis();
      });

      if (hasClash) {
        throw new ConflictError();
      }

      transaction.set(appointments.doc(appointmentId), appointment);
    });

    return { id: appointmentId, data: appointment };
  }

  async updateInTransaction(
    tenantId: string,
    appointmentId: string,
    data: Appointment,
  ): Promise<{ id: string; data: Appointment }> {
    const appointments = this.collection(tenantId);

    await this.db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(appointments.doc(appointmentId));

      if (!currentSnapshot.exists) {
        return;
      }

      if (data.status === "pending" || data.status === "confirmed") {
        const clashSnapshot = await transaction.get(
          appointments
            .where("resourceId", "==", data.resourceId)
            .where("status", "in", ["pending", "confirmed"])
            .where("startsAt", "<", data.endsAt),
        );
        const hasClash = clashSnapshot.docs.some((doc) => {
          if (doc.id === appointmentId) {
            return false;
          }

          const appointment = doc.data() as Appointment;
          return appointment.endsAt.toMillis() > data.startsAt.toMillis();
        });

        if (hasClash) {
          throw new ConflictError();
        }
      }

      transaction.set(appointments.doc(appointmentId), data);
    });

    return { id: appointmentId, data };
  }

  toTimestamp(date: Date): Timestamp {
    return Timestamp.fromDate(date);
  }
}
