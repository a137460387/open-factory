import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('backs up a saved project to the configured local backup directory', async ({ page }) => {
  const backupDir = 'C:/Backups';
  const projectPath = 'C:/Projects/local-backup.cutproj.json';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);
  await page.evaluate(
    ({ backupDir, projectPath }) => {
      window.__E2E_ACTIONS__!.setOpenDirectoryPath!(backupDir);
      window.__E2E_ACTIONS__!.setSavePath!(projectPath);
    },
    { backupDir, projectPath }
  );

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-backup').click();
  await page.getByTestId('backup-local-enabled').check();
  await page.getByTestId('backup-local-choose-directory').click();
  await expect(page.getByTestId('backup-local-directory-input')).toHaveValue(backupDir);
  await page.getByTestId('settings-close-button').click();

  await page.getByTestId('toolbar-save-project-button').click();

  await expect
    .poll(() => page.evaluate((backupDir) => window.__E2E_ACTIONS__!.getBackupFiles!(backupDir) as string[], backupDir))
    .toHaveLength(1);
  const [backupPath] = await page.evaluate((backupDir) => window.__E2E_ACTIONS__!.getBackupFiles!(backupDir) as string[], backupDir);
  expect(backupPath).toMatch(/^C:\/Backups\/.+-\d{8}-\d{6}-\d{3}\.cutproj\.json$/);

  const backupContents = await page.evaluate((backupPath) => window.__E2E_ACTIONS__!.getWrittenFile!(backupPath) as string, backupPath);
  expect(JSON.parse(backupContents)).toMatchObject({ schemaVersion: 2 });
  await expect(page.getByTestId('toolbar-backup-status')).toBeVisible();
});
