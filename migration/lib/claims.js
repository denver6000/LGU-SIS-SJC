"use strict";

const { getAuth } = require("./firebase-admin-client");

function parseJsonValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function getUserByEmailOrThrow(email) {
  if (!email) {
    throw new Error("An email address is required.");
  }

  return getAuth().getUserByEmail(String(email).trim());
}

async function updateClaimsByEmail(email, transformClaims) {
  const auth = getAuth();
  const user = await getUserByEmailOrThrow(email);
  const currentClaims = user.customClaims || {};
  const nextClaims = transformClaims({ ...currentClaims });

  await auth.setCustomUserClaims(user.uid, nextClaims);

  return {
    email: user.email,
    uid: user.uid,
    before: currentClaims,
    after: nextClaims
  };
}

async function addAdminCustomClaims(email) {
  return updateClaimsByEmail(email, (claims) => ({
    ...claims,
    admin: true,
    role: "admin"
  }));
}

async function removeAdminCustomClaims(email) {
  return updateClaimsByEmail(email, (claims) => {
    const nextClaims = { ...claims };
    delete nextClaims.admin;
    if (nextClaims.role === "admin") {
      delete nextClaims.role;
    }
    return nextClaims;
  });
}

async function setCustomClaim(email, key, value) {
  if (!key) {
    throw new Error("A custom claim key is required.");
  }

  return updateClaimsByEmail(email, (claims) => ({
    ...claims,
    [key]: parseJsonValue(value)
  }));
}

module.exports = {
  addAdminCustomClaims,
  removeAdminCustomClaims,
  setCustomClaim
};
