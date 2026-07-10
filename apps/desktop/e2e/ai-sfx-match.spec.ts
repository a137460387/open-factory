import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('sfx match: shows 2 suggestion markers with correct states', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSfxMatchFixture!());

  await expect(page.getByTestId('timeline-clip-clip-sfx-1')).toBeVisible({ timeout: 10_000 });

  const sfx0 = page.getByTestId('sfx-suggestion-track-sfx-video-0');
  await expect(sfx0).toBeVisible({ timeout: 10_000 });
  await expect(sfx0).toHaveAttribute('data-sfx-status', 'pending');

  const sfx1 = page.getByTestId('sfx-suggestion-track-sfx-video-1');
  await expect(sfx1).toBeVisible();
  await expect(sfx1).toHaveAttribute('data-sfx-status', 'pending');

  const sfxData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { sfxSuggestions?: Array<{ category: string; matchedAssetId: string | null }> };
    };
    return project.timeline.sfxSuggestions ?? [];
  });
  expect(sfxData).toHaveLength(2);
  expect(sfxData[0].matchedAssetId).toBe('sfx-footstep-1');
  expect(sfxData[1].matchedAssetId).toBeNull();
});

test('sfx match: insert matched SFX changes status to accepted', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSfxMatchFixture!());

  await expect(page.getByTestId('timeline-clip-clip-sfx-1')).toBeVisible({ timeout: 10_000 });

  await page.evaluate(() => window.__E2E_ACTIONS__!.insertSfx!(0));

  await expect(page.getByTestId('sfx-suggestion-track-sfx-video-0')).toHaveAttribute('data-sfx-status', 'accepted');

  const sfxData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { sfxSuggestions?: Array<{ status: string; matchedAssetId: string | null }> };
    };
    return project.timeline.sfxSuggestions ?? [];
  });
  expect(sfxData[0].status).toBe('accepted');
  expect(sfxData[1].matchedAssetId).toBeNull();
});
