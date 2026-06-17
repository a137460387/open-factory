import { expect, test, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('detects duplicate media in the organizer and removes confirmed duplicate references', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMediaOrganizerFixture!());

  await expect.poll(() => mediaOrganizerSnapshot(page)).toEqual({
    count: 3,
    names: ['duplicate-a.mp4', 'duplicate-b.mp4', 'duplicate-master.mp4']
  });
  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-media-organizer-menu-item').click();

  await expect(page.getByTestId('media-organizer-dialog')).toBeVisible();
  await expect(page.getByTestId('media-organizer-duplicate-group')).toHaveCount(1);
  await expect(page.getByTestId('media-organizer-dialog')).toContainText('duplicate-master.mp4');
  await page.getByTestId('media-organizer-confirm-group').check();
  await page.getByTestId('media-organizer-remove-selected-button').click();

  await expect.poll(() => mediaOrganizerSnapshot(page)).toEqual({
    count: 1,
    names: ['duplicate-master.mp4']
  });
});

async function mediaOrganizerSnapshot(page: Page) {
  return page.evaluate(() => {
    const media = window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ name: string }>;
    return {
      count: media.length,
      names: media.map((asset) => asset.name)
    };
  });
}
