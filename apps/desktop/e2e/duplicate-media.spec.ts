import { expect, test, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('detects duplicate media, merges references, and supports undo', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupDuplicateMediaFixture!());

  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(2);
  await page.getByTestId('scan-duplicate-media-button').click();

  await expect(page.getByTestId('duplicate-media-dialog')).toBeVisible();
  await expect(page.getByTestId('duplicate-media-group')).toHaveCount(1);
  await expect(page.getByTestId('duplicate-media-dialog')).toContainText('duplicate-a.mp4');
  await expect(page.getByTestId('duplicate-media-dialog')).toContainText('duplicate-b.mp4');

  await page.getByTestId('duplicate-media-merge-button').click();
  await expect(page.getByTestId('duplicate-media-dialog')).toBeHidden();

  await expect.poll(() => duplicateSnapshot(page)).toEqual({
    mediaIds: ['media-duplicate-a'],
    clipMediaId: 'media-duplicate-a'
  });

  await page.getByTestId('toolbar-undo-button').click();
  await expect.poll(() => duplicateSnapshot(page)).toEqual({
    mediaIds: ['media-duplicate-a', 'media-duplicate-b'],
    clipMediaId: 'media-duplicate-b'
  });
});

async function duplicateSnapshot(page: Page) {
  return page.evaluate(() => {
    const media = window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ id: string }>;
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ clips: Array<{ mediaId?: string }> }>;
    };
    return {
      mediaIds: media.map((asset) => asset.id),
      clipMediaId: timeline.tracks[0]?.clips[0]?.mediaId
    };
  });
}
