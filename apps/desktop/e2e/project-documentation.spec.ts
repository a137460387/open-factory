import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('persists project documentation after save and reopen', async ({ page }) => {
  const projectPath = 'C:/Projects/documentation.cutproj.json';
  const description = '# 项目说明\n\n**客户版** 剪辑备注\n\n- 保留片头';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyD');
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('project-documentation-panel')).toBeVisible();

  await page.getByTestId('project-documentation-input-description').fill(description);
  await expect(page.getByTestId('project-documentation-preview-description')).toContainText('客户版');
  await page.getByTestId('toolbar-project-documentation-button').click();

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), projectPath);
  await page.getByTestId('toolbar-save-project-button').click();
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, projectPath)).not.toBeUndefined();
  const saved = await page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string, projectPath);
  expect(JSON.parse(saved)).toMatchObject({
    schemaVersion: 2,
    project: {
      documentation: {
        description
      }
    }
  });

  await page.getByTestId('toolbar-new-project-button').click();
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), projectPath);
  await page.getByTestId('toolbar-open-project-button').click();

  await page.getByTestId('toolbar-project-documentation-button').click();
  await expect(page.getByTestId('project-documentation-input-description')).toHaveValue(description);
});
