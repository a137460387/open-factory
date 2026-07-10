import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('polish subtitles via AI and verify timeline update with undo', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitlePolishFixture!());

  await expect(page.getByTestId('subtitle-ai-polish-section')).toBeVisible();
  await page.getByTestId('subtitle-ai-polish-section').locator('summary').click();
  await expect(page.getByTestId('subtitle-ai-polish-start-button')).toBeVisible();

  await page.getByTestId('subtitle-ai-polish-start-button').click();
  await expect(page.getByTestId('subtitle-ai-polish-preview')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('subtitle-ai-polish-item-ai-sub-1')).toBeVisible();
  await expect(page.getByTestId('subtitle-ai-polish-item-ai-sub-2')).toBeVisible();
  await expect(page.getByTestId('subtitle-ai-polish-item-ai-sub-3')).toBeVisible();

  await page.getByTestId('subtitle-ai-polish-accept-all').click();
  await page.getByTestId('subtitle-ai-polish-apply').click();

  const snapshot = await page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!());
  const subTrack = snapshot.tracks.find((t: { type: string }) => t.type === 'subtitle');
  expect(subTrack).toBeDefined();
  const texts = subTrack!.clips.map((c: { text: string }) => c.text);
  expect(texts).toContain('你好，世界。');
  expect(texts).toContain('今天天气真好。');

  await page.getByTestId('toolbar-undo-button').click();

  await expect.poll(() => page.evaluate(() => {
    const snapshot = window.__E2E_ACTIONS__!.getTimelineSnapshot!();
    const subTrack = snapshot.tracks.find((t: { type: string }) => t.type === 'subtitle');
    return subTrack?.clips?.map((c: { text: string }) => c.text);
  })).toContain('你好，世界');
});
