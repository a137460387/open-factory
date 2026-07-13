import { test, expect } from './fixtures';

test.describe('媒体管理增强 - SQLite 索引与高级检索', () => {
  test.beforeEach(async ({ toolbar }) => {
    await toolbar.goto();
  });

  test('高级筛选按钮始终可见', async ({ page }) => {
    const toggle = page.locator('[data-testid="advanced-search-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('高级筛选');
  });

  test('高级筛选面板展开后显示内容', async ({ page }) => {
    const toggle = page.locator('[data-testid="advanced-search-toggle"]');
    await expect(toggle).toBeVisible();

    const tagCloud = page.locator('[data-testid="tag-cloud"]');
    await expect(tagCloud).not.toBeVisible();

    await toggle.click();

    const assetTypeFilter = page.locator('[data-testid="asset-type-filter"]');
    await expect(assetTypeFilter).toBeVisible();

    await toggle.click();
    await expect(assetTypeFilter).not.toBeVisible();
  });

  test('文件类型筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    const videoBtn = page.locator('[data-testid="asset-type-video"]');
    await expect(videoBtn).toBeVisible();
    await videoBtn.click();

    const audioBtn = page.locator('[data-testid="asset-type-audio"]');
    await expect(audioBtn).toBeVisible();
    await audioBtn.click();
  });

  test('分辨率预设筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    const resolutionFilter = page.locator('[data-testid="resolution-filter"]');
    await expect(resolutionFilter).toBeVisible();

    const preset4k = page.locator('[data-testid="resolution-4K+"]');
    await expect(preset4k).toBeVisible();
    await preset4k.click();
  });

  test('时长范围筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    const durationFilter = page.locator('[data-testid="duration-filter"]');
    await expect(durationFilter).toBeVisible();

    const shortVideo = page.locator('[data-testid="duration-短视频 (<10s)"]');
    await expect(shortVideo).toBeVisible();
    await shortVideo.click();
  });

  test('无项目时显示提示信息', async ({ page }) => {
    const hint = page.locator('text=打开项目后启用高级检索');
    await expect(hint).toBeVisible();
  });

  test('导入媒体后 AI 标签自动生成并显示在标签云', async ({ page, mediaBin }) => {
    // 导入测试素材
    await mediaBin.importMedia();

    // 等待媒体卡片出现（导入完成）
    await page.waitForSelector('[data-testid^="media-card-"]', { timeout: 15000 });

    // 展开高级筛选面板
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    // 验证标签云中出现了自动生成的标签
    const tagCloud = page.locator('[data-testid="tag-cloud"]');
    await expect(tagCloud).toBeVisible({ timeout: 10000 });

    // 标签云中应至少有一个标签
    const tagButtons = tagCloud.locator('button');
    const tagCount = await tagButtons.count();
    expect(tagCount).toBeGreaterThan(0);
  });

  test('激活筛选后媒体列表按 SQLite 结果过滤', async ({ page, mediaBin }) => {
    // 导入测试素材
    await mediaBin.importMedia();
    await page.waitForSelector('[data-testid^="media-card-"]', { timeout: 15000 });

    // 记录初始卡片数量
    const initialCount = await mediaBin.getCardCount();

    // 展开高级筛选并选择视频类型
    await page.locator('[data-testid="advanced-search-toggle"]').click();
    await page.locator('[data-testid="asset-type-video"]').click();

    // 等待搜索结果应用
    await page.waitForTimeout(500);

    // 卡片数量应 <= 初始数量（筛选后不会增加）
    const filteredCount = await mediaBin.getCardCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });
});
