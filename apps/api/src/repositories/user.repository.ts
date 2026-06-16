import type { User } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import { TenantCollectionRepository } from "./base.repository";

export class UserRepository extends TenantCollectionRepository<User> {
  constructor(db: Firestore) {
    super(db, "users");
  }
}
