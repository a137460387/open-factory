import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('creates a media folder, moves media into it, saves, and reopens with the structure intact', async ({ page }) => {
  const projectPath = 'C:/Projects/media-folders.cutproj.json';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);

  await page.getByTestId('media-folder-create-button').click();
  const folderId = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectSnapshot!().mediaFolders[0].id);
  await page.getByTestId(`media-folder-name-${folderId}`).dblclick();
  await page.getByTestId(`media-folder-name-input-${folderId}`).fill('B-roll');
  await page.getByTestId(`media-folder-name-input-${folderId}`).press('Enter');
  await expect(page.getByTestId(`media-folder-name-${folderId}`)).toHaveText('B-roll');

  const assetId = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectMedia!()[0].id);
  await page.evaluate(
    ({ assetId, folderId }) => {
      const source = document.querySelector(`[data-testid="media-card-${assetId}"]`);
      const target = document.querySelector(`[data-testid="media-folder-${folderId}"]`);
      if (!source || !target) {
        throw new Error('Missing media drag source or folder drop target');
      }
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    },
    { assetId, folderId }
  );
  await expect(page.getByTestId(`media-card-${assetId}`)).toHaveAttribute('data-folder-id', folderId);

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), projectPath);
  await page.getByTestId('toolbar-save-project-button').click();
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, projectPath)).toBeTruthy();

  const saved = await page.evaluate((path) => JSON.parse(window.__E2E_ACTIONS__!.getWrittenFile!(path) as string) as { project: { mediaFolders: Array<{ id: string; name: string }>; media: Array<{ id: string; folderId?: string | null }> } }, projectPath);
  expect(saved.project.mediaFolders).toEqual([expect.objectContaining({ id: folderId, name: 'B-roll' })]);
  expect(saved.project.media.find((asset) => asset.id === assetId)?.folderId).toBe(folderId);

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), projectPath);
  await page.getByTestId('toolbar-open-project-button').click();
  await expect(page.getByTestId(`media-folder-name-${folderId}`)).toHaveText('B-roll');
  await expect(page.getByTestId(`media-card-${assetId}`)).toHaveAttribute('data-folder-id', folderId);
});
