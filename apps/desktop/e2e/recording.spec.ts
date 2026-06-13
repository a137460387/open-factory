import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('records a mocked screen capture and imports the stopped recording', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-recording-width-input').fill('640');
  await page.getByTestId('settings-recording-height-input').fill('360');
  await page.getByTestId('settings-recording-framerate-input').fill('24');
  await page.getByTestId('settings-close-button').click();

  await page.getByTestId('toolbar-record-menu-button').click();
  await page.getByTestId('toolbar-record-screen-menu-item').click();
  await expect(page.getByTestId('toolbar-record-menu-button')).toContainText('停止');

  await page.getByTestId('toolbar-record-menu-button').click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ path: string; type: string }>).some(
          (asset) => asset.type === 'video' && asset.path.includes('/recordings/screen-')
        )
      )
    )
    .toBe(true);
});
