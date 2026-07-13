import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('imports a FCPXML file into a new active timeline sequence', async ({ page }) => {
  const xmlPath = 'C:/Projects/import-fcpxml.xml';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>E2E FCPXML Import</name>
    <rate>
      <timebase>30</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <duration>180</duration>
    <media>
      <video>
        <track>
          <clipitem id="clipitem-1">
            <name>tiny-video</name>
            <rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>
            <start>0</start>
            <end>60</end>
            <in>0</in>
            <out>60</out>
            <file id="file-1">
              <name>tiny-video.mp4</name>
              <pathurl>file://localhost/C:/Videos/tiny-video.mp4</pathurl>
            </file>
          </clipitem>
          <clipitem id="clipitem-2">
            <name>Offline Clip</name>
            <rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>
            <start>60</start>
            <end>135</end>
            <in>0</in>
            <out>75</out>
            <file id="file-2">
              <name>Offline Clip.mov</name>
              <pathurl>file://localhost/C:/Videos/Offline%20Clip.mov</pathurl>
            </file>
          </clipitem>
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(
    ({ path, contents }) => {
      window.__E2E_ACTIONS__!.setMockFile!(path, contents);
    },
    { path: xmlPath, contents: xml }
  );

  await page.getByTestId('import-media-button').click();
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), xmlPath);
  await page.getByTestId('toolbar-export-timeline-button').click();
  await expect(page.getByTestId('timeline-export-dialog')).toBeVisible();
  await page.getByTestId('timeline-import-fcpxml-button').click();

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
          missing: missing?.missing === true
        };
      })
    )
    .toEqual({ activeName: 'FCPXML import-fcpxml', clipCount: 2, missing: false });
});
