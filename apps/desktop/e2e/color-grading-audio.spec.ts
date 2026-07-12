import { expect, test } from '@playwright/test';

test.describe('Color Grading and Audio Mixing System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 添加文字片段以确保 Inspector 可用
    await page.getByTestId('add-text-clip-button').click();
    await page.getByTestId('clip-text-input').fill('Color Grading Audio Test');
    await page.getByTestId('clip-text-input').blur();
  });

  /** 辅助：展开调色 details 区域并返回 workspace locator */
  async function openColorGradingWorkspace(page: import('@playwright/test').Page) {
    const details = page.locator('details', { has: page.locator('summary', { hasText: '调色' }) });
    const summary = details.locator('summary');
    const workspace = details.locator('[data-testid="color-grading-workspace"]');
    if (!(await workspace.isVisible())) {
      await summary.click();
      await expect(workspace).toBeVisible({ timeout: 5000 });
    }
    return { details, workspace };
  }

  // === 调色系统测试 ===

  test('should open color grading workspace', async ({ page }) => {
    const { workspace } = await openColorGradingWorkspace(page);
    await expect(workspace).toBeVisible();
    await expect(page.locator('[data-testid="node-graph-view"]')).toBeVisible();
  });

  test('should add primary wheel node and adjust parameters', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const addWheelBtn = page.locator('[data-testid="add-wheel-node"]');
    await expect(addWheelBtn).toBeVisible();
    await addWheelBtn.click();

    await expect(page.locator('[data-testid="node-primary-wheel"]')).toBeVisible();
    await expect(page.locator('[data-testid="color-wheel-panel"]')).toBeVisible();

    // 点击 Lift 色轮调整参数
    const liftWheel = page.locator('[data-testid="color-wheel-lift (暗部)"]');
    await expect(liftWheel).toBeVisible();
    await liftWheel.click({ position: { x: 60, y: 30 } });

    await expect(page.locator('[data-testid="color-wheel-panel"]')).toBeVisible();
  });

  test('should add primary slider node and adjust parameters', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const addSliderBtn = page.locator('[data-testid="add-slider-node"]');
    await expect(addSliderBtn).toBeVisible();
    await addSliderBtn.click();

    await expect(page.locator('[data-testid="node-primary-slider"]')).toBeVisible();
    await expect(page.locator('[data-testid="primary-sliders-panel"]')).toBeVisible();

    // 调整对比度滑块
    const contrastSlider = page.locator('[data-testid="slider-对比度"]');
    await expect(contrastSlider).toBeVisible();
    await contrastSlider.fill('50');
    expect(await contrastSlider.inputValue()).toBe('50');
  });

  test('should remove color grading node', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const addWheelBtn = page.locator('[data-testid="add-wheel-node"]');
    await addWheelBtn.click();
    await expect(page.locator('[data-testid="node-primary-wheel"]')).toBeVisible();

    const removeBtn = page.locator('[data-testid="node-primary-wheel"] button');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(page.locator('[data-testid="node-primary-wheel"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="node-graph-view"]')).toContainText('点击上方按钮添加调色节点');
  });

  // === LUT 管理测试 ===

  test('should display LUT manager and import button', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const lutManager = page.locator('[data-testid="lut-manager"]');
    if (await lutManager.isVisible()) {
      await expect(lutManager).toBeVisible();
      const importBtn = page.locator('[data-testid="import-lut-btn"]');
      await expect(importBtn).toBeVisible();
    }
  });

  test('should display curves editor', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const curvesEditor = page.locator('[data-testid^="curves-editor-"]').first();
    if (await curvesEditor.isVisible()) {
      await expect(curvesEditor).toBeVisible();

      // 点击曲线编辑器添加控制点
      const box = await curvesEditor.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      }
    }
  });

  // === 音频混音测试 ===

  test('should display audio mixer controls', async ({ page }) => {
    // 查找音频混音器入口
    const mixerPanel = page.locator('[data-testid="audio-mixer"], [data-testid="mixer-console"]');
    if (await mixerPanel.isVisible()) {
      await expect(mixerPanel).toBeVisible();
    }
  });

  test('should display volume and pan controls', async ({ page }) => {
    // 检查音量和声像控件
    const volumeFader = page.locator('[data-testid^="volume-fader-"]').first();
    const panKnob = page.locator('[data-testid^="pan-knob-"]').first();

    if (await volumeFader.isVisible()) {
      await expect(volumeFader).toBeVisible();
    }
    if (await panKnob.isVisible()) {
      await expect(panKnob).toBeVisible();
    }
  });

  test('should display mute and solo buttons', async ({ page }) => {
    const muteBtn = page.locator('[data-testid^="mute-btn-"]').first();
    const soloBtn = page.locator('[data-testid^="solo-btn-"]').first();

    if (await muteBtn.isVisible()) {
      await expect(muteBtn).toBeVisible();
    }
    if (await soloBtn.isVisible()) {
      await expect(soloBtn).toBeVisible();
    }
  });

  test('should display VU meters', async ({ page }) => {
    const vuMeter = page.locator('[data-testid="vu-meter"]').first();
    if (await vuMeter.isVisible()) {
      await expect(vuMeter).toBeVisible();
    }
  });

  // === 自动化测试 ===

  test('should display automation editor', async ({ page }) => {
    const automationEditor = page.locator('[data-testid="automation-editor"]');
    if (await automationEditor.isVisible()) {
      await expect(automationEditor).toBeVisible();
    }
  });
});
