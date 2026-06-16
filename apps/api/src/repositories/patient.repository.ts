import type { Patient } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import { TenantCollectionRepository } from "./base.repository";

export class PatientRepository extends TenantCollectionRepository<Patient> {
  constructor(db: Firestore) {
    super(db, "patients");
  }

  async findByPhone(
    tenantId: string,
    phone: string,
  ): Promise<Array<{ id: string; data: Patient }>> {
    return this.getQueryResults(this.collection(tenantId).where("phone", "==", phone).limit(10));
  }

  async searchByNameLower(
    tenantId: string,
    nameLower: string,
  ): Promise<Array<{ id: string; data: Patient }>> {
    const upperBound = `${nameLower}\uf8ff`;

    return this.getQueryResults(
      this.collection(tenantId).orderBy("nameLower").startAt(nameLower).endAt(upperBound).limit(20),
    );
  }

  async findByWaId(tenantId: string, waId: string): Promise<Array<{ id: string; data: Patient }>> {
    return this.getQueryResults(this.collection(tenantId).where("waId", "==", waId).limit(1));
  }
}
