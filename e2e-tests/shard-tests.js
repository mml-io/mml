#!/usr/bin/env node

/**
 * Test sharding utility for parallel e2e test execution
 * Uses modulo-based sharding to distribute tests across multiple workers
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment variables for sharding
const SHARD_INDEX = parseInt(process.env.JEST_SHARD_INDEX || '0', 10);
const SHARD_COUNT = parseInt(process.env.JEST_SHARD_COUNT || '1', 10);
const RENDERER = process.env.RENDERER || 'threejs';
const HEADLESS = process.env.HEADLESS || 'true';

if (SHARD_INDEX >= SHARD_COUNT) {
  console.error(`JEST_SHARD_INDEX (${SHARD_INDEX}) must be less than JEST_SHARD_COUNT (${SHARD_COUNT})`);
  process.exit(1);
}

if (SHARD_INDEX < 0 || SHARD_COUNT < 1) {
  console.error(`Invalid sharding parameters: JEST_SHARD_INDEX=${SHARD_INDEX}, JEST_SHARD_COUNT=${SHARD_COUNT}`);
  process.exit(1);
}

console.log(`Running shard ${SHARD_INDEX + 1}/${SHARD_COUNT} for renderer ${RENDERER} and headless=${HEADLESS}`);

// Find all test files
const testDir = path.join(__dirname, 'test');
const files = fs.readdirSync(testDir);
const testFiles = files
  .filter(file => file.endsWith('.test.ts'))
  .sort(); // Ensure consistent ordering across runs

console.log(`Found ${testFiles.length} test files total`);

// Apply modulo sharding
const shardedFiles = testFiles.filter((_, index) => {
  return index % SHARD_COUNT === SHARD_INDEX;
});

console.log(`Shard ${SHARD_INDEX + 1}/${SHARD_COUNT} will run ${shardedFiles.length} tests:`);
shardedFiles.forEach(file => console.log(`  - ${file}`));

if (shardedFiles.length === 0) {
  console.log('No tests assigned to this shard, exiting successfully');
  process.exit(0);
}

// Convert to full paths for Jest
const testPaths = shardedFiles.map(file => path.join(testDir, file));

// Run Jest with the sharded test files
const jestArgs = [
  '--runInBand',
  ...testPaths
];

console.log(`Running Jest with args: ${jestArgs.join(' ')}`);

const jestProcess = spawn('jest', jestArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    RENDERER,
    HEADLESS
  }
});

jestProcess.on('exit', (code) => {
  process.exit(code);
});
