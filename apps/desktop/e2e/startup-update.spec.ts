import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('shows update toast from a mocked startup update API', async ({ page }) => {
  // 逃生口：更新检查在 e2e 环境默认被抑制（消除 app-launch console error flaky），
  // 本 spec 依赖真实触发路径，需在页面脚本运行前显式启用。
  await page.addInitScript(() => {
    window.__OPEN_FACTORY_E2E_STARTUP_UPDATE_CHECK__ = true;
  });
  await page.route('**/open-factory/releases/latest/download/latest.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: '99.0.0',
        notes: 'Endpoint update notes',
        pub_date: '2026-06-18T00:00:00Z',
        platforms: {}
      })
    });
  });
  await page.route('https://api.github.com/repos/open-factory/open-factory/releases/latest', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        tag_name: 'v99.0.0',
        body: '更新日志：自动更新提示已可用。',
        html_url: 'https://github.com/open-factory/open-factory/releases/tag/v99.0.0',
        published_at: '2026-06-18T00:00:00Z'
      })
    });
  });

  await page.goto('/');
  await waitForE2eActions(page);

  // 99.0.0 需始终高于应用当前版本（4.73.0+），否则版本比较判定"无可用更新"不弹 toast
  await expect(page.getByText('v99.0.0 可用，点击更新')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('toast-action-button').click();
  await expect(page.getByTestId('update-dialog')).toBeVisible();
  await expect(page.getByTestId('update-release-notes')).toContainText('自动更新提示已可用');
});
