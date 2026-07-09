import { expect, test } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test('adds a subtitle style to the shared library and reads it in a new project', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await waitForAppStore(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setupSubtitleProofreadingFixture!();
  });

  await expect(page.getByTestId('subtitle-style-template-section')).toBeVisible();
  await page.getByTestId('subtitle-style-template-share-news-lower-third').click();

  await page.getByTestId('media-filter-shared').click();
  await expect(page.getByTestId('shared-library-resource-card').filter({ hasText: '新闻下三分之一' })).toBeVisible();

  await page.getByTestId('toolbar-new-project-button').click();
  await page.getByTestId('media-filter-shared').click();

  await expect(page.getByTestId('shared-library-resource-card').filter({ hasText: '新闻下三分之一' })).toBeVisible();
});
