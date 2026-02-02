import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import chokidar from "chokidar";

const require = createRequire(import.meta.url);

const packageJsonPath = require.resolve("@mml-io/mml-cli/package.json");
const cliPackageDir = path.dirname(packageJsonPath);
const cliEntryPath = path.join(cliPackageDir, "build", "index.js");
const cliWatchDir = path.join(cliPackageDir, "build");

let childProcess: ChildProcess | null = null;
let shuttingDown = false;
let restarting = false;
let restartQueued = false;
let restartTimer: NodeJS.Timeout | null = null;

const restartDelayMs = 200;
const killTimeoutMs = 5000;

function startMmlDev(): void {
  if (!fs.existsSync(cliEntryPath)) {
    console.error(`[iterate] mml CLI build not found at ${cliEntryPath}`);
    process.exit(1);
  }

  console.log("[iterate] Starting mml dev...");
  childProcess = spawn(process.execPath, [cliEntryPath, "dev"], {
    stdio: "inherit",
    env: process.env,
  });

  childProcess.on("exit", (code, signal) => {
    if (shuttingDown || restarting) {
      return;
    }

    if (signal) {
      console.error(`[iterate] mml dev exited with signal ${signal}`);
      process.exit(1);
    }

    process.exit(code ?? 0);
  });
}

function stopMmlDev(): Promise<void> {
  if (!childProcess) {
    return Promise.resolve();
  }

  const activeProcess = childProcess;
  childProcess = null;

  return new Promise((resolve) => {
    const killTimer = setTimeout(() => {
      if (!activeProcess.killed) {
        activeProcess.kill("SIGKILL");
      }
    }, killTimeoutMs);

    activeProcess.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });

    activeProcess.kill("SIGTERM");
  });
}

async function restartMmlDev(reason?: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  if (restarting) {
    restartQueued = true;
    return;
  }

  restarting = true;
  console.log(`[iterate] Restarting mml dev${reason ? ` (${reason})` : ""}...`);
  await stopMmlDev();
  restarting = false;

  startMmlDev();

  if (restartQueued) {
    restartQueued = false;
    await restartMmlDev(reason);
  }
}

function scheduleRestart(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    void restartMmlDev("mml CLI updated");
  }, restartDelayMs);
}

const watcher = chokidar.watch(cliWatchDir, {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 50,
  },
});

watcher.on("add", scheduleRestart);
watcher.on("change", scheduleRestart);
watcher.on("unlink", scheduleRestart);

async function handleShutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`[iterate] Shutting down (${signal})...`);
  await watcher.close();
  await stopMmlDev();
  process.exit(0);
}

process.on("SIGINT", () => {
  void handleShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void handleShutdown("SIGTERM");
});

startMmlDev();
