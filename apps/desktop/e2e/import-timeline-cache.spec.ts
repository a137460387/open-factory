import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('imports media, adds clips, shows waveform, and clears cache', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();

  const mediaCards = page.locator('[data-testid^="media-card-"]');
  const videoCard = mediaCards.filter({ hasText: 'tiny-video.mp4' }).first();
  const audioCard = mediaCards.filter({ hasText: 'tiny-audio.wav' }).first();
  await expect(videoCard).toBeVisible();
  await expect(audioCard).toBeVisible();
  await expect(page.getByTestId('media-job-queue')).toBeVisible();
  await expect(videoCard.locator('[data-testid^="proxy-status-"]')).toHaveAttribute('data-proxy-status', 'none');

  await videoCard.locator('[data-testid^="add-to-timeline-"]').click();
  await audioCard.locator('[data-testid^="add-to-timeline-"]').click();

  const firstClip = page.locator('[data-testid^="timeline-clip-"]').first();
  await expect(firstClip).toBeVisible();
  const beforeDragStyle = await firstClip.getAttribute('style');
  const box = await firstClip.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2);
  await page.mouse.up();
  await expect.poll(() => firstClip.getAttribute('style')).not.toBe(beforeDragStyle);
  await expect(page.locator('[data-testid^="timeline-waveform-"]').first()).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getCacheKeys!() as string[]))
    .toContainEqual(expect.stringMatching(/^thumbnails\//));

  await page.getByTestId('settings-clear-cache-button').click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getCacheKeys!() as string[])).toEqual([]);
});
