import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('adjusts LUT creator controls and exports a valid cube file', async ({ page }) => {
  const outputPath = 'C:/Users/E2E/AppData/Roaming/open-factory/luts/creator-e2e.cube';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/test-image.png']));

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-lut-editor-menu-item').click();
  await expect(page.getByTestId('lut-editor-dialog')).toBeVisible();

  await page.getByTestId('lut-editor-name-input').fill('Creator E2E');
  await page.getByTestId('lut-editor-precision-select').selectOption('17');
  await page.getByTestId('lut-color-wheel-gain-intensity').fill('1.2');
  await page.getByTestId('lut-editor-reference-button').click();
  await expect(page.getByTestId('lut-editor-webgl-preview')).toBeVisible();
  await expect(page.getByTestId('lut-editor-matrix-summary')).toContainText('4913');

  await page.getByTestId('lut-editor-export-button').click();

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, outputPath)).toBeTruthy();
  const cube = await page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string, outputPath);
  expect(cube).toContain('TITLE "Creator E2E"');
  expect(cube).toContain('LUT_3D_SIZE 17');
  expect(cube.trim().split('\n')).toHaveLength(4 + 17 ** 3);
});
