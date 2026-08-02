import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const BUDGET_PATH = join(process.cwd(), 'budget.json');
const SCRIPT_PATH = join(process.cwd(), 'scripts', 'check-bundle-size.ts');
const DIST_ASSETS = join(process.cwd(), 'apps', 'desktop', 'dist', 'assets');

let originalBudget = '';

function runCheck() {
  const result = spawnSync('bun', ['run', SCRIPT_PATH], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  return {
    stdout: (result.stdout ?? '') + (result.stderr ?? ''),
    exitCode: result.status ?? 1,
  };
}

describe('check-bundle-size', () => {
  beforeEach(() => {
    if (!existsSync(DIST_ASSETS)) {
      return;
    }
    try {
      originalBudget = readFileSync(BUDGET_PATH, 'utf-8');
    } catch {
      originalBudget = '';
    }
  });

  afterEach(() => {
    if (originalBudget) {
      writeFileSync(BUDGET_PATH, originalBudget);
    }
  });

  it('passes when all sizes are within budget', () => {
    if (!existsSync(DIST_ASSETS)) return;
    const result = runCheck();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('PASS');
  });

  it('fails when a single chunk exceeds maxChunkSizeKB', () => {
    if (!existsSync(DIST_ASSETS)) return;
    const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf-8'));
    writeFileSync(BUDGET_PATH, JSON.stringify({ ...budget, maxChunkSizeKB: 1 }));

    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('FAIL');
    expect(result.stdout).toContain('Largest JS chunk');
  });

  it('fails when total JS exceeds maxTotalJSKB', () => {
    if (!existsSync(DIST_ASSETS)) return;
    const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf-8'));
    writeFileSync(BUDGET_PATH, JSON.stringify({ ...budget, maxTotalJSKB: 100 }));

    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('FAIL');
    expect(result.stdout).toContain('Total JS size');
  });

  it('shows friendly error when budget.json is missing', () => {
    if (!existsSync(DIST_ASSETS)) return;
    const budget = readFileSync(BUDGET_PATH, 'utf-8');
    rmSync(BUDGET_PATH);

    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('budget.json not found');

    writeFileSync(BUDGET_PATH, budget);
  });

  it('outputs chunk analysis report', () => {
    if (!existsSync(DIST_ASSETS)) return;
    const result = runCheck();
    expect(result.stdout).toContain('Chunk Analysis Report');
    expect(result.stdout).toContain('End Chunk Report');
  });

  it('fails when vendor chunk exceeds its budget', () => {
    if (!existsSync(DIST_ASSETS)) return;
    const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf-8'));
    writeFileSync(BUDGET_PATH, JSON.stringify({
      ...budget,
      vendorChunks: {
        react: { maxKB: 1, patterns: ['react', 'react-dom'] },
      },
    }));

    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('FAIL');
    expect(result.stdout).toContain('Vendor chunk');
  });
});
