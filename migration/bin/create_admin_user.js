#!/usr/bin/env node
"use strict";

const { createUserWithAdminClaims } = require("../lib/claims");
const { printResult, runCli } = require("../lib/cli");

const usage = [
  "Usage:",
  "  npm run create_admin_user -- email@gmail.com password123",
  "  npx --prefix migration create_admin_user email@gmail.com password123"
];

runCli(async () => {
  const email = process.argv[2];
  const password = process.argv[3];
  
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  
  const result = await createUserWithAdminClaims(email, password);
  printResult("create_admin_user", result);
}, usage);
