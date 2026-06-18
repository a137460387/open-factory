import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('shows update toast from a mocked startup update API', async ({ page }) => {
  await page.route('**/open-factory/releases/latest/download/latest.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: '0.6.1',
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
        tag_name: 'v0.6.1',
        body: '更新日志：自动更新提示已可用。',
        html_url: 'https://github.com/open-factory/open-factory/releases/tag/v0.6.1',
        published_at: '2026-06-18T00:00:00Z'
      })
    });
  });

  await page.goto('/');
  await waitForE2eActions(page);

  await expect(page.getByText('v0.6.1 可用，点击更新')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('toast-action-button').click();
  await expect(page.getByTestId('update-dialog')).toBeVisible();
  await expect(page.getByTestId('update-release-notes')).toContainText('自动更新提示已可用');
});
