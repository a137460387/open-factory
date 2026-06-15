import { expect, test, type Page } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('persists a custom export preset across reload', async ({ page }) => {
  await openExportDialog(page);

  await page.getByTestId('export-preset-select').selectOption('youtube-shorts');
  await page.getByTestId('export-video-bitrate-input').fill('12M');
  await page.getByTestId('export-preset-name-input').fill('Persistent Shorts');
  await page.getByTestId('export-save-preset-button').click();

  await expect(page.locator('[data-testid="export-preset-select"] option', { hasText: 'Persistent Shorts' })).toHaveCount(1);
  await expect(page.getByTestId('export-video-bitrate-input')).toHaveValue('12M');

  await page.reload();
  await waitForE2eActions(page);
  await addVideoClip(page);
  await clickExportButton(page);

  await expect(page.locator('[data-testid="export-preset-select"] option', { hasText: 'Persistent Shorts' })).toHaveCount(1);
  const customValue = await page
    .locator('[data-testid="export-preset-select"] option', { hasText: 'Persistent Shorts' })
    .first()
    .getAttribute('value');
  expect(customValue).toBeTruthy();
  await page.getByTestId('export-preset-select').selectOption(customValue!);
  await expect(page.getByTestId('export-video-bitrate-input')).toHaveValue('12M');
  await expect(page.getByTestId('export-width-input')).toHaveValue('1080');
  await expect(page.getByTestId('export-height-input')).toHaveValue('1920');
});

test('deletes custom presets while built-in presets stay protected', async ({ page }) => {
  await openExportDialog(page);

  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await expect(page.getByTestId('export-delete-preset-button')).toBeDisabled();

  await page.getByTestId('export-preset-name-input').fill('Temporary Web');
  await page.getByTestId('export-save-preset-button').click();
  await expect(page.locator('[data-testid="export-preset-select"] option', { hasText: 'Temporary Web' })).toHaveCount(1);
  await expect(page.getByTestId('export-delete-preset-button')).toBeEnabled();

  await page.getByTestId('export-delete-preset-button').click();
  await expect(page.locator('[data-testid="export-preset-select"] option', { hasText: 'Temporary Web' })).toHaveCount(0);
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await expect(page.getByTestId('export-delete-preset-button')).toBeDisabled();
});

test('exports and imports a preset package', async ({ page }) => {
  await openExportDialog(page);

  const packagePath = 'C:/Exports/team-review.ofpreset.json';
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-video-bitrate-input').fill('11M');
  await page.getByTestId('export-preset-name-input').fill('Team Review Package');
  await page.getByTestId('export-save-preset-button').click();
  await expect(page.locator('[data-testid="export-preset-select"] option', { hasText: 'Team Review Package' })).toHaveCount(1);

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), packagePath);
  await page.getByTestId('export-preset-package-export-button').click();
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, packagePath)).toContain('Team Review Package');

  await page.getByTestId('export-delete-preset-button').click();
  await expect(page.locator('[data-testid="export-preset-select"] option', { hasText: 'Team Review Package' })).toHaveCount(0);

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), packagePath);
  await page.getByTestId('export-preset-package-import-button').click();
  await expect(page.locator('[data-testid="export-preset-select"] option', { hasText: 'Team Review Package' })).toHaveCount(1);
  const importedValue = await page.locator('[data-testid="export-preset-select"] option', { hasText: 'Team Review Package' }).first().getAttribute('value');
  expect(importedValue).toBeTruthy();
  await page.getByTestId('export-preset-select').selectOption(importedValue!);
  await expect(page.getByTestId('export-video-bitrate-input')).toHaveValue('11M');
});

async function openExportDialog(page: Page): Promise<void> {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearExportPresets!());
  await addVideoClip(page);
  await clickExportButton(page);
  await expect(page.getByTestId('export-dialog')).toBeVisible();
}

async function addVideoClip(page: Page): Promise<void> {
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
}

async function clickExportButton(page: Page): Promise<void> {
  await page.getByTestId('toolbar-export-button').click();
}
