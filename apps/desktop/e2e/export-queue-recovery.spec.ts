import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

const queueStatePath = 'C:/Users/E2E/AppData/Roaming/open-factory/export-queue-state.json';

function persistedTask(id: string, status: 'pending' | 'running') {
  return {
    id,
    name: `${id}.mp4`,
    projectName: 'Recovered Project',
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

test('shows export queue recovery dialog after mock restart', async ({ page }) => {
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
        tasks: [persistedTask('pending-task', 'pending'), persistedTask('running-task', 'running')]
      })
    }
  );

  await page.reload();
  await waitForE2eActions(page);

  await expect(page.getByTestId('export-queue-recovery-dialog')).toBeVisible();
  await expect(page.getByTestId('export-queue-recovery-task')).toHaveCount(2);
  await expect(page.getByTestId('export-queue-recovery-task-status').nth(0)).toHaveAttribute('data-status', 'pending');
  await expect(page.getByTestId('export-queue-recovery-task-status').nth(1)).toHaveAttribute('data-status', 'interrupted');
});
