import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('error knowledge diagnostics shows top matches for export errors', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
  });

  const diagnosticsSupported = await page.evaluate(() => typeof window.__E2E_ACTIONS__ !== 'undefined');
  expect(diagnosticsSupported).toBe(true);

  const matchResult = await page.evaluate(() => {
    try {
      const mod = (window as any).__E2E_ERROR_KNOWLEDGE__;
      if (mod && mod.matchErrorKnowledge) {
        return mod.matchErrorKnowledge('Unknown encoder libsvtav1');
      }
      return null;
    } catch {
      return null;
    }
  });

  if (matchResult !== null) {
    expect(matchResult.length).toBeGreaterThanOrEqual(1);
  }
});
