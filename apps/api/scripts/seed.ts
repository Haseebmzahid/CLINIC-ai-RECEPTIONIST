import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Tenant } from "@clinic-ai/shared";
import { config } from "dotenv";
import { Timestamp } from "firebase-admin/firestore";

const currentDir = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(currentDir, "../.env.local") });

const [{ getAdminAuth, getDb }, { TenantRepository }] = await Promise.all([
  import("../src/integrations/firebase"),
  import("../src/repositories"),
]);

const tenantId = "clinic_a";
const ownerEmail = "admin@clinic-a.com";
const ownerPassword = "Admin123!";
const now = Timestamp.now();

const tenant: Tenant = {
  name: "Clinic A",
  slug: "clinic-a",
  status: "active",
  whatsapp: {
    phoneNumberId: "clinic_a_phone_number_id",
    displayPhone: "+1 555 0100",
    wabaId: "clinic_a_waba_id",
    accessTokenRef: "env://WHATSAPP_ACCESS_TOKEN",
  },
  subscription: {
    plan: "local",
    seats: 5,
    renewsAt: Timestamp.fromDate(new Date("2099-01-01T00:00:00.000Z")),
  },
  createdAt: now,
  updatedAt: now,
};

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function upsertOwnerUser(): Promise<string> {
  const auth = getAdminAuth();

  try {
    const existing = await auth.getUserByEmail(ownerEmail);

    await auth.updateUser(existing.uid, {
      email: ownerEmail,
      password: ownerPassword,
      disabled: false,
    });
    await auth.setCustomUserClaims(existing.uid, {
      tenantId,
      role: "owner",
    });

    return existing.uid;
  } catch (error) {
    if (errorCode(error) !== "auth/user-not-found") {
      throw error;
    }

    const created = await auth.createUser({
      email: ownerEmail,
      password: ownerPassword,
      emailVerified: true,
      disabled: false,
    });

    await auth.setCustomUserClaims(created.uid, {
      tenantId,
      role: "owner",
    });

    return created.uid;
  }
}

async function seed(): Promise<void> {
  const tenants = new TenantRepository(getDb());

  await tenants.create(tenantId, tenant);
  const uid = await upsertOwnerUser();

  console.log("Seed complete.");
  console.log(`Tenant: ${tenantId}`);
  console.log(`Owner UID: ${uid}`);
  console.log(`Email: ${ownerEmail}`);
  console.log(`Password: ${ownerPassword}`);
}

await seed();
