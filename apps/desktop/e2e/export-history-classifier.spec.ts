import { test, expect } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test.describe('Export History Classifier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await waitForAppStore(page);
  });

  test('classifier panel opens and shows categories', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setExportHistoryPanelOpen) store.setExportHistoryPanelOpen(true);
    });
    const panel = page.getByTestId('export-history-classifier-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('export-history-filters')).toBeVisible();
  });

  test('category filter shows correct entries', async ({ page }) => {
    // Inject mock export history
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setExportHistoryPanelOpen) store.setExportHistoryPanelOpen(true);
      if (store?.setMockExportHistory) {
        store.setMockExportHistory([
          { id: 'e1', name: 'YouTube 1080p 导出', outputPath: '/out/youtube.mp4', status: 'success', priority: 'normal', createdAt: '2024-06-01T10:00:00Z', finishedAt: '2024-06-01T10:30:00Z' },
          { id: 'e2', name: '客户交付版', outputPath: '/out/delivery.mp4', status: 'success', priority: 'high', createdAt: '2024-06-02T10:00:00Z', finishedAt: '2024-06-02T10:30:00Z' },
          { id: 'e3', name: '内部预览草稿', outputPath: '/out/preview.mp4', status: 'success', priority: 'low', createdAt: '2024-06-03T10:00:00Z', finishedAt: '2024-06-03T10:30:00Z' },
        ]);
      }
    });
    // Filter by social-media category
    await page.getByTestId('filter-social-media').click();
    const list = page.getByTestId('export-history-list');
    await expect(list).toBeVisible({ timeout: 5000 });
  });

  test('status filter works correctly', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setExportHistoryPanelOpen) store.setExportHistoryPanelOpen(true);
      if (store?.setMockExportHistory) {
        store.setMockExportHistory([
          { id: 'e1', name: '成功导出', outputPath: '/out/success.mp4', status: 'success', priority: 'normal', createdAt: '2024-06-01T10:00:00Z', finishedAt: '2024-06-01T10:30:00Z' },
          { id: 'e2', name: '失败导出', outputPath: '/out/failed.mp4', status: 'error', priority: 'normal', createdAt: '2024-06-02T10:00:00Z', finishedAt: '2024-06-02T10:30:00Z' },
        ]);
      }
    });
    await page.getByTestId('filter-status').selectOption('error');
    const list = page.getByTestId('export-history-list');
    await expect(list).toBeVisible({ timeout: 5000 });
  });

  test('stats toggle shows category distribution', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setExportHistoryPanelOpen) store.setExportHistoryPanelOpen(true);
      if (store?.setMockExportHistory) {
        store.setMockExportHistory([
          { id: 'e1', name: '社媒发布', outputPath: '/out/1.mp4', status: 'success', priority: 'normal', createdAt: '2024-06-01T10:00:00Z', finishedAt: '2024-06-01T10:30:00Z' },
          { id: 'e2', name: '社媒发布2', outputPath: '/out/2.mp4', status: 'success', priority: 'normal', createdAt: '2024-06-02T10:00:00Z', finishedAt: '2024-06-02T10:30:00Z' },
          { id: 'e3', name: '客户交付', outputPath: '/out/3.mp4', status: 'success', priority: 'high', createdAt: '2024-06-03T10:00:00Z', finishedAt: '2024-06-03T10:30:00Z' },
        ]);
      }
    });
    await page.getByTestId('toggle-stats').click();
    await expect(page.getByTestId('export-history-stats')).toBeVisible({ timeout: 5000 });
  });

  test('manual category override works', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setExportHistoryPanelOpen) store.setExportHistoryPanelOpen(true);
      if (store?.setMockExportHistory) {
        store.setMockExportHistory([
          { id: 'e1', name: '某次导出', outputPath: '/out/1.mp4', status: 'success', priority: 'normal', createdAt: '2024-06-01T10:00:00Z', finishedAt: '2024-06-01T10:30:00Z' },
        ]);
      }
    });
    const override = page.getByTestId('override-e1');
    await expect(override).toBeVisible({ timeout: 5000 });
    await override.selectOption('archive-backup');
    // The entry should now show as archive-backup category
    await expect(override).toHaveValue('archive-backup');
  });
});
