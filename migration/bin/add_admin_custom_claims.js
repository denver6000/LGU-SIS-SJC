#!/usr/bin/env node
"use strict";

const { addAdminCustomClaims } = require("../lib/claims");
const { printResult, runCli } = require("../lib/cli");

const usage = [
  "Usage:",
  "  npm run add_admin_custom_claims -- email@gmail.com",
  "  npx --prefix migration add_admin_custom_claims email@gmail.com"
];

runCli(async () => {
  const email = process.argv[2];
  const result = await addAdminCustomClaims(email);
  printResult("add_admin_custom_claims", result);
}, usage);
