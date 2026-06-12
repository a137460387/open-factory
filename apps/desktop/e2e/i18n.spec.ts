import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

const settingsPath = 'C:/Users/E2E/AppData/Roaming/open-factory/settings.json';

test('switches interface language and persists the setting', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-settings-button').click();
  const languageSelect = page.getByTestId('settings-language-select');
  const initialLanguage = await languageSelect.inputValue();
  const firstLanguage = initialLanguage === 'en' ? 'zh' : 'en';
  const secondLanguage = firstLanguage === 'en' ? 'zh' : 'en';

  await languageSelect.selectOption(firstLanguage);
  await expect(page.getByTestId('toolbar-file-menu-button')).toContainText(firstLanguage === 'zh' ? '文件' : 'File');
  await expect(page.getByTestId('settings-dialog')).toContainText(firstLanguage === 'zh' ? '通用' : 'General');

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath)).toContain(`"language": "${firstLanguage}"`);

  await languageSelect.selectOption(secondLanguage);
  await expect(page.getByTestId('toolbar-file-menu-button')).toContainText(secondLanguage === 'zh' ? '文件' : 'File');
  await expect(page.getByTestId('settings-dialog')).toContainText(secondLanguage === 'zh' ? '通用' : 'General');

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath)).toContain(`"language": "${secondLanguage}"`);
});
