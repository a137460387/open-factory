import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

const settingsPath = 'C:/Users/E2E/AppData/Roaming/open-factory/settings.json';

test('hardware acceleration settings tab is accessible', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 点击硬件加速选项卡
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证硬件加速设置面板已显示
  await expect(page.getByRole('heading', { name: '硬件加速解码' })).toBeVisible();
});

test('hardware acceleration mode can be changed', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 选择"始终启用"模式
  await page.getByLabel('始终启用').click();

  // 验证设置已持久化
  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath))
    .toContain('"mode": "enabled"');
});

test('hardware acceleration preferred backend can be changed', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 选择 CUDA 后端
  await page.locator('select').selectOption('cuda');

  // 验证设置已持久化
  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath))
    .toContain('"preferredBackend": "cuda"');
});

test('hardware acceleration settings persist across reloads', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  // 打开设置对话框并修改设置
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-hardware-acceleration').click();
  await page.getByLabel('禁用').click();

  // 重新加载页面
  await page.reload();
  await waitForE2eActions(page);

  // 再次打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证"禁用"选项仍然被选中
  await expect(page.getByLabel('禁用')).toBeChecked();
});
