import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('generates subtitle clips from a local Whisper run', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupWhisperFixture!());

  await page.getByTestId('whisper-executable-path-input').fill('C:/Tools/whisper.exe');
  await page.getByTestId('whisper-model-path-input').fill('C:/Models/base.bin');

  await page.getByTestId('timeline-clip-clip-whisper-video').click({ button: 'right' });
  await expect(page.getByTestId('clip-action-generate-subtitles')).toBeEnabled();
  await page.getByTestId('clip-action-generate-subtitles').click();

  const subtitleClips = page.locator('[data-clip-type="subtitle"]');
  await expect(subtitleClips).toHaveCount(2);
  await expect(subtitleClips.first()).toContainText('First generated caption');
  await expect(subtitleClips.nth(1)).toContainText('Second generated caption');
});
