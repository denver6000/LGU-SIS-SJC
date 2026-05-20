#!/usr/bin/env node
"use strict";

const { removeAdminCustomClaims } = require("../lib/claims");
const { printResult, runCli } = require("../lib/cli");

const usage = [
  "Usage:",
  "  npm run remove_admin_custom_claims -- email@gmail.com",
  "  npx --prefix migration remove_admin_custom_claims email@gmail.com"
];

runCli(async () => {
  const email = process.argv[2];
  const result = await removeAdminCustomClaims(email);
  printResult("remove_admin_custom_claims", result);
}, usage);
