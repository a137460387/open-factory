import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('configure MiMo AI service and test connection', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIServiceConfigFixture!());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-ai-services').click();

  await expect(page.getByTestId('ai-provider-list')).toBeVisible();
  await page.getByTestId('ai-provider-mimo').locator('button').first().click();
  await expect(page.getByTestId('ai-provider-detail-mimo')).toBeVisible();

  await page.getByTestId('ai-provider-key-mimo').fill('test-mimo-key');
  await page.getByTestId('ai-provider-test-mimo').click();
  await expect(page.getByText('连接可用')).toBeVisible({ timeout: 5_000 });

  await page.getByTestId('settings-close-button').click();
});
