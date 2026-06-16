import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('generates cover frame candidates from a clip and sets project cover PNG', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupGapFillFixture!());

  await page.getByTestId('timeline-clip-clip-gap-a').click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-generate-cover').click();

  await expect(page.getByTestId('cover-frame-picker')).toBeVisible();
  await expect(page.getByTestId('cover-frame-option-0')).toBeVisible();
  await page.getByTestId('cover-frame-option-0').click();

  const coverPath = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectSnapshot!().coverPath as string | undefined);
  expect(coverPath).toBeTruthy();
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFileSize!(path), coverPath)).toBeGreaterThan(0);
  await expect(page.getByTestId('cover-frame-selected')).toContainText(coverPath!);
});
