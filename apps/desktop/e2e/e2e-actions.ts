import { expect, type Page } from '@playwright/test';

export async function waitForE2eActions(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__E2E_ACTIONS__)), {
      timeout: 15_000
    })
    .toBe(true);
}

export async function waitForAppStore(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).__APP_STORE__)), {
      timeout: 15_000
    })
    .toBe(true);
}

export async function addMediaCardToTimeline(page: Page, index = 0): Promise<void> {
  await page.locator('[data-testid^="media-card-"]').nth(index).locator('[data-testid^="add-to-timeline-"]').click();
}

export async function openExportDialog(page: Page): Promise<void> {
  await page.getByTestId('toolbar-export-button').click();
  // 导出对话框挂在内层 lazy chunk 上，点击后才首次 import；dev ESM 瀑布在慢
  // CI runner 上可超过 click 默认 10s 与 POM 15s（HANDOFF 2.9 勘察）。统一在
  // helper 等待挂载，消灭各 spec 的等待窗口差异。
  await expect(page.getByTestId('export-dialog')).toBeVisible({ timeout: 30_000 });
}

export async function expectExportTaskStatus(page: Page, index: number, status: string): Promise<void> {
  await expect(page.getByTestId('export-queue-list').getByTestId('export-task-status').nth(index)).toHaveAttribute('data-status', status, { timeout: 15_000 });
}
