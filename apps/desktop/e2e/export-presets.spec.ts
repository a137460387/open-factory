import { expect, test, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

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
  await page.locator('[data-testid^="media-card-"]').nth(0).getByText('Add to timeline').click();
}

async function clickExportButton(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Export video' }).click();
}
