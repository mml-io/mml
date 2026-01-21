#!/usr/bin/env node

/**
 * Test sharding utility for parallel e2e test execution
 * Uses modulo-based sharding to distribute tests across multiple workers
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment variables for sharding
const SHARD_INDEX = parseInt(
  process.env.VITEST_SHARD_INDEX || process.env.JEST_SHARD_INDEX || "0",
  10,
);
const SHARD_COUNT = parseInt(
  process.env.VITEST_SHARD_COUNT || process.env.JEST_SHARD_COUNT || "1",
  10,
);
const RENDERER = process.env.RENDERER || "threejs";
const HEADLESS = process.env.HEADLESS || "true";

if (SHARD_INDEX >= SHARD_COUNT) {
  console.error(
    `VITEST_SHARD_INDEX (${SHARD_INDEX}) must be less than VITEST_SHARD_COUNT (${SHARD_COUNT})`,
  );
  process.exit(1);
}

if (SHARD_INDEX < 0 || SHARD_COUNT < 1) {
  console.error(
    `Invalid sharding parameters: VITEST_SHARD_INDEX=${SHARD_INDEX}, VITEST_SHARD_COUNT=${SHARD_COUNT}`,
  );
  process.exit(1);
}

console.log(
  `Running shard ${SHARD_INDEX + 1}/${SHARD_COUNT} for renderer ${RENDERER} and headless=${HEADLESS}`,
);

// Find all test files
const testDir = path.join(__dirname, "test");
const files = fs.readdirSync(testDir);
const testFiles = files.filter((file) => file.endsWith(".test.ts")).sort(); // Ensure consistent ordering across runs

console.log(`Found ${testFiles.length} test files total`);

// Apply modulo sharding
const shardedFiles = testFiles.filter((_, index) => {
  return index % SHARD_COUNT === SHARD_INDEX;
});

console.log(`Shard ${SHARD_INDEX + 1}/${SHARD_COUNT} will run ${shardedFiles.length} tests:`);
shardedFiles.forEach((file) => console.log(`  - ${file}`));

if (shardedFiles.length === 0) {
  console.log("No tests assigned to this shard, exiting successfully");
  process.exit(0);
}

// Convert to full paths for Vitest, using forward slashes for cross-platform compatibility
const testPaths = shardedFiles.map((file) => path.join(testDir, file).replace(/\\/g, "/"));

// Run Vitest with the sharded test files
const vitestArgs = ["run", ...testPaths];

console.log(`Running Vitest with args: ${vitestArgs.join(" ")}`);

const vitestProcess = spawn("vitest", vitestArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    RENDERER,
    HEADLESS,
  },
  shell: true,
});

vitestProcess.on("exit", (code) => {
  process.exit(code);
});
