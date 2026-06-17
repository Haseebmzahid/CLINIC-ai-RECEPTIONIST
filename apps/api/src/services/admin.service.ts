import type { CreateTenantDto, Tenant, UpdateTenantDto } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";

import type { RepositoryDocument, TenantRepository } from "../repositories";
import { AppError } from "../utils";

export class AdminService {
  constructor(private readonly tenants: TenantRepository) {}

  async createTenant(dto: CreateTenantDto): Promise<RepositoryDocument<Tenant>> {
    const existing = await this.tenants.getById(dto.id);

    if (existing) {
      throw new AppError("VALIDATION_ERROR", 400, "Tenant id already exists.");
    }

    const now = Timestamp.now();
    return this.tenants.create(dto.id, {
      name: dto.name,
      slug: dto.slug,
      status: dto.status,
      whatsapp: dto.whatsapp,
      subscription: {
        ...dto.subscription,
        renewsAt: Timestamp.fromDate(new Date(dto.subscription.renewsAt)),
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto): Promise<RepositoryDocument<Tenant>> {
    const existing = await this.tenants.getById(tenantId);

    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Tenant was not found.");
    }

    const updated: Tenant = {
      ...existing.data,
      ...dto,
      whatsapp: {
        ...existing.data.whatsapp,
        ...dto.whatsapp,
      },
      subscription: {
        ...existing.data.subscription,
        ...dto.subscription,
        renewsAt: dto.subscription?.renewsAt
          ? Timestamp.fromDate(new Date(dto.subscription.renewsAt))
          : existing.data.subscription.renewsAt,
      },
      updatedAt: Timestamp.now(),
    };

    await this.tenants.update(tenantId, updated);
    return { id: tenantId, data: updated };
  }
}
