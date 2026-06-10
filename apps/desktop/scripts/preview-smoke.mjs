import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseExecutablePath, requireReleaseExecutable, run, shouldSkipNativeAppSmoke, spawnProcess, waitForExitOrKill } from './smoke-platform.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const smokeDir = join(tmpdir(), 'open-factory-preview-smoke');
const originalFixturePath = join(smokeDir, 'proxy-original-fixture.mp4');
const proxyFixturePath = join(smokeDir, 'proxy-preview-640x360-fixture.mp4');
const reportPath = join(desktopDir, 'src-tauri', 'target', 'open-factory-preview-smoke-report.json');
const fixtureName = 'proxy-preview-original-export';
const expectedProxyCenterPixel = [47, 209, 126];

if (shouldSkipNativeAppSmoke('smoke:preview', reportPath)) {
  process.exit(0);
}
const executable = releaseExecutablePath(desktopDir);
requireReleaseExecutable(executable, 'bun run tauri:build');

mkdirSync(smokeDir, { recursive: true });
rmSync(reportPath, { force: true });
rmSync(originalFixturePath, { force: true });
rmSync(proxyFixturePath, { force: true });

await createPreviewFixture(originalFixturePath, { width: 1280, height: 720, duration: 1.5, color: '0x2fd17e' });
await createPreviewFixture(proxyFixturePath, { width: 640, height: 360, duration: 1.5, color: '0x2fd17e' });

const child = spawnProcess(executable, [], {
  env: {
    ...process.env,
    OPEN_FACTORY_PREVIEW_SMOKE: '1',
    OPEN_FACTORY_PREVIEW_SMOKE_FIXTURE_NAME: fixtureName,
    OPEN_FACTORY_PREVIEW_SMOKE_MEDIA: originalFixturePath,
    OPEN_FACTORY_PREVIEW_SMOKE_PROXY_MEDIA: proxyFixturePath,
    OPEN_FACTORY_PREVIEW_SMOKE_REPORT: reportPath
  },
  stdio: 'inherit'
});

const result = await waitForExitOrKill(child, 60_000);

if (!existsSync(reportPath)) {
  console.error(`Preview smoke report was not written: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const centerPixel = report.preview?.centerPixel ?? report.preview?.lateCanvasPixel;
const assertions = {
  exitCode: result.exitCode,
  timedOut: result.timedOut,
  expectedProxyCenterPixel,
  centerPixel,
  centerPixelWithinTolerance: pixelNear(centerPixel, expectedProxyCenterPixel, 10),
  proxyUsed: report.preview?.proxyUsed === true,
  originalImported: report.asset?.width === 1280 && report.asset?.height === 720,
  proxyResolution: report.preview?.proxyWidth === 640 && report.preview?.proxyHeight === 360
};
console.log(JSON.stringify({ ...report, assertions }, null, 2));

const passed =
  result.exitCode === 0 &&
  !result.timedOut &&
  report.success === true &&
  report.fixtureName === fixtureName &&
  report.convertFileSrcUsed === true &&
  report.timeline?.clipAdded === true &&
  report.timeline?.clipType === 'video' &&
  report.preview?.videoFrameDrawn === true &&
  report.preview?.pixelReadbackAvailable === true &&
  report.preview?.hasNonBackgroundPixels === true &&
  report.preview?.sourceKinds?.includes('video') &&
  report.preview?.proxyUsed === true &&
  assertions.originalImported === true &&
  assertions.proxyResolution === true &&
  assertions.centerPixelWithinTolerance === true;

if (!passed) {
  process.exit(1);
}

async function createPreviewFixture(outputPath, options) {
  const args = [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${options.color}:s=${options.width}x${options.height}:r=30:d=${formatSeconds(options.duration)}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=660:sample_rate=44100:duration=${formatSeconds(options.duration)}`,
    '-shortest',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath
  ];
  const exitCode = await run('ffmpeg', args);
  if (exitCode !== 0 || !existsSync(outputPath)) {
    throw new Error('Unable to create preview smoke fixture with ffmpeg.');
  }
}

function pixelNear(pixel, expectedRgb, tolerance) {
  if (!pixel || pixel.length < 4 || pixel[3] < 200) {
    return false;
  }
  return expectedRgb.every((channel, index) => Math.abs(pixel[index] - channel) <= tolerance);
}

function formatSeconds(value) {
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}
