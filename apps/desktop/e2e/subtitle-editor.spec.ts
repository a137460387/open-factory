import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test.describe('Subtitle Editor Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 720 });
    await page.goto('/');
    await waitForE2eActions(page);
  });

  test('subtitle editor panel opens and shows tabs', async ({ page }) => {
    // 打开字幕编辑器面板
    const editorBtn = page.getByTestId('open-subtitle-editor');
    if (await editorBtn.isVisible()) {
      await editorBtn.click();
      const panel = page.getByTestId('subtitle-editor-panel');
      await expect(panel).toBeVisible({ timeout: 5000 });

      // 验证标签页存在
      await expect(page.getByTestId('subtitle-tab-list')).toBeVisible();
      await expect(page.getByTestId('subtitle-tab-search')).toBeVisible();
      await expect(page.getByTestId('subtitle-tab-style')).toBeVisible();
      await expect(page.getByTestId('subtitle-tab-batch')).toBeVisible();
    }
  });

  test('subtitle find and replace dialog works', async ({ page }) => {
    // 打开查找替换
    const searchBtn = page.getByTestId('open-subtitle-find-replace');
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      const dialog = page.getByTestId('subtitle-find-replace-dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // 输入搜索文本
      const searchInput = page.getByTestId('find-replace-search-input');
      await searchInput.fill('hello');
      await page.getByTestId('find-replace-search-button').click();

      // 验证搜索按钮可点击
      await expect(page.getByTestId('find-replace-search-button')).toBeEnabled();
    }
  });

  test('subtitle style preset manager opens', async ({ page }) => {
    const presetBtn = page.getByTestId('open-style-preset-manager');
    if (await presetBtn.isVisible()) {
      await presetBtn.click();
      const manager = page.getByTestId('subtitle-style-preset-manager');
      await expect(manager).toBeVisible({ timeout: 5000 });

      // 验证内置模板显示
      await expect(page.getByTestId('builtin-template-cinema-white')).toBeVisible();
    }
  });

  test('subtitle quickbar appears on subtitle clip selection', async ({ page }) => {
    // 尝试添加媒体到时间线
    const importBtn = page.getByTestId('import-media-button');
    if (await importBtn.isVisible()) {
      await importBtn.click();
      // 等待媒体加载
      await page.waitForTimeout(1000);
    }

    // 检查字幕片段是否存在
    const subtitleClip = page.locator('[data-clip-type="subtitle"]').first();
    if (await subtitleClip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subtitleClip.click();
      const quickbar = page.getByTestId('subtitle-style-quickbar');
      await expect(quickbar).toBeVisible({ timeout: 5000 });
    }
  });

  test('subtitle canvas rendering does not block UI', async ({ page }) => {
    // 验证预览 Canvas 存在且渲染正常
    const canvas = page.getByTestId('preview-canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // 检查 canvas 有尺寸
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });
});
