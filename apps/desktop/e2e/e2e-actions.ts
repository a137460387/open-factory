import { expect, type Page } from '@playwright/test';

export async function waitForE2eActions(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Boolean(window.__E2E_ACTIONS__))).toBe(true);
}

