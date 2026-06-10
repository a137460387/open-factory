import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('restores an unsaved autosave after reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('open-factory:e2e-cleared')) {
      localStorage.removeItem('open-factory:e2e-files');
      localStorage.removeItem('open-factory:e2e-mtimes');
      sessionStorage.setItem('open-factory:e2e-cleared', 'true');
    }
  });
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.getByTestId('autosave-interval-input').fill('1');
  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').first().getByText('Add to timeline').click();

  const autosavePath = 'C:/Users/E2E/AppData/Roaming/open-factory/unsaved.cutproj.json.autosave';
  await expect
    .poll(() =>
      page.evaluate((path) => {
        const contents = window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined;
        if (!contents) {
          return 0;
        }
        const parsed = JSON.parse(contents) as { project?: { timeline?: { tracks?: Array<{ clips?: unknown[] }> } } };
        return parsed.project?.timeline?.tracks?.reduce((count, track) => count + (track.clips?.length ?? 0), 0) ?? 0;
      }, autosavePath)
    )
    .toBe(1);

  await page.reload();
  await expect(page.getByTestId('autosave-recovery-dialog')).toBeVisible();
  await expect(page.getByText('检测到未保存的恢复点，是否恢复？')).toBeVisible();
  await page.getByTestId('autosave-restore-button').click();

  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(1);
});
