import type { CreateFaqDto, Faq, UpdateFaqDto } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";

import type { RepositoryDocument } from "../repositories";
import { FaqRepository } from "../repositories";
import { AppError } from "../utils";

export class FaqService {
  constructor(private readonly faqs: FaqRepository) {}

  async list(tenantId: string): Promise<Array<RepositoryDocument<Faq>>> {
    return this.faqs.list(tenantId);
  }

  async create(tenantId: string, id: string, dto: CreateFaqDto): Promise<RepositoryDocument<Faq>> {
    return this.faqs.create(tenantId, id, {
      ...dto,
      active: dto.active ?? true,
      updatedAt: Timestamp.now(),
    });
  }

  async update(tenantId: string, id: string, dto: UpdateFaqDto): Promise<RepositoryDocument<Faq>> {
    const existing = await this.faqs.getById(tenantId, id);

    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "FAQ was not found.");
    }

    await this.faqs.update(tenantId, id, {
      ...dto,
      updatedAt: Timestamp.now(),
    });

    const updated = await this.faqs.getById(tenantId, id);

    if (!updated) {
      throw new AppError("NOT_FOUND", 404, "FAQ was not found.");
    }

    return updated;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.faqs.getById(tenantId, id);

    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "FAQ was not found.");
    }

    await this.faqs.delete(tenantId, id);
  }
}
