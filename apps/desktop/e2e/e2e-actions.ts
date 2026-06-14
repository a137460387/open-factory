import { expect, type Page } from '@playwright/test';

export async function waitForE2eActions(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__E2E_ACTIONS__)), {
      timeout: 15_000
    })
    .toBe(true);
}

export async function addMediaCardToTimeline(page: Page, index = 0): Promise<void> {
  await page.locator('[data-testid^="media-card-"]').nth(index).locator('[data-testid^="add-to-timeline-"]').click();
}

export async function openExportDialog(page: Page): Promise<void> {
  await page.getByTestId('toolbar-export-button').click();
}

export async function expectExportTaskStatus(page: Page, index: number, status: string): Promise<void> {
  await expect(page.getByTestId('export-queue-list').getByTestId('export-task-status').nth(index)).toHaveAttribute('data-status', status);
}
