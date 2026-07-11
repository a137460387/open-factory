import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test.describe('智能字幕工作流', () => {
  test('should display the workflow panel with 4 stage tabs', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    const panel = page.getByTestId('ai-subtitle-workflow-panel');
    await expect(panel).toBeVisible();

    await expect(page.getByTestId('subtitle-workflow-tab-asr')).toBeVisible();
    await expect(page.getByTestId('subtitle-workflow-tab-polish')).toBeVisible();
    await expect(page.getByTestId('subtitle-workflow-tab-style')).toBeVisible();
    await expect(page.getByTestId('subtitle-workflow-tab-export')).toBeVisible();
  });

  test('should show ASR stage by default', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    const asrStage = page.getByTestId('subtitle-workflow-asr-stage');
    await expect(asrStage).toBeVisible();
  });

  test('should show no clip selected message when no clip is selected', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    await expect(page.getByText('请在时间线上选择一个音频或视频片段')).toBeVisible();
  });

  test('should disable next stages initially when no clip is selected', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    // ASR tab should be active/enabled
    const asrTab = page.getByTestId('subtitle-workflow-tab-asr');
    await expect(asrTab).toBeEnabled();

    // Polish, style, and export tabs should be disabled (not navigable yet)
    const polishTab = page.getByTestId('subtitle-workflow-tab-polish');
    await expect(polishTab).toBeDisabled();

    const styleTab = page.getByTestId('subtitle-workflow-tab-style');
    await expect(styleTab).toBeDisabled();

    const exportTab = page.getByTestId('subtitle-workflow-tab-export');
    await expect(exportTab).toBeDisabled();
  });

  test('should close the panel when clicking close button', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    const panel = page.getByTestId('ai-subtitle-workflow-panel');
    await expect(panel).toBeVisible();

    await page.getByTestId('subtitle-workflow-close').click({ force: true });
    await expect(panel).not.toBeVisible();
  });

  test('should show reset button in footer', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    await expect(page.getByTestId('subtitle-workflow-reset')).toBeVisible();
  });

  test('should disable prev button on first stage', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    // Prev button should be disabled on the first stage (ASR)
    await expect(page.getByTestId('subtitle-workflow-prev')).toBeDisabled();
  });

  test('should display selected clip info when a clip is selected', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixtureWithClip!());

    // Should show clip name/info instead of "no clip selected"
    await expect(page.getByTestId('subtitle-workflow-asr-stage').getByText('subtitle-workflow-video.mp4')).toBeVisible();
    // Should NOT show the "no clip selected" message
    await expect(page.getByText('请在时间线上选择一个音频或视频片段')).not.toBeVisible();
  });

  test('should reset workflow when clicking reset button', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    const panel = page.getByTestId('ai-subtitle-workflow-panel');
    await expect(panel).toBeVisible();

    // Click reset
    await page.getByTestId('subtitle-workflow-reset').click({ force: true });

    // Should still be on ASR stage after reset
    const asrStage = page.getByTestId('subtitle-workflow-asr-stage');
    await expect(asrStage).toBeVisible();

    // Future stages should still be disabled after reset
    await expect(page.getByTestId('subtitle-workflow-tab-polish')).toBeDisabled();
    await expect(page.getByTestId('subtitle-workflow-tab-style')).toBeDisabled();
    await expect(page.getByTestId('subtitle-workflow-tab-export')).toBeDisabled();
  });
});
