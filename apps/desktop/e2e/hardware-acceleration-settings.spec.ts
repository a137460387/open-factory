import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('hardware acceleration settings tab is accessible', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 点击硬件加速选项卡
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证硬件加速设置面板已显示
  await expect(page.getByRole('heading', { name: '硬件加速解码' })).toBeVisible();
  await expect(page.getByText('加速模式', { exact: true })).toBeVisible();
});

test('hardware acceleration shows capabilities section', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 切换到硬件加速标签
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证硬件能力检测区域标题可见
  await expect(page.getByText('硬件能力检测', { exact: true })).toBeVisible();
  await expect(page.getByText('刷新', { exact: true })).toBeVisible();
});

test('hardware acceleration shows frame cache settings', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 切换到硬件加速标签
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证帧缓存设置可见
  await expect(page.getByText('帧缓存', { exact: true })).toBeVisible();
  await expect(page.getByText('启用帧缓存', { exact: true })).toBeVisible();
});

test('hardware acceleration shows pre-decode settings', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 切换到硬件加速标签
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证预解码设置可见
  await expect(page.getByText('预解码', { exact: true })).toBeVisible();
  await expect(page.getByText('启用预解码', { exact: true })).toBeVisible();
});
