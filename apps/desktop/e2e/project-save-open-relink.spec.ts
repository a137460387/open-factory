import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('saves schemaVersion 2 project, opens missing media, and relinks it', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Projects/saved.cutproj.json'));
  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').nth(0).getByText('Add to timeline').click();

  await page.getByLabel('Save project').click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Projects/saved.cutproj.json') as string | undefined)).not.toBeUndefined();
  const saved = await page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Projects/saved.cutproj.json') as string);
  const parsed = JSON.parse(saved) as { schemaVersion: number; project: { media: unknown[] } };
  expect(parsed.schemaVersion).toBe(2);
  expect(parsed.project.media).toHaveLength(3);

  await page.evaluate(() => window.__E2E_ACTIONS__!.setMissingProjectNext!());
  await page.getByLabel('Open project').click();
  await expect(page.getByText('Missing')).toBeVisible();

  await page.getByTestId('relink-all-button').click();
  await expect(page.getByText('Missing')).toHaveCount(0);
});
