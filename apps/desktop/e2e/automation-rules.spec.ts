import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('runs an on-import automation rule and queues a forced proxy job', async ({ page }) => {
  const sourcePath = 'C:/Media/tiny-video.mp4';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-automation').click();
  await page.getByTestId('automation-rules-json-editor').fill(
    JSON.stringify(
      [
        {
          id: 'large-file-proxy',
          name: 'Large file proxy',
          trigger: 'on-import',
          conditions: [{ field: 'fileSize', op: '>', value: 3000 }],
          actions: [
            { type: 'generate-proxy' },
            { type: 'add-tag', value: 'green' }
          ]
        }
      ],
      null,
      2
    )
  );
  await page.getByTestId('automation-rules-save-button').click();
  await expect(page.getByTestId('automation-rule-row')).toContainText('Large file proxy');
  await page.getByTestId('settings-close-button').click();

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), sourcePath);
  await page.getByTestId('import-media-button').click();

  const mediaCard = page.locator('[data-testid^="media-card-"]').filter({ hasText: 'tiny-video.mp4' }).first();
  await expect(mediaCard).toBeVisible();
  await expect(mediaCard.locator('[data-testid^="proxy-status-"]')).toHaveAttribute('data-proxy-status', 'ready');

  const media = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ id: string; path: string; proxyPath?: string; proxyStatus?: string }>);
  const imported = media.find((asset) => asset.path === sourcePath);
  expect(imported?.proxyStatus).toBe('ready');
  expect(imported?.proxyPath).toMatch(/^C:\/Users\/E2E\/AppData\/Roaming\/open-factory\/proxies\/[a-f0-9]{16}\.mp4$/);

  const metadata = await page.evaluate((assetId) => window.__E2E_ACTIONS__!.getProjectSnapshot!().mediaMetadata[assetId!], imported?.id);
  expect(metadata?.labelColor).toBe('green');
});
