import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";

const FirebaseEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
});

export type FirebaseEnv = z.infer<typeof FirebaseEnvSchema>;

function parseFirebaseEnv(env: NodeJS.ProcessEnv = process.env): FirebaseEnv {
  const parsed = FirebaseEnvSchema.parse(env);

  if (!parsed.FIRESTORE_EMULATOR_HOST) {
    z.object({
      FIREBASE_CLIENT_EMAIL: z.string().min(1),
      FIREBASE_PRIVATE_KEY: z.string().min(1),
    }).parse(parsed);
  }

  return parsed;
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n");
}

export function initializeFirebaseAdmin(env: NodeJS.ProcessEnv = process.env): App {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const config = parseFirebaseEnv(env);

  if (config.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({
      projectId: config.FIREBASE_PROJECT_ID,
    });
  }

  return initializeApp({
    credential: cert({
      projectId: config.FIREBASE_PROJECT_ID,
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(config.FIREBASE_PRIVATE_KEY ?? ""),
    }),
  });
}

export function getDb(env: NodeJS.ProcessEnv = process.env): Firestore {
  return getFirestore(initializeFirebaseAdmin(env));
}

export function getAdminAuth(env: NodeJS.ProcessEnv = process.env): Auth {
  return getAuth(initializeFirebaseAdmin(env));
}
