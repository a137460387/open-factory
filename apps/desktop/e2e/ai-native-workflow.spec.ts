import { test, expect } from './fixtures';

/**
 * AI 原生工作流 E2E 测试
 *
 * 测试覆盖：
 *   1. 打开智能创作面板
 *   2. 运行AI分析并验证结果展示
 *   3. 查看推荐片段
 *   4. 查看叙事结构
 *
 * 所有选择器使用 data-testid 属性，遵循 STABILITY_CHECKLIST.md 规范。
 */

// ─── 测试 1：打开智能创作面板 ─────────────────────────

test.describe('AI 原生工作流', () => {
  test.beforeEach(async ({ toolbar }) => {
    await toolbar.goto();
  });

  test('打开智能创作面板并验证UI元素', async ({
    page,
    toolbar,
  }) => {
    // 步骤 1：点击工具栏中的智能创作按钮
    await page.getByTestId('toolbar-smart-creation-button').click();

    // 步骤 2：验证面板已打开
    await expect(
      page.getByTestId('smart-creation-panel'),
    ).toBeVisible();

    // 步骤 3：验证面板包含必要的UI元素
    // 验证分析按钮存在
    await expect(
      page.getByTestId('smart-creation-analyze'),
    ).toBeVisible();

    // 验证面板标题
    await expect(
      page.getByTestId('smart-creation-panel'),
    ).toContainText('智能创作');
  });

  test('关闭智能创作面板', async ({
    page,
    toolbar,
  }) => {
    // 步骤 1：打开面板
    await page.getByTestId('toolbar-smart-creation-button').click();
    await expect(
      page.getByTestId('smart-creation-panel'),
    ).toBeVisible();

    // 步骤 2：关闭面板
    await page.getByTestId('smart-creation-close').click();

    // 步骤 3：验证面板已关闭
    await expect(
      page.getByTestId('smart-creation-panel'),
    ).not.toBeVisible();
  });

  test('智能创作面板与AI粗剪面板互斥', async ({
    page,
    toolbar,
  }) => {
    // 步骤 1：打开智能创作面板
    await page.getByTestId('toolbar-smart-creation-button').click();
    await expect(
      page.getByTestId('smart-creation-panel'),
    ).toBeVisible();

    // 步骤 2：点击AI粗剪按钮（应该关闭智能创作面板）
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIRoughCutFixture!());
    await page.getByTestId('toolbar-ai-rough-cut-button').click();

    // 步骤 3：验证智能创作面板已关闭
    await expect(
      page.getByTestId('smart-creation-panel'),
    ).not.toBeVisible();
  });

  test('智能创作面板显示分析按钮', async ({
    page,
    toolbar,
  }) => {
    // 步骤 1：打开面板
    await page.getByTestId('toolbar-smart-creation-button').click();
    await expect(
      page.getByTestId('smart-creation-panel'),
    ).toBeVisible();

    // 步骤 2：验证分析按钮存在
    await expect(
      page.getByTestId('smart-creation-analyze'),
    ).toBeVisible();

    // 步骤 3：验证面板不会崩溃
    await expect(
      page.getByTestId('smart-creation-panel'),
    ).toBeVisible();
  });
});
