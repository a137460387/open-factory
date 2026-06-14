import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('adds a timeline marker from the ruler context menu', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('timeline-ruler').click({ button: 'right', position: { x: 240, y: 20 } });
  await expect(page.getByTestId('ruler-context-menu')).toBeVisible();
  await page.getByTestId('ruler-context-add-marker').click();

  await expect(page.locator('[data-testid^="timeline-marker-"]')).toHaveCount(1);
});
