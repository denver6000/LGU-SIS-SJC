import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const nextBin = process.platform === "win32" ? "next.cmd" : "next";

const server = spawn(nextBin, ["start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
