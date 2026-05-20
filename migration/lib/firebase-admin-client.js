"use strict";

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const serviceAccountDir = path.join(__dirname, "..", "service-account");

function resolveServiceAccountPath() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  }

  if (!fs.existsSync(serviceAccountDir)) {
    throw new Error(`Missing service account directory: ${serviceAccountDir}`);
  }

  const candidates = fs
    .readdirSync(serviceAccountDir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort();

  if (!candidates.length) {
    throw new Error(`No service account JSON file found in ${serviceAccountDir}`);
  }

  return path.join(serviceAccountDir, candidates[0]);
}

function getApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccountPath = resolveServiceAccountPath();
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function getAuth() {
  return getApp().auth();
}

module.exports = {
  getAuth,
  resolveServiceAccountPath
};
