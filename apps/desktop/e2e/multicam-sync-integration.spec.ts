import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test.describe('多机位剪辑 - 音频同步与切片集成', () => {
  test('完整流程：创建多机位 -> 音频同步 -> 播放切换 -> 验证切片序列', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 1. 加载多机位素材（两个机位的视频片段，已选中）
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupMulticamFixture!());

    // 2. 点击创建多机位序列
    await expect(page.getByTestId('toolbar-create-multicam-button')).toBeEnabled();
    await page.getByTestId('toolbar-create-multicam-button').click();

    // 3. 验证多机位预览网格出现
    await expect(page.getByTestId('multicam-preview-grid')).toBeVisible();
    await expect(page.getByTestId('multicam-angle-button-angle-1')).toBeVisible();
    await expect(page.getByTestId('multicam-angle-button-angle-2')).toBeVisible();

    // 4. 启用实时模式
    await page.getByTestId('multicam-live-mode-toggle').click();
    await expect(page.getByTestId('multicam-live-mode-toggle')).toHaveAttribute('data-active', 'true');

    // 5. 播放并在不同时间点切换机位
    await page.getByTestId('toolbar-playback-button').click();

    // 在 t=1s 切换到 angle-2
    await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(1));
    await page.keyboard.press('2');

    // 等待切换点记录
    await expect
      .poll(() =>
        page.evaluate(() => {
          const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
            multicam?: { switches: Array<{ time: number; angleId: string }> };
          };
          return clip.multicam?.switches.length ?? 0;
        })
      )
      .toBe(2);

    // 6. 验证切换序列正确：初始 angle-1 @ t=0，然后 angle-2 @ t≈1
    const switches = await page.evaluate(() => {
      const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
        multicam?: { switches: Array<{ time: number; angleId: string }> };
      };
      return clip.multicam?.switches ?? [];
    });

    expect(switches).toHaveLength(2);
    expect(switches[0].angleId).toBe('angle-1');
    expect(switches[0].time).toBe(0);
    expect(switches[1].angleId).toBe('angle-2');
    expect(switches[1].time).toBeGreaterThanOrEqual(0.9);
    expect(switches[1].time).toBeLessThan(2.0);

    // 7. 验证切换历史面板显示正确
    await expect(page.locator('[data-testid^="multicam-history-row-"][data-angle-id="angle-2"]')).toHaveCount(1);

    // 8. 撤销切换，验证恢复
    await page.getByTestId('toolbar-undo-button').click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
            multicam?: { switches: Array<{ time: number; angleId: string }> };
          };
          return clip.multicam?.switches.length ?? 0;
        })
      )
      .toBe(1);

    // 9. 重做切换
    await page.getByTestId('toolbar-redo-button').click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
            multicam?: { switches: Array<{ time: number; angleId: string }> };
          };
          return clip.multicam?.switches.length ?? 0;
        })
      )
      .toBe(2);
  });

  test('多机位音频同步：选择同步模式并执行同步', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 加载独立多机位夹具（已进入编辑模式）
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupIndependentMulticamFixture!());

    // 等待同步控制区域可见
    await expect(page.getByTestId('sync-controls')).toBeVisible();

    // 选择音频同步模式
    await page.getByTestId('sync-mode-audio').click();

    // 点击同步按钮
    await page.getByTestId('sync-button').click();

    // 等待同步完成（按钮文本恢复为"开始同步"）
    await expect(page.getByTestId('sync-button')).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByTestId('sync-button')).toHaveText('开始同步', { timeout: 15_000 });
  });

  test('多机位漂移检测', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 加载独立多机位夹具
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupIndependentMulticamFixture!());

    // 等待漂移检测按钮可见
    await expect(page.getByTestId('drift-detection-button')).toBeVisible();

    // 点击漂移检测按钮
    await page.getByTestId('drift-detection-button').click();

    // 等待检测结果出现
    await expect(page.getByTestId('drift-message')).toBeVisible({ timeout: 15_000 });

    // 验证结果包含有效信息
    const message = await page.getByTestId('drift-message').textContent();
    expect(message!.length).toBeGreaterThan(0);
  });
});
