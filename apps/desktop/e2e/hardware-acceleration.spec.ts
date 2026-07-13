import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('hardware acceleration settings tab is accessible', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 切换到硬件加速标签
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证硬件加速设置面板可见
  await expect(page.getByText('硬件加速解码')).toBeVisible();
  await expect(page.getByText('加速模式')).toBeVisible();
});

test('hardware acceleration mode can be changed', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 切换到硬件加速标签
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证默认选中自动模式
  const autoRadio = page.locator('input[name="hw-accel-mode"][value="auto"]');
  await expect(autoRadio).toBeChecked();

  // 切换到禁用模式
  const disabledRadio = page.locator('input[name="hw-accel-mode"][value="disabled"]');
  await disabledRadio.click();

  // 验证禁用模式下不显示后端选择
  await expect(page.getByText('首选后端')).not.toBeVisible();
});

test('hardware acceleration shows capabilities', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 切换到硬件加速标签
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证硬件能力检测区域可见
  await expect(page.getByText('硬件能力检测')).toBeVisible();
  await expect(page.getByText('推荐后端')).toBeVisible();
});

test('hardware acceleration frame cache settings', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 切换到硬件加速标签
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证帧缓存设置可见
  await expect(page.getByText('帧缓存')).toBeVisible();
  await expect(page.getByText('启用帧缓存')).toBeVisible();

  // 验证缓存帧数输入框可见
  const cacheSizeInput = page.locator('input[type="number"][min="5"]');
  await expect(cacheSizeInput).toBeVisible();
});

test('hardware acceleration pre-decode settings', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // 打开设置对话框
  await page.getByTestId('toolbar-settings-button').click();

  // 切换到硬件加速标签
  await page.getByTestId('settings-tab-hardware-acceleration').click();

  // 验证预解码设置可见
  await expect(page.getByText('预解码')).toBeVisible();
  await expect(page.getByText('启用预解码')).toBeVisible();

  // 验证预解码帧数输入框可见
  const preDecodeInput = page.locator('input[type="number"][min="1"]');
  await expect(preDecodeInput).toBeVisible();
});
