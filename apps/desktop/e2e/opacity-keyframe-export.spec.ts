import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports opacity keyframes with visibly darker end frames', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const sourcePath = testInfo.outputPath('opacity-source.mp4');
  const outputPath = testInfo.outputPath('opacity-output.mp4');
  await createWhiteVideoFixture(sourcePath);

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((mediaPath) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([mediaPath]), normalizePath(sourcePath));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  const clipId = await clip.getAttribute('data-clip-id');
  expect(clipId).toBeTruthy();

  await page.evaluate((id) => {
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'opacity', 0, 1);
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'opacity', 1, 0);
  }, clipId);
  await expect(page.locator(`[data-testid^="timeline-keyframe-${clipId}-opacity-"]`)).toHaveCount(2);

  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill(normalizePath(outputPath));
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[]; filterComplex: string });
  expect(plan.filterComplex).toContain('fade=t=out:st=0:d=1:alpha=1');

  await run('ffmpeg', plan.fullArgs);
  const startPixel = await readCenterPixel(outputPath, 0.1);
  const endPixel = await readCenterPixel(outputPath, 1.4);

  expect(rgbBrightness(startPixel)).toBeGreaterThan(rgbBrightness(endPixel) + 150);
});

async function createWhiteVideoFixture(targetPath: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await run('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=white:s=1280x720:r=30:d=6',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=44100:duration=6',
    '-shortest',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    targetPath
  ]);
}

async function readCenterPixel(videoPath: string, at: number): Promise<number[]> {
  const stdout = await run('ffmpeg', [
    '-hide_banner',
    '-v',
    'error',
    '-ss',
    String(at),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-vf',
    'crop=1:1:640:360,format=rgba',
    '-f',
    'rawvideo',
    '-'
  ]);
  expect(stdout.length).toBeGreaterThanOrEqual(4);
  return Array.from(stdout.subarray(0, 4));
}

function run(command: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${command} failed: ${stderr.toString()}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function rgbBrightness(pixel: number[]): number {
  return pixel[0] + pixel[1] + pixel[2];
}
