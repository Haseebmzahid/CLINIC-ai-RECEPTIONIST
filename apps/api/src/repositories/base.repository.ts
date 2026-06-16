import type {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  Timestamp,
} from "firebase-admin/firestore";

export interface RepositoryDocument<T> {
  id: string;
  data: T;
}

export type RepositoryUpdate<T extends object> = Partial<T>;

export abstract class TenantCollectionRepository<T extends object> {
  protected constructor(
    protected readonly db: Firestore,
    private readonly collectionName: string,
  ) {}

  protected collection(tenantId: string): CollectionReference<DocumentData> {
    return this.db.collection(`tenants/${tenantId}/${this.collectionName}`);
  }

  async create(tenantId: string, id: string, data: T): Promise<RepositoryDocument<T>> {
    await this.collection(tenantId).doc(id).set(data);
    return { id, data };
  }

  async getById(tenantId: string, id: string): Promise<RepositoryDocument<T> | null> {
    const snapshot = await this.collection(tenantId).doc(id).get();

    if (!snapshot.exists) {
      return null;
    }

    return { id: snapshot.id, data: snapshot.data() as T };
  }

  async update(tenantId: string, id: string, data: RepositoryUpdate<T>): Promise<void> {
    await this.collection(tenantId).doc(id).update(data);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.collection(tenantId).doc(id).delete();
  }

  async list(tenantId: string, limit = 100): Promise<Array<RepositoryDocument<T>>> {
    return this.getQueryResults(this.collection(tenantId).limit(limit));
  }

  protected async getQueryResults(
    query: Query<DocumentData>,
  ): Promise<Array<RepositoryDocument<T>>> {
    const snapshot = await query.get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as T,
    }));
  }
}

export interface TimeRangeQuery {
  startsAt: Timestamp;
  endsAt: Timestamp;
}
