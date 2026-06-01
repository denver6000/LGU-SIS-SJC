import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(import.meta.dirname, "..");
const standaloneRoot = path.join(appRoot, ".next", "standalone");
const target = path.join(standaloneRoot, "node_modules", "next");
const serverVendorChunksSource = path.join(appRoot, ".next", "server", "vendor-chunks");
const serverVendorChunksTarget = path.join(standaloneRoot, ".next", "server", "vendor-chunks");

if (!existsSync(standaloneRoot)) {
  process.exit(0);
}

const sourcePackageJson = require.resolve("next/package.json");
const source = path.dirname(sourcePackageJson);

mkdirSync(path.dirname(target), { recursive: true });
if (!existsSync(target)) {
  cpSync(source, target, { recursive: true });
  console.log(`Copied Next runtime into standalone output: ${target}`);
}

if (existsSync(serverVendorChunksSource) && !existsSync(serverVendorChunksTarget)) {
  mkdirSync(path.dirname(serverVendorChunksTarget), { recursive: true });
  cpSync(serverVendorChunksSource, serverVendorChunksTarget, { recursive: true });
  console.log(`Copied vendor chunks into standalone output: ${serverVendorChunksTarget}`);
}
