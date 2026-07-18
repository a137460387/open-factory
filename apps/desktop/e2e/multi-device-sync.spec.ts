/**
 * 多设备同步 E2E 测试
 *
 * 测试多设备同步工作流：
 * 1. 打开同步面板
 * 2. 查看设备列表
 * 3. 同步状态显示
 * 4. 冲突解决
 * 5. 离线队列
 * 6. 同步设置
 */
import { expect, test } from './fixtures';

test.describe('多设备同步', () => {
  test('打开同步面板', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 通过工具菜单打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 同步面板应可见
    await expect(page.getByTestId('sync-panel')).toBeVisible();
  });

  test('显示当前设备信息', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 验证当前设备信息显示
    await expect(page.getByTestId('sync-local-device')).toBeVisible();
    await expect(page.getByTestId('sync-local-device-name')).toBeVisible();
  });

  test('显示同步状态', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 验证同步状态卡片
    await expect(page.getByTestId('sync-status-card')).toBeVisible();
    await expect(page.getByTestId('sync-version-card')).toBeVisible();
    await expect(page.getByTestId('sync-devices-card')).toBeVisible();
  });

  test('暂停和恢复同步', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 点击暂停按钮
    await page.getByTestId('sync-pause-button').click();

    // 验证同步已暂停
    await expect(page.getByTestId('sync-status-text')).toContainText('已暂停');

    // 点击恢复按钮
    await page.getByTestId('sync-resume-button').click();

    // 验证同步已恢复
    await expect(page.getByTestId('sync-status-text')).toContainText('空闲');
  });

  test('手动触发同步', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 点击立即同步按钮
    await page.getByTestId('sync-manual-sync-button').click();

    // 验证同步中状态
    await expect(page.getByTestId('sync-status-text')).toContainText('同步中');
  });

  test('显示远程设备列表', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 模拟远程设备
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.simulateRemoteDevice?.({
        id: 'device-2',
        name: 'MacBook Pro',
        type: 'laptop',
        platform: 'macOS',
        osVersion: '14.0',
        appVersion: '1.0.0',
        lastSeenAt: new Date().toISOString(),
        status: 'online',
        metadata: {
          capabilities: {
            canEdit: true,
            canExport: true,
            canRender: true,
            maxResolution: '4K',
            supportedFormats: ['mp4', 'mov'],
          },
          storageUsed: 50000000000,
          storageLimit: 500000000000,
          networkType: 'wifi',
          batteryLevel: 85,
        },
      });
    });

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 验证远程设备列表
    await expect(page.getByTestId('sync-remote-device')).toHaveCount(1);
  });

  test('显示同步设置', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 点击设置按钮
    await page.getByTestId('sync-settings-button').click();

    // 验证设置面板可见
    await expect(page.getByTestId('sync-settings-panel')).toBeVisible();
    await expect(page.getByTestId('sync-auto-sync-toggle')).toBeVisible();
    await expect(page.getByTestId('sync-wifi-only-toggle')).toBeVisible();
    await expect(page.getByTestId('sync-compression-toggle')).toBeVisible();
  });

  test('更改冲突解决策略', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 打开设置
    await page.getByTestId('sync-settings-button').click();

    // 更改冲突解决策略
    await page.getByTestId('sync-conflict-resolution-select').selectOption('local-wins');

    // 验证设置已保存
    await expect(page.getByTestId('sync-settings-saved-toast')).toBeVisible();
  });

  test('显示同步统计', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 验证统计信息区域
    await expect(page.getByTestId('sync-stats-section')).toBeVisible();
    await expect(page.getByTestId('sync-stats-operations')).toBeVisible();
    await expect(page.getByTestId('sync-stats-conflicts')).toBeVisible();
  });

  test('显示存储信息', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开同步面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-sync-menu-item').click();

    // 验证存储信息区域
    await expect(page.getByTestId('sync-storage-section')).toBeVisible();
    await expect(page.getByTestId('sync-storage-progress')).toBeVisible();
  });
});
