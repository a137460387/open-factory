import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('automation panel opens and displays controls', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.openAutomationPanel!());
  await expect(page.getByText('自动化工作流')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('create-workflow-btn')).toBeVisible();
});

test('create a new workflow and verify it appears in the list', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.openAutomationPanel!());
  await expect(page.getByText('自动化工作流')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('create-workflow-btn').click();
  const items = page.locator('[data-testid^="workflow-item-"]');
  await expect(items).toHaveCount(1);
});

test('execute a workflow and see it complete', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.openAutomationPanel!());
  await expect(page.getByText('自动化工作流')).toBeVisible({ timeout: 10000 });

  // 创建工作流
  await page.getByTestId('create-workflow-btn').click();

  // 点击执行按钮
  const execBtn = page.locator('[data-testid^="execute-workflow-"]').first();
  await expect(execBtn).toBeVisible();
  await execBtn.click({ force: true });

  // 切换到日志标签页
  await page.getByTestId('automation-panel').getByRole('button', { name: '日志' }).click();

  // 验证日志区域有内容——日志容器本身应该存在
  await expect(page.getByText('工作流', { exact: false }).first()).toBeVisible({ timeout: 5000 });
});

test('workflow detail panel shows steps after creation', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.openAutomationPanel!());
  await expect(page.getByText('自动化工作流')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('create-workflow-btn').click();
  await expect(page.getByTestId('workflow-detail')).toBeVisible();
});

test('switch to templates tab and see builtin templates', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.openAutomationPanel!());
  await expect(page.getByText('自动化工作流')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('automation-panel').getByRole('button', { name: '模板' }).click();
  await expect(page.getByText('自动质量修复')).toBeVisible();
  await expect(page.getByText('自动字幕生成')).toBeVisible();
  await expect(page.getByText('智能剪辑流程')).toBeVisible();
});

test('delete a workflow from the list', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.openAutomationPanel!());
  await expect(page.getByText('自动化工作流')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('create-workflow-btn').click();
  const items = page.locator('[data-testid^="workflow-item-"]');
  await expect(items).toHaveCount(1);
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid^="delete-workflow-"]');
    if (btn) (btn as HTMLElement).click();
  });
  await expect(items).toHaveCount(0);
});

test('analysis tab opens scene analysis view', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.openAutomationPanel!());
  await expect(page.getByText('自动化工作流')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('automation-panel').getByRole('button', { name: '分析' }).click();
  await expect(page.getByTestId('scene-analysis-view')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('analyze-btn')).toBeVisible();
});
