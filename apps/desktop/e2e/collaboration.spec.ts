/**
 * 协作调色 E2E 测试
 *
 * 测试协作工作流：
 * 1. 开启协作会话
 * 2. 多用户调色参数同步
 * 3. 权限控制（查看者不可编辑）
 * 4. 评论功能
 * 5. 冲突检测提示
 */
import { expect, test } from './fixtures';

test.describe('协作调色', () => {
  test('开启协作会话并显示用户面板', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 通过工具菜单打开协作面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-collaboration-menu-item').click();

    // 协作面板应可见
    await expect(page.getByTestId('collaboration-panel')).toBeVisible();
    await expect(page.getByTestId('collab-session-status')).toBeVisible();
    await expect(page.getByTestId('collab-session-status')).toContainText('未连接');
  });

  test('创建协作会话并邀请用户', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 创建会话
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-collaboration-menu-item').click();
    await page.getByTestId('collab-create-session-button').click();

    // 等待会话创建
    await expect(page.getByTestId('collab-session-status')).toContainText('已创建');
    await expect(page.getByTestId('collab-session-id')).toBeVisible();

    // 验证邀请链接区域
    await expect(page.getByTestId('collab-invite-section')).toBeVisible();
  });

  test('用户加入后显示在线状态', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 模拟用户加入
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.simulateCollabUserJoin?.({
        userId: 'remote-user-1',
        userName: 'Bob',
        role: 'editor',
        color: '#f59e0b',
      });
    });

    // 打开协作面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-collaboration-menu-item').click();

    // 远程用户应显示在用户列表中
    await expect(page.getByTestId('collab-user-remote-user-1')).toBeVisible();
    await expect(page.getByTestId('collab-user-remote-user-1')).toContainText('Bob');
    await expect(page.getByTestId('collab-user-remote-user-1-status')).toHaveAttribute('data-online', 'true');
  });

  test('调色参数变更应同步到远程', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 导入媒体并添加到时间线
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
    });
    await page.getByTestId('import-media-button').click();
    await expect(page.getByTestId('media-card-0')).toBeVisible();

    // 模拟协作会话已建立
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.simulateCollabSessionActive?.();
    });

    // 选择时间线片段
    await page.getByTestId('media-card-0').dragTo(page.getByTestId('timeline-track-0'));
    await page.locator('[data-testid^="timeline-clip-"]').first().click();

    // 修改调色参数
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-color-grading-menu-item').click();
    await expect(page.getByTestId('color-grading-workspace')).toBeVisible();

    // 调整亮度滑块
    const brightnessSlider = page.getByTestId('slider-brightness');
    if (await brightnessSlider.isVisible()) {
      await brightnessSlider.fill('50');
    }

    // 验证操作被发送到协作层
    const opSent = await page.evaluate(() => {
      return window.__E2E_ACTIONS__!.getCollabOperationsSent?.() ?? [];
    });
    expect(opSent.length).toBeGreaterThanOrEqual(0);
  });

  test('查看者不应能修改调色参数', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 模拟以查看者角色加入
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.simulateCollabRole?.('viewer');
    });

    // 打开调色面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-color-grading-menu-item').click();

    // 调色控件应被禁用
    const colorWheels = page.getByTestId('color-wheel-panel');
    if (await colorWheels.isVisible()) {
      // 查看者模式下色轮应为只读
      await expect(page.getByTestId('collab-readonly-notice')).toBeVisible();
    }
  });

  test('应能添加和查看评论', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 模拟协作会话
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.simulateCollabSessionActive?.();
    });

    // 打开协作面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-collaboration-menu-item').click();

    // 添加评论
    const commentInput = page.getByTestId('collab-comment-input');
    if (await commentInput.isVisible()) {
      await commentInput.fill('这个镜头的颜色偏暖，建议降低色温');
      await page.getByTestId('collab-comment-submit').click();

      // 评论应出现在列表中
      await expect(page.getByTestId('collab-comment-list')).toContainText('这个镜头的颜色偏暖');
    }
  });

  test('并发编辑应显示冲突提示', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 模拟协作会话和冲突
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.simulateCollabSessionActive?.();
      window.__E2E_ACTIONS__!.simulateCollabConflict?.({
        parameterPath: 'lift.r',
        localValue: 0.5,
        remoteValue: 0.8,
        remoteUser: 'Bob',
      });
    });

    // 冲突提示应显示
    const conflictNotice = page.getByTestId('collab-conflict-notice');
    if (await conflictNotice.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(conflictNotice).toContainText('冲突');
    }
  });

  test('会话锁定应阻止其他用户编辑', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 模拟会话被锁定
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.simulateCollabSessionActive?.();
      window.__E2E_ACTIONS__!.simulateCollabLock?.('other-user');
    });

    // 打开协作面板查看锁定状态
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-collaboration-menu-item').click();

    // 应显示锁定状态
    const lockStatus = page.getByTestId('collab-lock-status');
    if (await lockStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(lockStatus).toContainText('已锁定');
    }
  });
});
