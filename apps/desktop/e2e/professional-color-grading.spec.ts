import { test, expect } from './fixtures';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test.describe('Professional Color Grading Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.clearE2eFiles!();
      window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
    });
    await page.getByTestId('import-media-button').click();
    await addMediaCardToTimeline(page, 0);
    const clip = page.locator('[data-testid^="timeline-clip-"]').first();
    await expect(clip).toBeVisible({ timeout: 10_000 });
    await clip.click({ force: true });
    await expect(page.getByTestId('clip-brightness-input')).toBeVisible({ timeout: 10_000 });
    await page.locator('summary', { hasText: '专业调色面板' }).click();
  });

  test('should display professional color grading panel with tabs', async ({ page }) => {
    const panel = page.getByTestId('professional-color-grading-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId('grading-tab-basic')).toBeVisible();
    await expect(page.getByTestId('grading-tab-wheels')).toBeVisible();
    await expect(page.getByTestId('grading-tab-lut')).toBeVisible();
    await expect(page.getByTestId('grading-tab-curves')).toBeVisible();
  });

  test('should display basic grading tab by default', async ({ page }) => {
    const panel = page.getByTestId('professional-color-grading-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId('basic-grading-tab')).toBeVisible();
    await expect(page.getByTestId('grading-brightness')).toBeVisible();
    await expect(page.getByTestId('grading-contrast')).toBeVisible();
    await expect(page.getByTestId('grading-saturation')).toBeVisible();
    await expect(page.getByTestId('grading-hue')).toBeVisible();
  });

  test('should switch to wheels tab and display color wheels', async ({ page }) => {
    const panel = page.getByTestId('professional-color-grading-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('grading-tab-wheels').click();
    await expect(page.getByTestId('wheels-grading-tab')).toBeVisible();

    await expect(page.getByTestId('grading-wheel-lift')).toBeVisible();
    await expect(page.getByTestId('grading-wheel-gamma')).toBeVisible();
    await expect(page.getByTestId('grading-wheel-gain')).toBeVisible();
  });

  test('should switch to LUT tab and display LUT controls', async ({ page }) => {
    const panel = page.getByTestId('professional-color-grading-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('grading-tab-lut').click();
    await expect(page.getByTestId('lut-grading-tab')).toBeVisible();

    await expect(page.getByTestId('current-lut-path')).toBeVisible();
    await expect(page.getByTestId('choose-lut-button')).toBeVisible();
  });

  test('should switch to curves tab and display curve editor', async ({ page }) => {
    const panel = page.getByTestId('professional-color-grading-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('grading-tab-curves').click();
    await expect(page.getByTestId('curves-grading-tab')).toBeVisible();

    await expect(page.getByTestId('curve-channel-master')).toBeVisible();
    await expect(page.getByTestId('curve-channel-r')).toBeVisible();
    await expect(page.getByTestId('curve-channel-g')).toBeVisible();
    await expect(page.getByTestId('curve-channel-b')).toBeVisible();

    await expect(page.getByTestId('curve-editor-master')).toBeVisible();
  });

  test('should reset basic grading settings', async ({ page }) => {
    const panel = page.getByTestId('professional-color-grading-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('reset-basic-grading').click();

    await expect(page.getByTestId('grading-brightness')).toBeVisible();
  });

  test('should reset wheels grading settings', async ({ page }) => {
    const panel = page.getByTestId('professional-color-grading-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('grading-tab-wheels').click();
    await expect(page.getByTestId('wheels-grading-tab')).toBeVisible();

    await page.getByTestId('reset-wheels-grading').click();

    await expect(page.getByTestId('grading-wheel-lift')).toBeVisible();
  });

  test('should reset curves grading settings', async ({ page }) => {
    const panel = page.getByTestId('professional-color-grading-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('grading-tab-curves').click();
    await expect(page.getByTestId('curves-grading-tab')).toBeVisible();

    await page.getByTestId('reset-curves-grading').click();

    await expect(page.getByTestId('curve-editor-master')).toBeVisible();
  });
});
