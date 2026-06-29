import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('motion type: shows badges for 3 clips with different motion types', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMotionTypeFixture!());

  await expect(page.getByTestId('timeline-clip-clip-mt-pan')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-mt-tilt')).toBeVisible();
  await expect(page.getByTestId('timeline-clip-clip-mt-static')).toBeVisible();

  const panBadge = page.getByTestId('motion-type-badge-clip-mt-pan');
  await expect(panBadge).toBeVisible({ timeout: 10_000 });
  await expect(panBadge).toHaveAttribute('data-motion-type', 'pan');

  const tiltBadge = page.getByTestId('motion-type-badge-clip-mt-tilt');
  await expect(tiltBadge).toBeVisible();
  await expect(tiltBadge).toHaveAttribute('data-motion-type', 'tilt');

  const staticBadge = page.getByTestId('motion-type-badge-clip-mt-static');
  await expect(staticBadge).toBeVisible();
  await expect(staticBadge).toHaveAttribute('data-motion-type', 'static');
});

test('motion type: filter by pan returns 1 result', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMotionTypeFixture!());

  const count = await page.evaluate(() => window.__E2E_ACTIONS__!.filterByMotionType!('pan') as number);
  expect(count).toBe(1);
});
