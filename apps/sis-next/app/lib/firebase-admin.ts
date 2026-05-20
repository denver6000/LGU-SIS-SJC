import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "node:fs";
import path from "node:path";

type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function serviceAccountFromFile() {
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!configuredPath) return null;

  const serviceAccountPath = path.resolve(process.cwd(), configuredPath);
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")) as ServiceAccountJson;

  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key
  };
}

function serviceAccountFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    projectId,
    clientEmail,
    privateKey
  };
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = serviceAccountFromEnv() || serviceAccountFromFile();
  if (!serviceAccount) {
    return initializeApp({
      credential: applicationDefault()
    });
  }

  return initializeApp({
    credential: cert(serviceAccount)
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
