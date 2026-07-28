import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';

interface VendorChunkBudget {
  maxKB: number;
  patterns: string[];
}

interface Budget {
  maxChunkSizeKB: number;
  maxTotalJSKB: number;
  maxTotalCSSKB: number;
  vendorChunks?: Record<string, VendorChunkBudget>;
}

interface FileInfo {
  name: string;
  sizeKB: number;
}

function loadBudget(): Budget {
  try {
    const raw = readFileSync(join(process.cwd(), 'budget.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    console.log('ERROR: budget.json not found or invalid. Create budget.json in project root.');
    process.exit(1);
  }
}

function getFiles(dir: string, ext: string): FileInfo[] {
  try {
    return readdirSync(dir)
      .filter((f) => extname(f) === ext)
      .map((f) => ({
        name: f,
        sizeKB: Math.round(statSync(join(dir, f)).size / 1024),
      }));
  } catch {
    console.log(`ERROR: Cannot read directory ${dir}. Run build first.`);
    process.exit(1);
  }
}

function matchVendorChunk(fileName: string, vendorChunks: Record<string, VendorChunkBudget>): string | null {
  const lower = fileName.toLowerCase();
  for (const [name, config] of Object.entries(vendorChunks)) {
    if (config.patterns.some((p) => lower.includes(p))) {
      return name;
    }
  }
  return null;
}

function printChunkReport(jsFiles: FileInfo[], budget: Budget): void {
  console.log('\n--- Chunk Analysis Report ---');
  console.log(`${'Chunk'.padEnd(50)} ${'Size (KB)'.padStart(10)} ${'Budget'.padStart(10)} ${'Status'.padStart(8)}`);
  console.log('-'.repeat(82));

  const sorted = [...jsFiles].sort((a, b) => b.sizeKB - a.sizeKB);
  for (const f of sorted) {
    const vendor = budget.vendorChunks ? matchVendorChunk(f.name, budget.vendorChunks) : null;
    const vendorBudget = vendor && budget.vendorChunks ? budget.vendorChunks[vendor].maxKB : null;
    const globalStatus = f.sizeKB > budget.maxChunkSizeKB ? 'FAIL' : 'OK';
    const vendorStatus = vendorBudget && f.sizeKB > vendorBudget ? 'FAIL' : '';
    const status = globalStatus === 'FAIL' || vendorStatus === 'FAIL' ? 'FAIL' : 'OK';
    const budgetLabel = vendorBudget ? `${vendorBudget} (${vendor})` : `${budget.maxChunkSizeKB} (global)`;
    console.log(`${f.name.padEnd(50)} ${String(f.sizeKB).padStart(10)} ${budgetLabel.padStart(10)} ${status.padStart(8)}`);
  }

  if (budget.vendorChunks) {
    console.log('\n--- Vendor Chunk Summary ---');
    for (const [name, config] of Object.entries(budget.vendorChunks)) {
      const vendorFiles = jsFiles.filter((f) => matchVendorChunk(f.name, budget.vendorChunks!) === name);
      const totalKB = vendorFiles.reduce((sum, f) => sum + f.sizeKB, 0);
      const status = totalKB > config.maxKB ? 'FAIL' : 'OK';
      console.log(`${name.padEnd(20)} ${String(totalKB).padStart(8)} KB / ${String(config.maxKB).padStart(6)} KB  ${status}`);
    }
  }
  console.log('--- End Chunk Report ---\n');
}

function checkBundleSize(): void {
  const budget = loadBudget();
  const distAssets = join(process.cwd(), 'apps', 'desktop', 'dist', 'assets');

  const jsFiles = getFiles(distAssets, '.js');
  const cssFiles = getFiles(distAssets, '.css');

  const totalJS = jsFiles.reduce((sum, f) => sum + f.sizeKB, 0);
  const totalCSS = cssFiles.reduce((sum, f) => sum + f.sizeKB, 0);
  const largestChunk = jsFiles.reduce((max, f) => (f.sizeKB > max.sizeKB ? f : max), { name: '', sizeKB: 0 });

  let failed = false;

  if (largestChunk.sizeKB > budget.maxChunkSizeKB) {
    console.log(`FAIL: Largest JS chunk ${largestChunk.name} is ${largestChunk.sizeKB}KB (budget: ${budget.maxChunkSizeKB}KB)`);
    failed = true;
  }

  if (totalJS > budget.maxTotalJSKB) {
    console.log(`FAIL: Total JS size ${totalJS}KB exceeds budget ${budget.maxTotalJSKB}KB`);
    failed = true;
  }

  if (totalCSS > budget.maxTotalCSSKB) {
    console.log(`FAIL: Total CSS size ${totalCSS}KB exceeds budget ${budget.maxTotalCSSKB}KB`);
    failed = true;
  }

  // Check per-vendor-chunk budgets
  if (budget.vendorChunks) {
    for (const [name, config] of Object.entries(budget.vendorChunks)) {
      const vendorFiles = jsFiles.filter((f) => matchVendorChunk(f.name, budget.vendorChunks!) === name);
      const vendorTotal = vendorFiles.reduce((sum, f) => sum + f.sizeKB, 0);
      if (vendorTotal > config.maxKB) {
        console.log(`FAIL: Vendor chunk "${name}" is ${vendorTotal}KB (budget: ${config.maxKB}KB)`);
        failed = true;
      }
    }
  }

  console.log(`JS chunks: ${jsFiles.length} files, ${totalJS}KB total (budget: ${budget.maxTotalJSKB}KB)`);
  console.log(`Largest chunk: ${largestChunk.name} at ${largestChunk.sizeKB}KB (budget: ${budget.maxChunkSizeKB}KB)`);
  console.log(`CSS: ${cssFiles.length} files, ${totalCSS}KB total (budget: ${budget.maxTotalCSSKB}KB)`);

  printChunkReport(jsFiles, budget);

  if (failed) {
    process.exit(1);
  }
  console.log('PASS: All bundle sizes within budget.');
}

checkBundleSize();
