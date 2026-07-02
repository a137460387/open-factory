#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DESKTOP_DIR = path.join(ROOT_DIR, 'apps', 'desktop');
const DEFAULT_URL = process.env.OPEN_FACTORY_STRESS_URL ?? 'http://localhost:1420';
const DEFAULT_PROJECT_PATH = 'C:/Projects/stress-200.cutproj.json';
const DEFAULT_REPORT_PATH = path.join(ROOT_DIR, 'stress-test-report.json');

const DEFAULT_STRESS_THRESHOLDS = Object.freeze({
  initialRenderMs: 2_000,
  memoryMb: 500
});

export function createStressProjectFile(options = {}) {
  const clipCount = normalizePositiveInteger(options.clipCount, 200);
  const clipDuration = normalizePositiveNumber(options.clipDuration, 1.5);
  const gapDuration = normalizeNonNegativeNumber(options.gapDuration, 0.25);
  const fps = normalizePositiveInteger(options.fps, 30);
  const assetPath = typeof options.assetPath === 'string' && options.assetPath.trim() ? options.assetPath : 'C:/Media/tiny-video.mp4';
  const now = '2026-06-12T00:00:00.000Z';
  const trackId = 'track-stress-video';
  const mediaId = 'media-stress-video';
  const clips = Array.from({ length: clipCount }, (_, index) => {
    const start = round(index * (clipDuration + gapDuration));
    return {
      id: `clip-stress-${String(index).padStart(4, '0')}`,
      type: 'video',
      name: `Stress clip ${index + 1}`,
      mediaId,
      trackId,
      start,
      duration: clipDuration,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      volume: 1
    };
  });
  const timeline = {
    transitions: [],
    markers: [],
    tracks: [
      { id: trackId, type: 'video', name: 'Stress Video', clips },
      { id: 'track-stress-audio', type: 'audio', name: 'Audio 1', clips: [] },
      { id: 'track-stress-text', type: 'text', name: 'Text 1', clips: [] }
    ]
  };

  return {
    schemaVersion: 2,
    project: {
      id: 'project-stress-200',
      name: 'Stress Test 200 Clips',
      createdAt: now,
      updatedAt: now,
      masterVolume: 1,
      settings: { fps, width: 1280, height: 720 },
      media: [
        {
          id: mediaId,
          type: 'video',
          name: path.basename(assetPath),
          path: assetPath,
          relativePath: '../Media/tiny-video.mp4',
          originalAbsolutePath: assetPath,
          duration: Math.max(clipDuration, 6),
          width: 1280,
          height: 720,
          missing: false,
          size: 4096,
          mtimeMs: 1_000,
          hasAudio: true,
          audioChannels: 2,
          audioSampleRate: 44_100,
          audioCodec: 'aac',
          videoCodec: 'h264'
        }
      ],
      mediaMetadata: {},
      annotations: [],
      timeline,
      sequences: [{ id: 'sequence-main', name: 'Main Sequence', timeline }],
      activeSequenceId: 'sequence-main'
    }
  };
}

export function createStressReport(input) {
  const totalClipCount = normalizePositiveInteger(input.totalClipCount, 0);
  const renderedClipCount = normalizeNonNegativeNumber(input.renderedClipCount, 0);
  const initialRenderMs = round(input.initialRenderMs ?? 0, 2);
  const scrollElapsedMs = round(input.scrollElapsedMs ?? 0, 2);
  const scrollFrameCount = normalizeNonNegativeNumber(input.scrollFrameCount, 0);
  const scrollFps = scrollElapsedMs > 0 ? round((scrollFrameCount / scrollElapsedMs) * 1000, 2) : 0;
  const memoryMb = round(input.memoryBytes / (1024 * 1024), 2);
  const thresholds = { ...DEFAULT_STRESS_THRESHOLDS, ...(input.thresholds ?? {}) };

  return {
    generatedAt: new Date().toISOString(),
    projectPath: input.projectPath,
    clipCount: totalClipCount,
    thresholds,
    metrics: {
      timelineInitialRenderMs: initialRenderMs,
      renderedClipCount,
      totalClipCount,
      scrollElapsedMs,
      scrollFrameCount,
      scrollFps,
      usedJsHeapSizeMb: memoryMb
    },
    assertions: {
      initialRenderUnderThreshold: initialRenderMs < thresholds.initialRenderMs,
      memoryUnderThreshold: memoryMb < thresholds.memoryMb
    }
  };
}

export function assertStressReport(report) {
  const failures = [];
  if (!report.assertions.initialRenderUnderThreshold) {
    failures.push(`timeline initial render ${report.metrics.timelineInitialRenderMs}ms >= ${report.thresholds.initialRenderMs}ms`);
  }
  if (!report.assertions.memoryUnderThreshold) {
    failures.push(`JS heap ${report.metrics.usedJsHeapSizeMb}MB >= ${report.thresholds.memoryMb}MB`);
  }
  if (report.metrics.totalClipCount !== report.clipCount || report.clipCount <= 0) {
    failures.push(`invalid clip count ${report.metrics.totalClipCount}`);
  }
  if (report.metrics.renderedClipCount <= 0) {
    failures.push('no timeline clips rendered');
  }
  if (failures.length > 0) {
    throw new Error(`Stress test failed: ${failures.join('; ')}`);
  }
}

