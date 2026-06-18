import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('batch renames three selected media assets from the media bin context menu', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4', 'C:/Media/tiny-audio.wav', 'C:/Media/test-image.png']);
  });

  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);

  const importedMedia = await page.evaluate(
    () => window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ id: string; name: string }>
  );
  for (const asset of importedMedia) {
    await page.getByTestId(`media-select-${asset.id}`).click();
  }

  await page.getByTestId(`media-card-${importedMedia[0].id}`).click({ button: 'right' });
  await page.getByTestId('batch-rename-media-menu-item').click();
  await expect(page.getByTestId('batch-rename-dialog')).toBeVisible();

  await page.getByTestId('batch-rename-template-input').fill('{index:03d}_{date}_{originalName}');
  await page.getByTestId('batch-rename-date-input').fill('20260618');
  await expect(page.getByTestId('batch-rename-preview-row')).toHaveCount(3);
  await page.getByTestId('batch-rename-confirm-button').click();

  const expectedNames = importedMedia.map((asset, index) => `${String(index + 1).padStart(3, '0')}_20260618_${asset.name}`);
  for (const [index, asset] of importedMedia.entries()) {
    await expect(page.getByTestId(`media-name-${asset.id}`)).toHaveText(expectedNames[index]);
  }
  await expect
    .poll(() => page.evaluate(() => (window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ name: string }>).map((asset) => asset.name)))
    .toEqual(expectedNames);
});
