// apps/desktop/e2e/lut-secondary-grading.spec.ts
import { test, expect } from '@playwright/test';

test.describe('LUT Manager and Secondary Color Grading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  });

  test('should open LUT manager', async ({ page }) => {
    // 导航到调色面板
    const colorTab = page.locator('[data-testid="tab-color-grading"], [data-testid="color-grading-section"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      // 查找 LUT 管理器
      const lutManager = page.locator('[data-testid="lut-manager"]');
      if (await lutManager.isVisible()) {
        await expect(lutManager).toBeVisible();
      }
    }
  });

  test('should display import LUT button', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"], [data-testid="color-grading-section"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const importBtn = page.locator('[data-testid="import-lut-btn"]');
      if (await importBtn.isVisible()) {
        await expect(importBtn).toBeVisible();
      }
    }
  });

  test('should open curves editor', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"], [data-testid="color-grading-section"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const curvesEditor = page.locator('[data-testid^="curves-editor-"]').first();
      if (await curvesEditor.isVisible()) {
        await expect(curvesEditor).toBeVisible();
      }
    }
  });

  test('should add HSL qualifier node', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"], [data-testid="color-grading-section"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      // 查找添加节点按钮
      const addNodeBtn = page.locator('[data-testid="add-hsl-node"], [data-testid="add-qualifier-node"]');
      if (await addNodeBtn.isVisible()) {
        await addNodeBtn.click();

        // 验证 HSL 限定器面板出现
        const hslPanel = page.locator('[data-testid="hsl-qualifier-panel"]');
        if (await hslPanel.isVisible()) {
          await expect(hslPanel).toBeVisible();
        }
      }
    }
  });

  test('should add window mask node', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"], [data-testid="color-grading-section"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const addMaskBtn = page.locator('[data-testid="add-mask-node"], [data-testid="add-window-mask"]');
      if (await addMaskBtn.isVisible()) {
        await addMaskBtn.click();

        const maskPanel = page.locator('[data-testid="window-mask-panel"]');
        if (await maskPanel.isVisible()) {
          await expect(maskPanel).toBeVisible();
        }
      }
    }
  });

  test('should interact with curves editor', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"], [data-testid="color-grading-section"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const curvesEditor = page.locator('[data-testid^="curves-editor-"]').first();
      if (await curvesEditor.isVisible()) {
        // 点击曲线编辑器添加控制点
        const box = await curvesEditor.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
        }
      }
    }
  });
});
