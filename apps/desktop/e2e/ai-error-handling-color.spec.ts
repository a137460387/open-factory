import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('color consistency: malformed warnings do not crash timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupColorConsistencyFixture!());

  // Verify initial setup is fine
  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-cc-b')).toBeVisible();

  // Inject malformed color consistency warnings (missing fields, invalid types)
  await page.evaluate(() => {
    const action = window.__E2E_ACTIONS__ as Record<string, (...args: unknown[]) => unknown>;
    const getSnap = action.getProjectSnapshot as () => unknown;
    const snap = getSnap() as {
      timeline: {
        tracks: unknown[];
        transitions: unknown[];
        markers: unknown[];
        colorConsistencyWarnings?: unknown[];
      };
      sequences: Array<{ id: string; name: string; timeline: unknown }>;
      activeSequenceId: string;
    };

    // Inject malformed warnings: null fields, missing properties, wrong types
    const malformedWarnings = [
      { clipAId: null, clipBId: null, type: null, deltaRGB: null, reason: null },
      { clipAId: undefined, clipBId: undefined, type: undefined, deltaRGB: undefined, reason: undefined },
      {},
      { clipAId: 123, clipBId: true, type: 42, deltaRGB: 'not-a-number', reason: {} },
    ];

    const malformedTimeline = {
      ...snap.timeline,
      colorConsistencyWarnings: malformedWarnings,
    };

    const store = (window as unknown as { __ZUSTAND_EDITOR_STORE__: { getState: () => { setProject: (p: unknown) => void } } }).__ZUSTAND_EDITOR_STORE__;
    if (store) {
      store.getState().setProject({
        ...snap,
        timeline: malformedTimeline,
        sequences: snap.sequences.map((s) =>
          s.id === snap.activeSequenceId ? { ...s, timeline: malformedTimeline } : s
        ),
      });
    }
  });

  // Wait a tick for re-render
  await page.waitForTimeout(300);

  // Timeline clips should still be visible (no crash)
  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible();
  await expect(page.getByTestId('timeline-clip-clip-cc-b')).toBeVisible();

  // Page should still be responsive
  await expect(page.getByTestId('editor-main-layout')).toBeVisible();

  // Media search should still work
  const keywordInput = page.getByTestId('media-search-input');
  await expect(keywordInput).toBeVisible();
});

test('color consistency: empty warnings array renders cleanly', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupColorConsistencyFixture!());

  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible({ timeout: 10_000 });

  // Verify the initial warning exists
  const warningIcon = page.getByTestId('color-consistency-warning-clip-cc-a-clip-cc-b-skin_tone');
  await expect(warningIcon).toBeVisible({ timeout: 10_000 });

  // Apply compensation to remove warnings cleanly
  await page.evaluate(() => window.__E2E_ACTIONS__!.applyColorCompensation!());
  await page.waitForTimeout(300);

  // Warning should be gone
  await expect(warningIcon).not.toBeVisible();

  // Timeline should still render
  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible();
  await expect(page.getByTestId('timeline-clip-clip-cc-b')).toBeVisible();
});
import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('color consistency: malformed warnings do not crash timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupColorConsistencyFixture!());

  // Verify initial setup is fine
  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-cc-b')).toBeVisible();

  // Inject malformed color consistency warnings via dedicated E2E action
  await page.evaluate(() => window.__E2E_ACTIONS__!.injectMalformedColorWarnings!());

  // Wait a tick for re-render
  await page.waitForTimeout(300);

  // Timeline clips should still be visible (no crash)
  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible();
  await expect(page.getByTestId('timeline-clip-clip-cc-b')).toBeVisible();

  // Page should still be responsive
  await expect(page.getByTestId('editor-main-layout')).toBeVisible();

  // Media search should still work
  const keywordInput = page.getByTestId('media-search-input');
  await expect(keywordInput).toBeVisible();
});

test('color consistency: empty warnings array renders cleanly', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupColorConsistencyFixture!());

  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible({ timeout: 10_000 });

  // Verify the initial warning exists
  const warningIcon = page.getByTestId('color-consistency-warning-clip-cc-a-clip-cc-b-skin_tone');
  await expect(warningIcon).toBeVisible({ timeout: 10_000 });

  // Apply compensation to remove warnings cleanly
  await page.evaluate(() => window.__E2E_ACTIONS__!.applyColorCompensation!());
  await page.waitForTimeout(300);

  // Warning should be gone
  await expect(warningIcon).not.toBeVisible();

  // Timeline should still render
  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible();
  await expect(page.getByTestId('timeline-clip-clip-cc-b')).toBeVisible();
});
