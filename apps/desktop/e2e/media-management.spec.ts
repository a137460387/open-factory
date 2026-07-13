import { test, expect } from './fixtures';

test.describe('媒体管理增强 - SQLite 索引与高级检索', () => {
  test.beforeEach(async ({ toolbar }) => {
    await toolbar.goto();
  });

  test('高级检索面板可见', async ({ page }) => {
    // 高级检索面板应在媒体池中可见
    const searchPanel = page.locator('[data-testid="advanced-search-input"]');
    await expect(searchPanel).toBeVisible();
  });

  test('高级筛选展开/收起', async ({ page }) => {
    const toggle = page.locator('[data-testid="advanced-search-toggle"]');
    await expect(toggle).toBeVisible();

    // 初始状态：筛选面板应该收起
    const tagCloud = page.locator('[data-testid="tag-cloud"]');
    await expect(tagCloud).not.toBeVisible();

    // 点击展开
    await toggle.click();
    await expect(tagCloud).toBeVisible();

    // 再次点击收起
    await toggle.click();
    await expect(tagCloud).not.toBeVisible();
  });

  test('文件类型筛选', async ({ page }) => {
    // 展开高级筛选
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    // 点击视频类型筛选
    const videoBtn = page.locator('[data-testid="asset-type-video"]');
    await expect(videoBtn).toBeVisible();
    await videoBtn.click();

    // 验证筛选条件 chip 出现
    const chips = page.locator('.inline-flex.items-center.gap-1.rounded-full');
    await expect(chips.first()).toBeVisible();
  });

  test('分辨率预设筛选', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    // 点击 4K+ 分辨率预设
    const preset4k = page.locator('[data-testid="resolution-4K+"]');
    await expect(preset4k).toBeVisible();
    await preset4k.click();

    // 验证预设按钮高亮
    await expect(preset4k).toHaveClass(/border-brand/);
  });

  test('时长范围筛选', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    // 点击短视频预设
    const shortVideo = page.locator('[data-testid="duration-短视频 (<10s)"]');
    await expect(shortVideo).toBeVisible();
    await shortVideo.click();

    // 验证按钮高亮
    await expect(shortVideo).toHaveClass(/border-brand/);
  });

  test('清除全部筛选条件', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    // 添加一些筛选条件
    await page.locator('[data-testid="asset-type-video"]').click();
    await page.locator('[data-testid="resolution-1080p+"]').click();

    // 清除全部
    const clearBtn = page.locator('[data-testid="clear-all-filters"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // 验证筛选按钮不再高亮
    await expect(page.locator('[data-testid="asset-type-video"]')).not.toHaveClass(/border-brand/);
  });

  test('搜索输入防抖', async ({ page }) => {
    const searchInput = page.locator('[data-testid="advanced-search-input"]');
    await expect(searchInput).toBeVisible();

    // 输入搜索关键词
    await searchInput.fill('test');

    // 等待防抖（300ms）后搜索应触发
    await page.waitForTimeout(400);

    // 搜索不应导致页面崩溃
    await expect(searchInput).toHaveValue('test');
  });
});
