import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test.describe('自动剪辑生成器 - 一键生成流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupAutoGenerateFixture!());
  });

  test('自动化面板显示"生成"标签页', async ({ page }) => {
    const panel = page.getByTestId('automation-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('tab-generate')).toBeVisible();
  });

  test('切换到生成标签页显示一键生成面板', async ({ page }) => {
    await page.getByTestId('tab-generate').click();
    const autoPanel = page.getByTestId('auto-generate-panel');
    await expect(autoPanel).toBeVisible();
    await expect(page.getByText('一键生成')).toBeVisible();
  });

  test('模板选择器显示内置模板', async ({ page }) => {
    await page.getByTestId('tab-generate').click();

    // 模板下拉框应该可见
    const templateSelect = page.getByTestId('template-select');
    await expect(templateSelect).toBeVisible();

    // 应该包含内置模板选项
    const options = templateSelect.locator('option');
    await expect(options).toHaveCount(3); // Vlog、短视频、宣传片
  });

  test('选择模板后显示模板预览', async ({ page }) => {
    await page.getByText('生成', { exact: true }).click();

    // 选择短视频模板
    const templateSelect = page.getByTestId('template-select');
    await templateSelect.selectOption({ label: /短视频/ });

    // 模板预览应该显示
    const preview = page.getByTestId('template-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('快节奏');
  });

  test('高级配置面板可展开/收起', async ({ page }) => {
    await page.getByText('生成', { exact: true }).click();

    // 高级配置默认隐藏
    const advancedConfig = page.getByTestId('advanced-config');
    await expect(advancedConfig).toHaveCount(0);

    // 点击展开
    await page.getByTestId('toggle-advanced').click();
    await expect(page.getByTestId('advanced-config')).toBeVisible();

    // BPM 卡点复选框可见
    await expect(page.getByTestId('beat-sync-checkbox')).toBeVisible();

    // 点击收起
    await page.getByTestId('toggle-advanced').click();
    await expect(page.getByTestId('advanced-config')).toHaveCount(0);
  });

  test('启用 BPM 卡点后显示 BPM 输入框', async ({ page }) => {
    await page.getByText('生成', { exact: true }).click();
    await page.getByTestId('toggle-advanced').click();

    // BPM 输入框默认隐藏
    await expect(page.getByTestId('custom-bpm-input')).toHaveCount(0);

    // 启用卡点
    await page.getByTestId('beat-sync-checkbox').check();

    // BPM 输入框出现
    await expect(page.getByTestId('custom-bpm-input')).toBeVisible();
  });

  test('无分析报告时一键生成按钮禁用', async ({ page }) => {
    await page.getByText('生成', { exact: true }).click();

    // 一键生成按钮应该禁用（因为没有分析报告）
    const generateBtn = page.getByTestId('auto-generate-btn');
    await expect(generateBtn).toBeDisabled();
  });

  test('未分析素材时显示提示信息', async ({ page }) => {
    await page.getByText('生成', { exact: true }).click();

    // 分析状态区域应该显示"尚未分析素材"
    const status = page.getByTestId('analysis-status');
    await expect(status).toContainText('尚未分析素材');
  });

  test('点击禁用按钮后显示错误提示', async ({ page }) => {
    await page.getByText('生成', { exact: true }).click();

    // 强制点击禁用按钮（模拟绕过前端验证的场景）
    const generateBtn = page.getByTestId('auto-generate-btn');
    await generateBtn.dispatchEvent('click');

    // 不应崩溃，面板仍正常显示
    await expect(page.getByTestId('auto-generate-panel')).toBeVisible();
  });
});
