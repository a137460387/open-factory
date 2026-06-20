import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('runs post-export publish pipeline email and records node logs', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.resetMockState?.());
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/publish-pipeline-output.mp4'));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-mode-pipeline-tab').click();
  await page.getByTestId('export-pipeline-create-publish').click();
  await expect(page.getByTestId('export-pipeline-node')).toHaveCount(5);

  await page.getByTestId('export-enqueue-button').click();

  await expect(page.getByTestId('export-publish-log').first()).toHaveAttribute('data-status', 'success', { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastSmtpEmailRequest?.()))
    .toMatchObject({
      host: 'smtp.example.local',
      to: ['producer@example.local'],
      subject: 'Open Factory export complete'
    });
  await expect(page.getByTestId('export-publish-log-list')).toContainText('SMTP 邮件已发送');
  await expect(page.getByTestId('export-publish-log-list')).toContainText('发布记录已写入');
});
