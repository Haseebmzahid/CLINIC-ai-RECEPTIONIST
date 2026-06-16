import type { Appointment, CreatePatientDto, Patient, UpdatePatientDto } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";

import type { RepositoryDocument } from "../repositories";
import { AppointmentRepository, PatientRepository } from "../repositories";
import { AppError } from "../utils";

export interface PatientDetail {
  patient: RepositoryDocument<Patient>;
  appointments: Array<RepositoryDocument<Appointment>>;
}

function normalizeNameLower(name: string): string {
  return name.trim().toLowerCase();
}

function defaultWaId(phone: string): string {
  return phone.replace(/\D/g, "");
}

export class PatientService {
  constructor(
    private readonly patients: PatientRepository,
    private readonly appointments: AppointmentRepository,
  ) {}

  async search(tenantId: string, query?: string): Promise<Array<RepositoryDocument<Patient>>> {
    const normalizedQuery = query?.trim();

    if (!normalizedQuery) {
      return this.patients.list(tenantId);
    }

    const [phoneMatches, nameMatches] = await Promise.all([
      this.patients.findByPhone(tenantId, normalizedQuery),
      this.patients.searchByNameLower(tenantId, normalizedQuery.toLowerCase()),
    ]);
    const results = new Map<string, RepositoryDocument<Patient>>();

    for (const match of [...phoneMatches, ...nameMatches]) {
      results.set(match.id, match);
    }

    return [...results.values()];
  }

  async getDetail(tenantId: string, id: string): Promise<PatientDetail> {
    const patient = await this.patients.getById(tenantId, id);

    if (!patient) {
      throw new AppError("NOT_FOUND", 404, "Patient was not found.");
    }

    return {
      patient,
      appointments: await this.appointments.findByPatientId(tenantId, id),
    };
  }

  async create(
    tenantId: string,
    id: string,
    dto: CreatePatientDto,
  ): Promise<RepositoryDocument<Patient>> {
    const now = Timestamp.now();

    return this.patients.create(tenantId, id, {
      waId: dto.waId ?? defaultWaId(dto.phone),
      phone: dto.phone,
      name: dto.name,
      nameLower: normalizeNameLower(dto.name),
      notes: dto.notes ?? "",
      lastSeenAt: now,
      createdAt: now,
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePatientDto,
  ): Promise<RepositoryDocument<Patient>> {
    const existing = await this.patients.getById(tenantId, id);

    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Patient was not found.");
    }

    await this.patients.update(tenantId, id, {
      ...dto,
      ...(dto.name ? { nameLower: normalizeNameLower(dto.name) } : {}),
    });

    const updated = await this.patients.getById(tenantId, id);

    if (!updated) {
      throw new AppError("NOT_FOUND", 404, "Patient was not found.");
    }

    return updated;
  }
}
