import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('publishes a project release record and increments the project version', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
  });

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length)).toBe(1);

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-release-version-menu-item').click();
  await expect(page.getByTestId('release-workflow-dialog')).toBeVisible();
  await expect(page.getByTestId('release-target-version')).toContainText('0.1.1');

  await page.getByTestId('release-export-path-input').fill('C:/Exports/release-workflow.mp4');
  await page.getByTestId('release-assignee-input').fill('Ada');
  await page.getByTestId('release-changelog-input').fill('## Release\n- E2E publish');
  await page.getByTestId('release-publish-button').click();

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getProjectSnapshot!().releaseVersion)).toBe('0.1.1');
  const releaseFiles = await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getReleaseFiles!() as string[])).toHaveLength(1);
  void releaseFiles;

  const record = await page.evaluate(() => {
    const [path] = window.__E2E_ACTIONS__!.getReleaseFiles!() as string[];
    return JSON.parse(window.__E2E_ACTIONS__!.getWrittenFile!(path) as string) as {
      version: string;
      exportPath: string;
      assignee: string;
      changelog: string;
      snapshotPath: string;
      checklist: Array<{ id: string; status: string }>;
    };
  });
  expect(record.version).toBe('0.1.1');
  expect(record.exportPath).toBe('C:/Exports/release-workflow.mp4');
  expect(record.assignee).toBe('Ada');
  expect(record.changelog).toContain('E2E publish');
  expect(record.snapshotPath).toContain('/snapshots/');
  expect(record.checklist.every((item) => item.status === 'pass')).toBe(true);
});
