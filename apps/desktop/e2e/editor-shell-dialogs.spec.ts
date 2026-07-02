import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

const queueStatePath = 'C:/Users/E2E/AppData/Roaming/open-factory/export-queue-state.json';

function makePersistedTask(id: string, status: 'pending' | 'running') {
  return {
    id,
    name: `${id}.mp4`,
    projectName: 'Dialog Test Project',
    outputPath: `C:/Exports/${id}.mp4`,
    plan: {
      inputs: [{ path: 'C:/Media/tiny-video.mp4', args: ['-i', 'C:/Media/tiny-video.mp4'] }],
      outputPath: `C:/Exports/${id}.mp4`,
      outputArgs: [`C:/Exports/${id}.mp4`],
      fullArgs: ['-i', 'C:/Media/tiny-video.mp4', `C:/Exports/${id}.mp4`],
      duration: 6,
      filterComplex: ''
    },
    priority: 'normal',
    status,
    progress: status === 'running' ? 0.42 : 0,
    createdAt: '2026-06-15T00:00:00.000Z',
    startedAt: status === 'running' ? '2026-06-15T00:01:00.000Z' : undefined
  };
}

test('autosave recovery dialog triggers and renders correctly', async ({ page }) => {
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
  await addMediaCardToTimeline(page);

  const autosavePath = 'C:/Users/E2E/AppData/Roaming/open-factory/unsaved.cutproj.json.autosave';
  await expect
    .poll(() =>
      page.evaluate((path) => {
        const contents = window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined;
        if (!contents) return 0;
        const parsed = JSON.parse(contents) as { project?: { timeline?: { tracks?: Array<{ clips?: unknown[] }> } } };
        return parsed.project?.timeline?.tracks?.reduce((count, track) => count + (track.clips?.length ?? 0), 0) ?? 0;
      }, autosavePath)
    )
    .toBe(1);

  await page.reload();
  await expect(page.getByTestId('autosave-recovery-dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('检测到未保存的恢复点，是否恢复？')).toBeVisible();
  await expect(page.getByTestId('autosave-restore-button')).toBeVisible();
  await expect(page.getByTestId('autosave-discard-button')).toBeVisible();
});

test('export queue recovery dialog triggers and renders task list', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate(
    ({ path, contents }) => window.__E2E_ACTIONS__!.setMockFile!(path, contents),
    {
      path: queueStatePath,
      contents: JSON.stringify({
        version: 1,
        savedAt: '2026-06-15T00:02:00.000Z',
        tasks: [makePersistedTask('pending-task', 'pending'), makePersistedTask('running-task', 'running')]
      })
    }
  );

  await page.reload();
  await waitForE2eActions(page);
  await expect(page.getByTestId('export-queue-recovery-dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/发现 \d+ 个未完成的导出任务/)).toBeVisible();
  await expect(page.getByTestId('export-queue-recovery-task')).toHaveCount(2);
  await expect(page.getByTestId('export-queue-recovery-task-status').nth(0)).toHaveAttribute('data-status', 'pending');
  await expect(page.getByTestId('export-queue-recovery-task-status').nth(1)).toHaveAttribute('data-status', 'interrupted');
  await expect(page.getByTestId('export-queue-restore-all')).toBeVisible();
  await expect(page.getByTestId('export-queue-discard-all')).toBeVisible();
});

test('project password dialog triggers when opening encrypted project', async ({ page }) => {
  const encryptedPath = 'C:/Projects/dialog-test.cutproj.enc';
  await page.goto('/');
  await waitForE2eActions(page);

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), encryptedPath);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((t) => t.clips).length)).toBe(1);

  await page.getByTestId('toolbar-save-encrypted-project-button').click();
  await expect(page.getByTestId('project-encryption-dialog')).toBeVisible();
  await page.getByTestId('project-encryption-password-input').fill('dialog-test-pw');
  await page.getByTestId('project-encryption-confirm-button').click();
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, encryptedPath)).toContain('OFCUTENC1');

  await page.getByTestId('toolbar-new-project-button').click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((t) => t.clips).length)).toBe(0);

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), encryptedPath);
  await page.getByTestId('toolbar-open-project-button').click();
  await expect(page.getByTestId('project-password-dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('project-password-input')).toBeVisible();
  await expect(page.getByText('忘记密码无法恢复。')).toBeVisible();
  await expect(page.getByTestId('project-password-cancel-button')).toBeVisible();
  await expect(page.getByTestId('project-password-confirm-button')).toBeVisible();
});

test('archive progress dialog renders when triggered', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('toolbar-open-project-button').click();

  await page.evaluate(() => {
    const store = (window as any).__APP_STORE__;
    store.setArchiveProgress({ copied: 2, total: 5 });
  });

  await expect(page.getByTestId('archive-progress-dialog')).toBeVisible();
  await expect(page.getByText('归档项目')).toBeVisible();
  await expect(page.getByTestId('archive-progress-message')).toContainText('2/5');

  await page.evaluate(() => {
    const store = (window as any).__APP_STORE__;
    store.setArchiveProgress(undefined);
  });
  await expect(page.getByTestId('archive-progress-dialog')).not.toBeVisible();
});
