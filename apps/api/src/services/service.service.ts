import type { CreateServiceDto, Service, UpdateServiceDto } from "@clinic-ai/shared";

import type { RepositoryDocument } from "../repositories";
import { ServiceRepository } from "../repositories";
import { AppError } from "../utils";

export class ClinicServiceService {
  constructor(private readonly services: ServiceRepository) {}

  async list(tenantId: string): Promise<Array<RepositoryDocument<Service>>> {
    return this.services.list(tenantId);
  }

  async create(
    tenantId: string,
    id: string,
    dto: CreateServiceDto,
  ): Promise<RepositoryDocument<Service>> {
    return this.services.create(tenantId, id, {
      ...dto,
      active: dto.active ?? true,
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<RepositoryDocument<Service>> {
    const existing = await this.services.getById(tenantId, id);

    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Service was not found.");
    }

    await this.services.update(tenantId, id, dto);
    const updated = await this.services.getById(tenantId, id);

    if (!updated) {
      throw new AppError("NOT_FOUND", 404, "Service was not found.");
    }

    return updated;
  }
}
