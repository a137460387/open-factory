import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('opens media health dashboard and jumps to relink details from missing media card', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupProjectHealthFixture!());

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-media-health-dashboard-menu-item').click();

  await expect(page.getByTestId('media-health-dashboard-panel')).toBeVisible();
  await expect(page.getByTestId('media-health-card-proxy-coverage')).toBeVisible();
  await expect(page.getByTestId('media-health-card-missing-media')).toBeVisible();
  await expect(page.getByTestId('media-health-card-expired-proxy')).toBeVisible();
  await expect(page.getByTestId('media-health-card-unused-media')).toBeVisible();
  await expect(page.getByTestId('media-health-card-storage')).toBeVisible();
  await expect(page.getByTestId('media-health-card-recent-imports')).toBeVisible();
  await expect(page.getByTestId('media-health-missing-count')).toHaveText('1');

  await page.getByTestId('media-health-missing-card-action').click();

  await expect(page.getByTestId('project-health-panel')).toBeVisible();
  await expect(page.getByTestId('project-health-section-missing-media')).toHaveAttribute('data-count', '1');
});
