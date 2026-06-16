import { expect, test, type Locator, type Page } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

const settingsPath = 'C:/Users/E2E/AppData/Roaming/open-factory/settings.json';

test('dragging a clip shows a shadowed clip and drop preview highlight', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  await expect(clip).toBeVisible();

  await dragClipWhileHolding(clip, page, 72);

  await expect(clip).toHaveAttribute('data-dragging', 'true');
  await expect(page.locator('[data-testid^="timeline-drop-preview-"]').first()).toBeVisible();
  await expect.poll(() => clip.evaluate((node) => getComputedStyle(node).opacity)).toBe('0.8');

  await page.mouse.up();
});

test('reduced motion setting disables timeline feedback animation classes', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-reduce-motion-toggle').check();
  await page.getByTestId('settings-close-button').click();

  await expect(page.getByTestId('timeline-root')).toHaveAttribute('data-reduce-motion', 'true');
  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath))
    .toContain('"timelineInteraction"');

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  await dragClipWhileHolding(clip, page, 48);

  await expect(clip).toHaveAttribute('data-reduce-motion', 'true');
  await expect.poll(() => clip.evaluate((node) => Array.from(node.classList).includes('transition-all'))).toBe(false);
  await page.mouse.up();
});

async function dragClipWhileHolding(clip: Locator, page: Page, deltaX: number): Promise<void> {
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + deltaX, box!.y + box!.height / 2, { steps: 6 });
}
