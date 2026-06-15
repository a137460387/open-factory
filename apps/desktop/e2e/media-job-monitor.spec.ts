import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('shows mocked background task progress and updates status after cancel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() =>
    window.__E2E_ACTIONS__!.enqueueMockMediaJob!({
      id: 'mock-gif-preview',
      assetId: 'asset-gif',
      assetName: 'preview-source.mp4',
      type: 'gif-preview',
      status: 'running',
      progress: 0.42
    })
  );

  await expect(page.getByTestId('media-job-monitor-badge-count')).toHaveText('1');
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-task-monitor').click();

  await expect(page.getByTestId('task-monitor-panel')).toBeVisible();
  await expect(page.getByTestId('task-monitor-file-mock-gif-preview')).toContainText('preview-source.mp4');
  await expect(page.getByTestId('task-monitor-progress-mock-gif-preview')).toHaveText('42%');
  await expect(page.getByTestId('task-monitor-status-mock-gif-preview')).toContainText('运行');

  await page.getByTestId('task-monitor-cancel-mock-gif-preview').click();
  await expect(page.getByTestId('task-monitor-status-mock-gif-preview')).toContainText('已取消');
});
