import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

// ASR 阶段已退役（断链死代码），工作流为润色 → 样式 → 导出三阶段，
// 本 spec 仅覆盖面板壳层；转写生成字幕由 smart-rough-cut.spec 的 whisper 步覆盖。
test.describe('智能字幕工作流', () => {
  test('should display the workflow panel with 3 stage tabs', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    const panel = page.getByTestId('ai-subtitle-workflow-panel');
    await expect(panel).toBeVisible();

    await expect(page.getByTestId('subtitle-workflow-tab-polish')).toBeVisible();
    await expect(page.getByTestId('subtitle-workflow-tab-style')).toBeVisible();
    await expect(page.getByTestId('subtitle-workflow-tab-export')).toBeVisible();
  });

  test('should show polish stage by default', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    const polishStage = page.getByTestId('subtitle-workflow-polish-stage');
    await expect(polishStage).toBeVisible();
  });

  test('should disable later stages initially', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    // Polish tab should be active/enabled (first stage)
    const polishTab = page.getByTestId('subtitle-workflow-tab-polish');
    await expect(polishTab).toBeEnabled();

    // Style and export tabs should be disabled (not navigable yet)
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

    // Prev button should be disabled on the first stage (polish)
    await expect(page.getByTestId('subtitle-workflow-prev')).toBeDisabled();
  });

  test('should reset workflow when clicking reset button', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleWorkflowFixture!());

    const panel = page.getByTestId('ai-subtitle-workflow-panel');
    await expect(panel).toBeVisible();

    // Click reset
    await page.getByTestId('subtitle-workflow-reset').click({ force: true });

    // Should still be on polish stage after reset
    const polishStage = page.getByTestId('subtitle-workflow-polish-stage');
    await expect(polishStage).toBeVisible();

    // Later stages should still be disabled after reset
    await expect(page.getByTestId('subtitle-workflow-tab-style')).toBeDisabled();
    await expect(page.getByTestId('subtitle-workflow-tab-export')).toBeDisabled();
  });
});
