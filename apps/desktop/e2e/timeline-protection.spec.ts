import { expect, test, type Page } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

async function openCleanProject(page: Page): Promise<void> {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);
}

test('blocks moving a clip out of a protected timeline range', async ({ page }) => {
  await openCleanProject(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  const ruler = page.getByTestId('timeline-ruler');
  const rulerBox = await ruler.boundingBox();
  if (!rulerBox) {
    throw new Error('Timeline ruler is not visible.');
  }
  await page.mouse.click(rulerBox.x + 80, rulerBox.y + 16, { button: 'right' });
  await page.getByTestId('ruler-context-add-protected-range').click();
  await expect(page.getByTestId('timeline-protected-range')).toHaveCount(1);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  await expect(clip).toHaveAttribute('style', /left:\s*0px/);
  const box = await clip.boundingBox();
  if (!box) {
    throw new Error('Timeline clip is not visible.');
  }
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(clip).toHaveAttribute('style', /left:\s*0px/);
});
