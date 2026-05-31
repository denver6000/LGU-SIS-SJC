#!/usr/bin/env node
"use strict";

const { getAuth } = require("../lib/firebase-admin-client");

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    throw new Error("Usage: node ./migration/bin/ensure_emulator_admin_user.js email password");
  }

  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("FIREBASE_AUTH_EMULATOR_HOST must be set before running this script.");
  }

  const auth = getAuth();
  let user;

  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, {
      password,
      emailVerified: false
    });
    console.log(`Updated existing emulator user: ${user.uid}`);
  } catch (error) {
    if (error && error.code === "auth/user-not-found") {
      user = await auth.createUser({
        email,
        password,
        emailVerified: false
      });
      console.log(`Created emulator user: ${user.uid}`);
    } else {
      throw error;
    }
  }

  await auth.setCustomUserClaims(user.uid, {
    admin: true,
    role: "admin"
  });

  const hydrated = await auth.getUserByEmail(email);
  console.log(JSON.stringify({
    email: hydrated.email,
    uid: hydrated.uid,
    claims: hydrated.customClaims || {}
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
