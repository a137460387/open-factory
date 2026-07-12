import { expect, test } from '@playwright/test';

test.describe('Color Grading System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待应用加载：添加文字片段以确保 Inspector 可用
    await page.getByTestId('add-text-clip-button').click();
    await page.getByTestId('clip-text-input').fill('Color Grading Test');
    await page.getByTestId('clip-text-input').blur();
  });

  /** 辅助：展开调色 details 区域并返回 workspace locator */
  async function openColorGradingWorkspace(page: import('@playwright/test').Page) {
    // Inspector 中的调色区域是一个 <details>，其 <summary> 包含"调色"文字
    const details = page.locator('details', { has: page.locator('summary', { hasText: '调色' }) });
    // 若未展开则点击 summary 以展开
    const summary = details.locator('summary');
    const workspace = details.locator('[data-testid="color-grading-workspace"]');
    if (!(await workspace.isVisible())) {
      await summary.click();
      await expect(workspace).toBeVisible({ timeout: 5000 });
    }
    return { details, workspace };
  }

  test('should open color grading workspace', async ({ page }) => {
    const { workspace } = await openColorGradingWorkspace(page);
    await expect(workspace).toBeVisible();
    // 节点图视图也应可见
    await expect(page.locator('[data-testid="node-graph-view"]')).toBeVisible();
  });

  test('should add primary wheel node', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const addWheelBtn = page.locator('[data-testid="add-wheel-node"]');
    await expect(addWheelBtn).toBeVisible();
    await addWheelBtn.click();

    await expect(page.locator('[data-testid="node-primary-wheel"]')).toBeVisible();
    await expect(page.locator('[data-testid="color-wheel-panel"]')).toBeVisible();
  });

  test('should add primary slider node', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const addSliderBtn = page.locator('[data-testid="add-slider-node"]');
    await expect(addSliderBtn).toBeVisible();
    await addSliderBtn.click();

    await expect(page.locator('[data-testid="node-primary-slider"]')).toBeVisible();
    await expect(page.locator('[data-testid="primary-sliders-panel"]')).toBeVisible();
  });

  test('should adjust color wheel parameters', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const addWheelBtn = page.locator('[data-testid="add-wheel-node"]');
    await addWheelBtn.click();
    await expect(page.locator('[data-testid="node-primary-wheel"]')).toBeVisible();

    // 点击 Lift (暗部) 色轮的特定位置以调整参数
    const liftWheel = page.locator('[data-testid="color-wheel-lift (暗部)"]');
    await expect(liftWheel).toBeVisible();
    await liftWheel.click({ position: { x: 60, y: 30 } });

    // 色轮面板应仍然可见（参数已更新）
    await expect(page.locator('[data-testid="color-wheel-panel"]')).toBeVisible();
  });

  test('should adjust primary slider parameters', async ({ page }) => {
    await openColorGradingWorkspace(page);

    const addSliderBtn = page.locator('[data-testid="add-slider-node"]');
    await addSliderBtn.click();
    await expect(page.locator('[data-testid="node-primary-slider"]')).toBeVisible();

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

    // 点击节点上的删除按钮（×）
    const removeBtn = page.locator('[data-testid="node-primary-wheel"] button');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(page.locator('[data-testid="node-primary-wheel"]')).not.toBeVisible();
    // 删除后应显示提示文字
    await expect(page.locator('[data-testid="node-graph-view"]')).toContainText('点击上方按钮添加调色节点');
  });
});
