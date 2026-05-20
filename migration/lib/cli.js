"use strict";

function printUsage(lines) {
  console.error(lines.join("\n"));
}

async function runCli(task, usageLines) {
  try {
    await task();
    process.exit(0);
  } catch (error) {
    if (error && /required/i.test(String(error.message || ""))) {
      printUsage(usageLines);
    }
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function printResult(label, result) {
  console.log(`${label} completed.`);
  console.log(`Email: ${result.email}`);
  console.log(`UID: ${result.uid}`);
  console.log(`Previous claims: ${JSON.stringify(result.before)}`);
  console.log(`Updated claims: ${JSON.stringify(result.after)}`);
}

module.exports = {
  printResult,
  runCli
};
