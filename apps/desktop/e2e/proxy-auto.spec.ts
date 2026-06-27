import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('auto-generates a proxy for 4K HEVC media while export uses the original source', async ({ page }) => {
  const sourcePath = 'C:/Media/four-k-hevc.mov';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-proxy').click();
  await expect(page.getByTestId('proxy-resolution-select')).toHaveValue('720p');
  await expect(page.getByTestId('proxy-threshold-select')).toHaveValue('1080');
  await page.getByTestId('settings-close-button').click();

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), sourcePath);
  await page.getByTestId('import-media-button').click();

  const mediaCard = page.locator('[data-testid^="media-card-"]').filter({ hasText: 'four-k-hevc.mov' }).first();
  await expect(mediaCard).toBeVisible();
  await expect(mediaCard.locator('[data-testid^="proxy-status-"]')).toHaveAttribute('data-proxy-status', 'ready');

  const media = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ path: string; proxyPath?: string; proxyStatus?: string; videoCodec?: string }>);
  const imported = media.find((asset) => asset.path === sourcePath);
  expect(imported?.videoCodec).toBe('hevc');
  expect(imported?.proxyStatus).toBe('ready');
  expect(imported?.proxyPath).toMatch(/^C:\/Users\/E2E\/AppData\/Roaming\/open-factory\/proxies\/[a-f0-9]{16}\.mp4$/);

  await addMediaCardToTimeline(page, 0);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/proxy-original-export.mp4'));
  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { inputs: Array<{ path: string }>; fullArgs: string[] });
  expect(plan.inputs.map((input) => input.path)).toContain(sourcePath);
  expect(plan.fullArgs.join(' ')).not.toContain(imported!.proxyPath!);
});

test('prioritizes timeline-used proxy work ahead of media-library proxy work', async ({ page }) => {
  const sourcePath = 'C:/Media/four-k-hevc.mov';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setProxyGenerationDelay!(1000);
    window.__E2E_ACTIONS__!.enqueueMockMediaJob!({
      id: 'low-library-proxy',
      assetId: 'asset-library-only',
      assetName: 'library-only.mov',
      type: 'proxy',
      priority: 'low'
    });
  });

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), sourcePath);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const activeProxyJobs = (window.__E2E_ACTIONS__!.getMediaJobs!() as Array<{ type: string; status: string; priority: string; assetName: string }>).filter(
            (job) => job.type === 'proxy' && (job.status === 'pending' || job.status === 'running')
          );
          return activeProxyJobs[0] ? `${activeProxyJobs[0].priority}:${activeProxyJobs[0].assetName}` : '';
        }),
      { timeout: 5000 }
    )
    .toBe('high:four-k-hevc.mov');
});
