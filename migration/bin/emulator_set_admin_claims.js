#!/usr/bin/env node
"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

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

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Usage: npm run emulator:set-admin-claims -- email@gmail.com");
    process.exit(1);
  }

  // Initialize app with emulator
  const serviceAccountPath = resolveServiceAccountPath();
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "lgus-sjc-scholarship"
  });

  const auth = admin.auth(app);

  // Connect to Auth Emulator
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

  try {
    // Get user by email
    const user = await auth.getUserByEmail(email);
    console.log(`Found user: ${user.uid}`);

    // Set custom claims
    await auth.setCustomUserClaims(user.uid, {
      admin: true,
      role: "admin"
    });

    console.log(`✓ Added admin claims to ${email}`);
    console.log(`UID: ${user.uid}`);
    console.log(`Claims: { admin: true, role: "admin" }`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  process.exit(0);
}

main();
