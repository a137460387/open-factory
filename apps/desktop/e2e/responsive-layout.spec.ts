import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('persists collapsed inspector panel after refresh', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await expect(page.getByTestId('editor-main-layout')).toHaveAttribute('data-right-collapsed', 'false');

  await page.getByTestId('right-panel-collapse-button').click();
  await expect(page.getByTestId('editor-main-layout')).toHaveAttribute('data-right-collapsed', 'true');
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-collapsed', 'true');

  await page.reload();
  await waitForE2eActions(page);

  await expect(page.getByTestId('editor-main-layout')).toHaveAttribute('data-right-collapsed', 'true');
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-collapsed', 'true');
});
