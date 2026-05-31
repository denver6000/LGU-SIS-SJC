export const APP_ENV = process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? "production";

export function isDevAppEnv() {
  return APP_ENV === "dev";
}

export const FIREBASE_EMULATOR_HOST = "127.0.0.1";
export const FIREBASE_AUTH_EMULATOR_PORT = 9099;
export const FIRESTORE_EMULATOR_PORT = 8080;
