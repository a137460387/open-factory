import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('switches to color grading workspace layout and persists a custom layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await expect(page.getByTestId('editor-main-layout')).toHaveAttribute('data-left-collapsed', 'false');

  await page.getByTestId('toolbar-workspace-layout-button').click();
  await page.getByTestId('workspace-layout-option-color-grading').click();

  await expect(page.getByTestId('editor-main-layout')).toHaveAttribute('data-workspace-layout', 'color-grading');
  await expect(page.getByTestId('editor-main-layout')).toHaveAttribute('data-left-collapsed', 'true');
  await expect(page.getByTestId('left-panel')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('import-media-button')).toBeHidden();
  await expect(page.getByTestId('color-scopes-panel')).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.__E2E_ACTIONS__!.getWrittenFile!('C:/Users/E2E/AppData/Roaming/open-factory/settings.json') as string | undefined;
        const layout = raw ? JSON.parse(raw).layout : undefined;
        return {
          activeWorkspaceLayoutId: layout?.activeWorkspaceLayoutId,
          mediaLibrary: layout?.panels?.mediaLibrary,
          colorScopes: layout?.panels?.colorScopes
        };
      })
    )
    .toEqual({ activeWorkspaceLayoutId: 'color-grading', mediaLibrary: false, colorScopes: true });

  page.once('dialog', async (dialog) => {
    await dialog.accept('审片布局');
  });
  await page.getByTestId('toolbar-workspace-layout-button').click();
  await page.getByTestId('workspace-layout-save-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.__E2E_ACTIONS__!.getWrittenFile!('C:/Users/E2E/AppData/Roaming/open-factory/settings.json') as string | undefined;
        const layout = raw ? JSON.parse(raw).layout : undefined;
        return layout?.customWorkspaceLayouts?.some((item: { name?: string; shortcutSlot?: number }) => item.name === '审片布局' && item.shortcutSlot === 4) ?? false;
      })
    )
    .toBe(true);
});
