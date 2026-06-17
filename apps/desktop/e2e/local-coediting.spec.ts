import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('syncs a host timeline operation into a local co-editing client', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const clipId = (await page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips)[0]?.id)) as string;
  expect(clipId).toBeTruthy();

  await page.evaluate(() =>
    window.__E2E_ACTIONS__!.enableMockCollaboration!({
      mode: 'client',
      permission: 'edit',
      userId: 'client-e2e',
      name: 'Client',
      color: '#38bdf8'
    })
  );

  await page.evaluate((targetClipId) => {
    const project = JSON.parse(JSON.stringify(window.__E2E_ACTIONS__!.getProjectSnapshot!()));
    const tracks = project.timeline.tracks.map((track: { clips: Array<{ id: string; start: number }> }) => ({
      ...track,
      clips: track.clips.map((clip) => (clip.id === targetClipId ? { ...clip, start: 1.25 } : clip))
    }));
    project.timeline = { ...project.timeline, tracks };
    project.sequences = Array.isArray(project.sequences)
      ? project.sequences.map((sequence: { id: string; timeline: unknown }) =>
          sequence.id === project.activeSequenceId ? { ...sequence, timeline: project.timeline } : sequence
        )
      : project.sequences;
    project.updatedAt = '2026-06-18T00:00:00.000Z';

    window.__E2E_ACTIONS__!.emitMockCollaborationMessage!({
      type: 'presence',
      user: { userId: 'host-e2e', name: 'Host', playheadTime: 2.5, color: '#f59e0b' }
    });
    window.__E2E_ACTIONS__!.emitMockCollaborationMessage!({
      type: 'operation',
      operation: {
        id: 'host-operation-1',
        userId: 'host-e2e',
        commandName: 'UpdateClipCommand',
        params: { clipId: targetClipId, project },
        timestamp: Date.now(),
        kind: 'timeline-command',
        clipId: targetClipId
      }
    });
  }, clipId);

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips)[0]?.start)).toBe(1.25);
  await expect(page.getByTestId('timeline-remote-playhead-host-e2e')).toBeVisible();
  await expect(page.getByTestId(`timeline-clip-remote-lock-${clipId}`)).toContainText('Host');
});
