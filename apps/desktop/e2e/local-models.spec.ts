import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('selects a Whisper model from local model settings and unlocks subtitle generation', async ({ page }) => {
  const settingsPath = 'C:/Users/E2E/AppData/Roaming/open-factory/settings.json';
  const whisperModelPath = 'C:/Models/base.bin';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setupWhisperFixture!();
  });

  await page.getByTestId('whisper-executable-path-input').fill('C:/Tools/whisper.exe');
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), whisperModelPath);

  await page.getByTestId('toolbar-settings-button').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('settings-tab-local-models').click();
  await expect(page.getByTestId('local-models-panel')).toBeVisible();
  await page.getByTestId('local-model-choose-whisper').click();

  await expect(page.getByTestId('local-model-status-whisper')).toHaveText('已安装');
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath)).toContain(whisperModelPath);

  await page.getByTestId('settings-close-button').click();
  await page.getByTestId('timeline-clip-clip-whisper-video').click({ button: 'right' });
  await expect(page.getByTestId('clip-action-generate-subtitles')).toBeEnabled();
});
