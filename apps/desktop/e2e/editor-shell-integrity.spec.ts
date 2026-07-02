import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('editor main layout renders after P1-4 refactoring', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // The timeline panel should be present
  await expect(page.getByTestId('timeline-panel')).toBeVisible();

  // The left panel (media bin area) should be present
  await expect(page.getByTestId('left-panel')).toBeVisible();
});