async function runStressTest(options = {}) {
  const url = options.url ?? DEFAULT_URL;
  const projectPath = options.projectPath ?? DEFAULT_PROJECT_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
  const clipCount = normalizePositiveInteger(options.clipCount, 200);
  const server = await ensureDevServer(url);
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const projectFile = createStressProjectFile({ clipCount });
    const projectJson = JSON.stringify(projectFile, null, 2);

    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.__E2E_ACTIONS__), null, { timeout: 15_000 });
    await page.evaluate(
      ({ path, contents }) => {
        window.__E2E_ACTIONS__.clearE2eFiles();
        window.__E2E_ACTIONS__.setMockFile(path, contents);
        window.__E2E_ACTIONS__.setOpenFileDialogPaths([path]);
      },
      { path: projectPath, contents: projectJson }
    );

    const renderStart = await page.evaluate(() => performance.now());
    await page.getByTestId('toolbar-open-project-button').click();
    await page.waitForFunction(
      (expectedCount) => {
        const actions = window.__E2E_ACTIONS__;
        const snapshot = actions?.getTimelineSnapshot?.();
        const clips = snapshot?.tracks?.flatMap((track) => track.clips ?? []) ?? [];
        return clips.length === expectedCount && document.querySelectorAll('[data-testid^="timeline-clip-"]').length > 0;
      },
      clipCount,
      { timeout: 15_000 }
    );
    const initialRenderMs = await page.evaluate((start) => performance.now() - start, renderStart);
    const renderedClipCount = await page.locator('[data-testid^="timeline-clip-"]').count();
    const scrollMetrics = await measureTimelineScroll(page);
    const memoryBytes = await readJsHeapBytes(page);
    const report = createStressReport({
      projectPath,
      totalClipCount: clipCount,
      renderedClipCount,
      initialRenderMs,
      scrollElapsedMs: scrollMetrics.elapsedMs,
      scrollFrameCount: scrollMetrics.frameCount,
      memoryBytes
    });

    assertStressReport(report);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return report;
  } finally {
    await browser.close();
    await server.close();
  }
}

async function measureTimelineScroll(page) {
  return page.evaluate(async () => {
    const scroll = document.querySelector('[data-testid="timeline-scroll-container"]');
    if (!(scroll instanceof HTMLElement)) {
      throw new Error('Timeline scroll container not found.');
    }
    const maxScrollLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    const durationMs = 1_000;
    return new Promise((resolve) => {
      let frameCount = 0;
      const start = performance.now();
      const step = (now) => {
        frameCount += 1;
        const progress = Math.min(1, (now - start) / durationMs);
        scroll.scrollLeft = maxScrollLeft * progress;
        scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
        if (progress < 1) {
          requestAnimationFrame(step);
          return;
        }
        resolve({ frameCount, elapsedMs: performance.now() - start });
      };
      requestAnimationFrame(step);
    });
  });
}

async function readJsHeapBytes(page) {
  await page.evaluate(() => window.gc?.());
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  const response = await client.send('Performance.getMetrics');
  const heapMetric = response.metrics.find((metric) => metric.name === 'JSHeapUsedSize');
  await client.detach();
  if (heapMetric && Number.isFinite(heapMetric.value)) {
    return heapMetric.value;
  }
  const browserMemory = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  if (Number.isFinite(browserMemory) && browserMemory > 0) {
    return browserMemory;
  }
  throw new Error('Unable to read JS heap usage from Chromium.');
}

async function ensureDevServer(url) {
  if (await isUrlReady(url)) {
    return { close: async () => undefined };
  }
  if (!existsSync(DESKTOP_DIR)) {
    throw new Error(`Desktop app directory not found: ${DESKTOP_DIR}`);
  }
  const command = process.platform === 'win32' ? 'bun.exe' : 'bun';
  const child = spawn(command, ['run', 'dev', '--', '--host', 'localhost'], {
    cwd: DESKTOP_DIR,
    env: { ...process.env, VITE_E2E: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));
  await waitForServer(url, logs, child);
  return {
    close: async () => {
      await terminateProcessTree(child);
    }
  };
}

async function waitForServer(url, logs, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    if (child.exitCode !== null) {
      throw new Error(`Vite dev server exited early.\n${logs.join('')}`);
    }
    if (await isUrlReady(url)) {
      return;
    }
    await wait(250);
  }
  await terminateProcessTree(child);
  throw new Error(`Timed out waiting for ${url}.\n${logs.join('')}`);
}

async function terminateProcessTree(child) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      killer.on('exit', resolve);
      killer.on('error', resolve);
    });
  } else {
    child.kill('SIGTERM');
  }
  await waitForProcessExit(child, 5_000);
}

async function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return;
  }
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
      resolve();
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function isUrlReady(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

function normalizePositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizePositiveNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeNonNegativeNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMainModule() {
  const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
  return import.meta.url === entry;
}

if (isMainModule()) {
  runStressTest()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
