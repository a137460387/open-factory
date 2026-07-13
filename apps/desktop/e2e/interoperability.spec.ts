import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

// ─── Test data ────────────────────────────────────────────────

const EDL_CONTENT = [
  'TITLE: E2E Interop',
  'FCM: NON-DROP FRAME',
  '',
  '001  AX       V     C        00:00:00:00 00:00:02:00 00:00:00:00 00:00:02:00',
  '* FROM CLIP NAME: Hero Shot.mov',
  '002  AX       V     C        00:00:00:00 00:00:01:15 00:00:02:00 00:00:03:15',
  '* FROM CLIP NAME: Offline Clip.mov'
].join('\n');

const FCPXML_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>E2E FCPXML Interop</name>
    <rate>
      <timebase>30</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <duration>180</duration>
    <media>
      <video>
        <track>
          <clipitem id="clipitem-1">
            <name>Hero Shot</name>
            <rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>
            <start>0</start>
            <end>60</end>
            <in>0</in>
            <out>60</out>
            <file id="file-1">
              <name>Hero Shot.mp4</name>
              <pathurl>file://localhost/C:/Videos/Hero%20Shot.mp4</pathurl>
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

// ─── Helper ───────────────────────────────────────────────────

async function openTimelineExportDialog(page: import('@playwright/test').Page) {
  await page.getByTestId('toolbar-export-timeline-button').click();
  await expect(page.getByTestId('timeline-export-dialog')).toBeVisible();
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('professional interoperability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
  });

  test('imports a FCPXML file into a new active timeline sequence', async ({ page }) => {
    const xmlPath = 'C:/Projects/interop-fcpxml.xml';

    await page.evaluate(
      ({ path, contents }) => {
        window.__E2E_ACTIONS__!.setMockFile!(path, contents);
      },
      { path: xmlPath, contents: FCPXML_CONTENT }
    );

    // Open import dialog and select FCPXML file
    await page.getByTestId('import-media-button').click();
    await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), xmlPath);
    await openTimelineExportDialog(page);
    await page.getByTestId('timeline-import-fcpxml-button').click();

    // Assert timeline loaded correctly
    await expect
      .poll(() =>
        page.evaluate(() => {
          const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
            activeSequenceId: string;
            sequences: Array<{ id: string; name: string }>;
            timeline: { tracks: Array<{ type: string; clips: Array<{ duration: number }> }> };
            media: Array<{ id: string; name: string; missing?: boolean }>;
          };
          const clips = project.timeline.tracks.find((t) => t.type === 'video')?.clips ?? [];
          return {
            activeName: project.sequences.find((s) => s.id === project.activeSequenceId)?.name,
            clipCount: clips.length,
          };
        })
      )
      .toEqual({ activeName: 'FCPXML interop-fcpxml', clipCount: 2 });
  });

  test('imports a CMX3600 EDL file into a new active timeline sequence', async ({ page }) => {
    const edlPath = 'C:/Projects/interop-edl.edl';

    await page.evaluate(
      ({ path, contents }) => {
        window.__E2E_ACTIONS__!.setMockFile!(path, contents);
      },
      { path: edlPath, contents: EDL_CONTENT }
    );

    // Open import dialog and select EDL file
    await page.getByTestId('import-media-button').click();
    await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), edlPath);
    await openTimelineExportDialog(page);
    await page.getByTestId('timeline-import-edl-button').click();

    // Assert timeline loaded correctly
    await expect
      .poll(() =>
        page.evaluate(() => {
          const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
            activeSequenceId: string;
            sequences: Array<{ id: string; name: string }>;
            timeline: { tracks: Array<{ type: string; clips: Array<{ duration: number }> }> };
            media: Array<{ id: string; name: string; missing?: boolean }>;
          };
          const clips = project.timeline.tracks.find((t) => t.type === 'video')?.clips ?? [];
          const missing = project.media.find((a) => a.name === 'Offline Clip.mov');
          return {
            activeName: project.sequences.find((s) => s.id === project.activeSequenceId)?.name,
            clipCount: clips.length,
            durations: clips.map((c) => c.duration),
            hasMissing: missing?.missing === true,
          };
        })
      )
      .toEqual({ activeName: 'EDL interop-edl', clipCount: 2, durations: [2, 1.5], hasMissing: true });
  });

  test('exports timeline as FCPXML with valid XML structure', async ({ page }) => {
    const outputPath = 'C:/Exports/interop-export.xml';

    await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);

    // Open timeline export dialog, select FCP-XML format, and export
    await openTimelineExportDialog(page);
    await page.getByTestId('timeline-export-format-select').selectOption('fcp-xml');
    await page.getByTestId('timeline-export-save-button').click();

    // Verify the exported file content has valid FCPXML structure
    await expect
      .poll(() =>
        page.evaluate((path) => {
          const content = window.__E2E_ACTIONS__!.getWrittenFile!(path);
          if (!content) return null;
          return {
            hasXmlDecl: content.includes('<?xml version="1.0"'),
            hasXmeml: content.includes('<xmeml version="4">'),
            hasSequence: content.includes('<sequence'),
            hasMedia: content.includes('<media>'),
            hasRate: content.includes('<timebase>'),
          };
        }, outputPath)
      )
      .toEqual({
        hasXmlDecl: true,
        hasXmeml: true,
        hasSequence: true,
        hasMedia: true,
        hasRate: true,
      });
  });

  test('exports timeline as CMX3600 EDL with valid format', async ({ page }) => {
    const outputPath = 'C:/Exports/interop-export.edl';

    await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);

    // Open timeline export dialog, select EDL format, and export
    await openTimelineExportDialog(page);
    await page.getByTestId('timeline-export-format-select').selectOption('edl');
    await page.getByTestId('timeline-export-save-button').click();

    // Verify the exported file content has valid EDL structure
    await expect
      .poll(() =>
        page.evaluate((path) => {
          const content = window.__E2E_ACTIONS__!.getWrittenFile!(path);
          if (!content) return null;
          return {
            hasTitle: content.includes('TITLE:'),
            hasFcm: content.includes('FCM: NON-DROP FRAME'),
            isNonEmpty: content.trim().length > 0,
          };
        }, outputPath)
      )
      .toEqual({
        hasTitle: true,
        hasFcm: true,
        isNonEmpty: true,
      });
  });
});
