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

  async findByStates(
    tenantId: string,
    states: ConversationState[],
    limit = 100,
  ): Promise<Array<RepositoryDocument<Conversation>>> {
    if (states.length === 0) {
      return [];
    }

    return this.getQueryResults(
      this.collection(tenantId)
        .where("state", "in", states)
        .orderBy("updatedAt", "desc")
        .limit(limit),
    );
  }

  async listRecent(
    tenantId: string,
    limit = 100,
  ): Promise<Array<RepositoryDocument<Conversation>>> {
    return this.getQueryResults(
      this.collection(tenantId).orderBy("updatedAt", "desc").limit(limit),
    );
  }

  async findByWaId(
    tenantId: string,
    waId: string,
  ): Promise<Array<RepositoryDocument<Conversation>>> {
    return this.getQueryResults(this.collection(tenantId).where("waId", "==", waId).limit(1));
  }

  async listMessages(
    tenantId: string,
    conversationId: string,
  ): Promise<Array<RepositoryDocument<Message>>> {
    const snapshot = await this.collection(tenantId)
      .doc(conversationId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as Message,
    }));
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

  async findMessageByWaMessageId(
    tenantId: string,
    waMessageId: string,
  ): Promise<(RepositoryDocument<Message> & { conversationId: string }) | null> {
    const snapshot = await this.db
      .collectionGroup("messages")
      .where("waMessageId", "==", waMessageId)
      .limit(10)
      .get();

    for (const doc of snapshot.docs) {
      const messagesCollection = doc.ref.parent;
      const conversationRef = messagesCollection.parent;
      const conversationsCollection = conversationRef?.parent;
      const tenantRef = conversationsCollection?.parent;

      if (tenantRef?.id !== tenantId || !conversationRef) {
        continue;
      }

      return {
        id: doc.id,
        conversationId: conversationRef.id,
        data: doc.data() as Message,
      };
    }

    return null;
  }
}
