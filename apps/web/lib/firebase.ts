import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "clinic-ai-local";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "local-dev-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:000000000000:web:local",
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

if (!app) {
  throw new Error("Firebase app initialization failed.");
}

export const auth = getAuth(app);
let isAuthEmulatorConnected = false;

if (
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST &&
  typeof window !== "undefined" &&
  !isAuthEmulatorConnected
) {
  connectAuthEmulator(auth, process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST, {
    disableWarnings: true,
  });
  isAuthEmulatorConnected = true;
}
