import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('installs a cached community export preset into the local preset list', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate((contents) => window.__E2E_ACTIONS__!.setPresetMarketCache!(contents), makePresetMarketJson());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-export-presets').click();

  await expect(page.getByTestId('preset-market-panel')).toBeVisible();
  await expect(page.getByTestId('preset-market-source')).toHaveAttribute('data-source', 'cache');
  const card = page.locator('[data-testid="preset-market-card"][data-preset-id="e2e-youtube-review"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('E2E YouTube Review');

  await card.getByTestId('preset-market-install-button').click();

  const presetsPath = 'C:/Users/E2E/AppData/Roaming/open-factory/presets.json';
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, presetsPath)).toContain('E2E YouTube Review');

  await page.getByTestId('settings-close-button').click();
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.getByTestId('toolbar-export-button').click();

  await expect(page.locator('[data-testid="export-preset-select"] option', { hasText: 'E2E YouTube Review' })).toHaveCount(1);
  const presetValue = await page.locator('[data-testid="export-preset-select"] option', { hasText: 'E2E YouTube Review' }).first().getAttribute('value');
  expect(presetValue).toBeTruthy();
  await page.getByTestId('export-preset-select').selectOption(presetValue!);
  await expect(page.getByTestId('export-video-bitrate-input')).toHaveValue('9M');
});

function makePresetMarketJson(): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      presets: [
        {
          id: 'e2e-youtube-review',
          name: 'E2E YouTube Review',
          author: 'Open Factory E2E',
          description: 'Cached market preset for export settings tests.',
          tags: ['YouTube', '1080p', 'MP4'],
          downloads: 42,
          rating: 4,
          preset: {
            id: 'custom-e2e-youtube-review',
            name: 'E2E YouTube Review',
            description: 'Installed from the cached market.',
            settings: {
              width: 1920,
              height: 1080,
              fps: 30,
              format: 'mp4',
              outputMode: 'video',
              videoCodec: 'libx264',
              audioCodec: 'aac',
              videoBitrate: '9M'
            }
          }
        }
      ]
    },
    null,
    2
  );
}
