#!/usr/bin/env node
"use strict";

const { setCustomClaim } = require("../lib/claims");
const { printResult, runCli } = require("../lib/cli");

const usage = [
  "Usage:",
  "  npm run set_custom_claim -- email@gmail.com claimKey claimValue",
  "  npx --prefix migration set_custom_claim email@gmail.com claimKey claimValue",
  "",
  "Examples:",
  "  npm run set_custom_claim -- email@gmail.com admin true",
  "  npm run set_custom_claim -- email@gmail.com permissions '[\"export\",\"delete\"]'"
];

runCli(async () => {
  const email = process.argv[2];
  const key = process.argv[3];
  const value = process.argv[4];
  const result = await setCustomClaim(email, key, value);
  printResult("set_custom_claim", result);
}, usage);
