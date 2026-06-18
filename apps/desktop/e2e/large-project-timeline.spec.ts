import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('renders a 500 clip timeline project in under one second', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  const start = await page.evaluate((project) => {
    const renderStart = performance.now();
    window.__E2E_ACTIONS__!.setupLargeTimelineFixture!(project);
    return renderStart;
  }, 500);
  await page.waitForFunction(
    (expectedCount) => {
      const snapshot = window.__E2E_ACTIONS__?.getTimelineSnapshot?.();
      const clips = snapshot?.tracks?.flatMap((track) => track.clips ?? []) ?? [];
      return clips.length === expectedCount && document.querySelectorAll('[data-testid^="timeline-clip-"]').length > 0;
    },
    500,
    { timeout: 10_000 }
  );
  const initialRenderMs = await page.evaluate((renderStart) => performance.now() - renderStart, start);
  const renderedClipCount = await page.locator('[data-testid^="timeline-clip-"]').count();

  expect(initialRenderMs).toBeLessThan(1_000);
  expect(renderedClipCount).toBeGreaterThan(0);
  expect(renderedClipCount).toBeLessThan(500);
});
