import type { Conversation, ConversationStateSchema, Message } from "@clinic-ai/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import type { z } from "zod";

import type { RepositoryDocument, RepositoryUpdate } from "./base.repository";
import { TenantCollectionRepository } from "./base.repository";

export type ConversationState = z.infer<typeof ConversationStateSchema>;

export class ConversationRepository extends TenantCollectionRepository<Conversation> {
  constructor(db: Firestore) {
    super(db, "conversations");
  }

  async findByStateUpdatedSince(
    tenantId: string,
    states: ConversationState[],
    updatedSince: Timestamp,
  ): Promise<Array<RepositoryDocument<Conversation>>> {
    if (states.length === 0) {
      return [];
    }

    return this.getQueryResults(
      this.collection(tenantId)
        .where("state", "in", states)
        .where("updatedAt", ">=", updatedSince)
        .orderBy("updatedAt", "desc")
        .limit(50),
    );
  }

  async createMessage(
    tenantId: string,
    conversationId: string,
    messageId: string,
    data: Message,
  ): Promise<RepositoryDocument<Message>> {
    await this.collection(tenantId)
      .doc(conversationId)
      .collection("messages")
      .doc(messageId)
      .set(data);

    return { id: messageId, data };
  }

  async getMessageById(
    tenantId: string,
    conversationId: string,
    messageId: string,
  ): Promise<RepositoryDocument<Message> | null> {
    const snapshot = await this.collection(tenantId)
      .doc(conversationId)
      .collection("messages")
      .doc(messageId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return { id: snapshot.id, data: snapshot.data() as Message };
  }

  async updateMessage(
    tenantId: string,
    conversationId: string,
    messageId: string,
    data: RepositoryUpdate<Message>,
  ): Promise<void> {
    await this.collection(tenantId)
      .doc(conversationId)
      .collection("messages")
      .doc(messageId)
      .update(data);
  }
}
