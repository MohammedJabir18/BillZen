#!/usr/bin/env node

/**
 * Portable Native Catalog Persistence Probe Runner
 *
 * Runs the multi-process catalog persistence probe in an isolated,
 * cross-platform temporary directory (POSIX, Windows, macOS) and
 * ensures clean teardown without leaving behind database artifacts.
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');

console.log('=== BillZen Native Cross-Process Persistence Probe ===');
console.log(`Platform: ${os.platform()} (${os.arch()})`);

// Create isolated temporary directory
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billzen-probe-'));
const dbPath = path.join(tempDir, 'catalog_probe.db');
console.log(`Isolated temporary database path: ${dbPath}`);

function runCargoPhase(phase) {
  console.log(`\n>>> Launching Process Phase: [${phase}]`);
  const result = spawnSync(
    'cargo',
    ['run', '--bin', 'catalog_probe', '--manifest-path', manifestPath, '--', dbPath, phase],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, RUST_BACKTRACE: '1' },
    }
  );

  if (result.error) {
    throw new Error(`Failed to execute cargo for phase '${phase}': ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Phase '${phase}' failed with exit code ${result.status}`);
  }

  console.log(`<<< Process Phase [${phase}] completed successfully.`);
}

let success = false;
try {
  // Phase 1: Write initial records in Process 1
  runCargoPhase('write');

  // Verify file was written to disk
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Expected database file at ${dbPath} was not created`);
  }

  // Phase 2: Relaunch separate Process 2, reopen database, audit persistence & integrity
  runCargoPhase('read_and_verify');

  success = true;
  console.log('\n[PASS] Cross-process persistence probe verified successfully.');
} catch (err) {
  console.error('\n[FAIL] Cross-process persistence probe error:', err.message);
  process.exitCode = 1;
} finally {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`Cleaned up temporary probe directory: ${tempDir}`);
    }
  } catch (cleanErr) {
    console.warn(`Warning: Failed to clean up ${tempDir}:`, cleanErr.message);
  }
}

if (!success) {
  process.exit(1);
}
