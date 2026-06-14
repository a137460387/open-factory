import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('shows a frame rate label for imported 25fps media', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/clip-25fps.mp4']));

  await page.getByTestId('import-media-button').click();

  const card = page.locator('[data-testid^="media-card-"]').filter({ hasText: 'clip-25fps.mp4' });
  await expect(card).toBeVisible();
  const frameRateLabel = card.locator('[data-testid^="media-frame-rate-"]');
  await expect(frameRateLabel).toHaveText('25fps');
  await expect(frameRateLabel).toHaveAttribute('data-frame-rate-mismatch', 'true');

  await card.locator('[data-testid^="add-to-timeline-"]').click();
  const timelineClip = page.locator('[data-testid^="timeline-clip-"]').filter({ hasText: 'clip-25fps.mp4' }).first();
  await expect(page.locator('[data-testid^="timeline-frame-rate-warning-"]')).toBeVisible();

  await timelineClip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-convert-frame-rate')).toBeEnabled();
  await page.getByTestId('clip-action-convert-frame-rate').click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__E2E_ACTIONS__!.getProjectMedia!().find((asset) => asset.name === 'clip-25fps.mp4')?.proxyStatus)
    )
    .toBe('ready');
});
