import { expect, test, type Locator, type Page } from '@playwright/test';
import { addMediaCardToTimeline } from './e2e-actions';

test('snaps a dragged clip to a neighboring clip edge', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);

  const imageClip = page.locator('[data-testid^="timeline-clip-"]').nth(1);
  await expect(imageClip).toBeVisible();
  await dragClipBy(imageClip, page, 80);
  await expect.poll(() => imageClip.getAttribute('style')).toContain('left: 560px');

  await dragClipBy(imageClip, page, -75);
  await expect.poll(() => imageClip.getAttribute('style')).toContain('left: 480px');
});

async function dragClipBy(clip: Locator, page: Page, deltaX: number): Promise<void> {
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + deltaX, box!.y + box!.height / 2, { steps: 6 });
  await page.mouse.up();
}
