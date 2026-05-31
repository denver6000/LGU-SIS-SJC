"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import {
  FIREBASE_AUTH_EMULATOR_PORT,
  FIREBASE_EMULATOR_HOST,
  FIRESTORE_EMULATOR_PORT,
  isDevAppEnv
} from "./shared/app-env";

function requiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required Firebase client environment variable: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: requiredEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: requiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: requiredEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: requiredEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: requiredEnv("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);

let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

if (isDevAppEnv()) {
  if (!authEmulatorConnected) {
    connectAuthEmulator(
      firebaseAuth,
      `http://${FIREBASE_EMULATOR_HOST}:${FIREBASE_AUTH_EMULATOR_PORT}`,
      { disableWarnings: true }
    );
    authEmulatorConnected = true;
  }

  if (!firestoreEmulatorConnected) {
    connectFirestoreEmulator(
      firebaseDb,
      FIREBASE_EMULATOR_HOST,
      FIRESTORE_EMULATOR_PORT
    );
    firestoreEmulatorConnected = true;
  }
}
