import { test, expect } from './fixtures';

test.describe('媒体管理增强 - SQLite 索引与高级检索', () => {
  test.beforeEach(async ({ toolbar }) => {
    await toolbar.goto();
  });

  test('高级筛选按钮始终可见', async ({ page }) => {
    // 高级筛选按钮应在媒体池中始终可见
    const toggle = page.locator('[data-testid="advanced-search-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('高级筛选');
  });

  test('高级筛选面板展开后显示内容', async ({ page }) => {
    const toggle = page.locator('[data-testid="advanced-search-toggle"]');
    await expect(toggle).toBeVisible();

    // 初始状态：标签云应该不可见（面板收起）
    const tagCloud = page.locator('[data-testid="tag-cloud"]');
    await expect(tagCloud).not.toBeVisible();

    // 点击展开
    await toggle.click();

    // 展开后应显示文件类型筛选区域
    const assetTypeFilter = page.locator('[data-testid="asset-type-filter"]');
    await expect(assetTypeFilter).toBeVisible();

    // 再次点击收起
    await toggle.click();
    await expect(assetTypeFilter).not.toBeVisible();
  });

  test('文件类型筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    // 视频类型筛选按钮应可见
    const videoBtn = page.locator('[data-testid="asset-type-video"]');
    await expect(videoBtn).toBeVisible();

    // 点击不应崩溃
    await videoBtn.click();

    // 音频类型筛选按钮也应可交互
    const audioBtn = page.locator('[data-testid="asset-type-audio"]');
    await expect(audioBtn).toBeVisible();
    await audioBtn.click();
  });

  test('分辨率预设筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    // 分辨率预设按钮应可见
    const resolutionFilter = page.locator('[data-testid="resolution-filter"]');
    await expect(resolutionFilter).toBeVisible();

    const preset4k = page.locator('[data-testid="resolution-4K+"]');
    await expect(preset4k).toBeVisible();
    await preset4k.click();
  });

  test('时长范围筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    // 时长筛选区域应可见
    const durationFilter = page.locator('[data-testid="duration-filter"]');
    await expect(durationFilter).toBeVisible();

    const shortVideo = page.locator('[data-testid="duration-短视频 (<10s)"]');
    await expect(shortVideo).toBeVisible();
    await shortVideo.click();
  });

  test('无项目时显示提示信息', async ({ page }) => {
    // 当没有加载项目时，搜索区域应显示提示
    const hint = page.locator('text=打开项目后启用高级检索');
    await expect(hint).toBeVisible();
  });
});
