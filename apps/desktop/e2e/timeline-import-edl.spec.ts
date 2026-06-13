import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('imports a CMX3600 EDL into a new active timeline sequence', async ({ page }) => {
  const edlPath = 'C:/Projects/import-roundtrip.edl';
  const edl = [
    'TITLE: E2E Roundtrip',
    'FCM: NON-DROP FRAME',
    '',
    '001  AX       V     C        00:00:00:00 00:00:02:00 00:00:00:00 00:00:02:00',
    '* FROM CLIP NAME: tiny-video.mp4',
    '002  AX       V     C        00:00:00:00 00:00:01:15 00:00:02:00 00:00:03:15',
    '* FROM CLIP NAME: Offline Clip.mov'
  ].join('\n');

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(
    ({ path, contents }) => {
      window.__E2E_ACTIONS__!.setMockFile!(path, contents);
    },
    { path: edlPath, contents: edl }
  );

  await page.getByTestId('import-media-button').click();
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), edlPath);
  await page.getByTestId('toolbar-export-timeline-button').click();
  await expect(page.getByTestId('timeline-export-dialog')).toBeVisible();
  await page.getByTestId('timeline-import-edl-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
          activeSequenceId: string;
          sequences: Array<{ id: string; name: string }>;
          timeline: { tracks: Array<{ type: string; clips: Array<{ duration: number; mediaId: string }> }> };
          media: Array<{ id: string; name: string; missing?: boolean }>;
        };
        const clips = project.timeline.tracks.find((track) => track.type === 'video')?.clips ?? [];
        const missing = project.media.find((asset) => asset.name === 'Offline Clip.mov');
        return {
          activeName: project.sequences.find((sequence) => sequence.id === project.activeSequenceId)?.name,
          clipCount: clips.length,
          durations: clips.map((clip) => clip.duration),
          missing: missing?.missing === true
        };
      })
    )
    .toEqual({ activeName: 'EDL import-roundtrip', clipCount: 2, durations: [2, 1.5], missing: true });
});
