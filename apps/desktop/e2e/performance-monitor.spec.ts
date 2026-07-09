import { test, expect } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test.describe('Performance Monitor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await waitForAppStore(page);
  });

  test('alert icon appears when high memory is injected', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__PERF_MONITOR_STORE__;
      if (store) {
        for (let i = 0; i < 3; i++) {
          store.getState().injectMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, undoHistorySize: 0, renderFps: 60 });
        }
      }
    });
    const alertIcon = page.getByTestId('perf-alert-icon');
    await expect(alertIcon).toBeVisible({ timeout: 10000 });
  });

  test('panel displays alerts and metrics after injection', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__PERF_MONITOR_STORE__;
      if (store) {
        for (let i = 0; i < 3; i++) {
          store.getState().injectMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, undoHistorySize: 0, renderFps: 60 });
        }
        store.getState().setPanelOpen(true);
      }
    });
    await expect(page.getByTestId('performance-monitor-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('perf-alerts')).toBeVisible();
    await expect(page.getByTestId('perf-metrics')).toBeVisible();
  });

  test('one-click optimize clears alerts and improves metrics', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__PERF_MONITOR_STORE__;
      if (store) {
        for (let i = 0; i < 3; i++) {
          store.getState().injectMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, undoHistorySize: 600, renderFps: 10 });
        }
        store.getState().setPanelOpen(true);
      }
    });
    await expect(page.getByTestId('perf-one-click-optimize')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('perf-one-click-optimize').click();
    await expect(page.getByTestId('perf-alerts')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('perf-alert-icon')).not.toBeVisible({ timeout: 5000 });
  });

  test('monitor config can be toggled', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__PERF_MONITOR_STORE__;
      if (store) {
        store.getState().setPanelOpen(true);
      }
    });
    await expect(page.getByTestId('performance-monitor-panel')).toBeVisible();
    const checkbox = page.getByTestId('perf-config-enabled');
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });
});