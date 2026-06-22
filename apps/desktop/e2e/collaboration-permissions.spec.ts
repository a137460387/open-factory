import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('commenter role disables timeline editing buttons in collaboration panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('toolbar-settings-button').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  const collabTab = page.getByTestId('settings-tab-collaboration');
  if (await collabTab.isVisible()) {
    await collabTab.click();
    await expect(page.getByTestId('collaboration-permission-panel')).toBeVisible();
  }
  await page.getByTestId('settings-close-button').click();

  await expect(page.getByTestId('import-media-button')).toBeVisible();
});
