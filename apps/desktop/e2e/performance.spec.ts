import { test, expect } from '@playwright/test';

test.describe('Timeline Performance for Large Projects', () => {
  test.skip('should render timeline with 1000 clips within performance budget', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="import-media-button"]', { timeout: 15_000 });

    // 使用 E2E actions 创建大型项目
    const startTime = Date.now();
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.createLargeProject!({ clipCount: 1000 });
    });

    // 等待时间线渲染完成
    await page.waitForSelector('[data-testid="timeline-ruler"]', { timeout: 15_000 });
    const renderTime = Date.now() - startTime;

    // 断言渲染时间在 10 秒内（CI 环境性能有限）
    expect(renderTime).toBeLessThan(10_000);

    // 验证虚拟化正常工作：只有可见区域的片段被渲染
    const visibleClips = await page.locator('[data-testid^="timeline-clip-"]').count();
    expect(visibleClips).toBeLessThan(100); // 虚拟化应该限制渲染数量
    expect(visibleClips).toBeGreaterThan(0);
  });

  test.skip('should maintain smooth scrolling with many clips', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="import-media-button"]', { timeout: 15_000 });

    // 创建大型项目
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.createLargeProject!({ clipCount: 500 });
    });
    await page.waitForSelector('[data-testid="timeline-ruler"]', { timeout: 10_000 });

    // 获取时间线滚动容器
    const timeline = page.locator('[data-testid="timeline-scroll-container"]');
    await expect(timeline).toBeVisible();

    // 执行快速滚动
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // 模拟快速水平滚动
    for (let i = 0; i < 10; i++) {
      await timeline.evaluate((el) => {
        el.scrollLeft += 500;
      });
      await page.waitForTimeout(50); // 短暂等待以允许渲染
    }

    // 验证没有控制台错误
    const criticalErrors = errors.filter((e) => !e.includes('ResizeObserver'));
    expect(criticalErrors).toHaveLength(0);

    // 验证滚动后仍有可见的片段
    const visibleClips = await page.locator('[data-testid^="timeline-clip-"]').count();
    expect(visibleClips).toBeGreaterThan(0);
  });

  test.skip('should handle track virtualization correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="import-media-button"]', { timeout: 15_000 });

    // 创建多轨道项目
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.createLargeProject!({ trackCount: 20, clipsPerTrack: 50 });
    });
    await page.waitForSelector('[data-testid="timeline-ruler"]', { timeout: 10_000 });

    // 验证轨道虚拟化：只有可见轨道被渲染
    const trackHeaders = await page.locator('[data-testid^="track-header-"]').count();
    expect(trackHeaders).toBeLessThan(20); // 应该少于总轨道数
    expect(trackHeaders).toBeGreaterThan(0);

    // 滚动到其他轨道
    const timeline = page.locator('[data-testid="timeline-scroll-container"]');
    await timeline.evaluate((el) => {
      el.scrollTop = 500;
    });

    // 等待渲染更新
    await page.waitForTimeout(100);

    // 验证滚动后轨道仍然可见
    const trackHeadersAfterScroll = await page.locator('[data-testid^="track-header-"]').count();
    expect(trackHeadersAfterScroll).toBeGreaterThan(0);
  });

  test.skip('should use deferred values for non-critical updates', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="import-media-button"]', { timeout: 15_000 });

    // 创建项目并启用热图
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.createLargeProject!({ clipCount: 300 });
      window.__E2E_ACTIONS__!.enableHeatmap!(true);
    });
    await page.waitForSelector('[data-testid="timeline-ruler"]', { timeout: 10_000 });

    // 验证热图渲染（使用 deferred value）
    const heatmap = page.locator('[data-testid="timeline-heatmap-canvas"]');
    await expect(heatmap).toBeVisible({ timeout: 5_000 });

    // 快速滚动应该不会导致热图闪烁
    const timeline = page.locator('[data-testid="timeline-scroll-container"]');
    for (let i = 0; i < 5; i++) {
      await timeline.evaluate((el) => {
        el.scrollLeft += 300;
      });
      await page.waitForTimeout(30);
    }

    // 热图应该仍然可见
    await expect(heatmap).toBeVisible();
  });
});
