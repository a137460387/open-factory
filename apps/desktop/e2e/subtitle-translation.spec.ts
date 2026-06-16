import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('translates subtitle clips through a mocked API into a new subtitle track', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-subtitles-button').click();
  await page.locator('[data-testid^="timeline-clip-"]').first().click();
  await expect(page.getByTestId('subtitle-translate-button')).toBeDisabled();
  await expect(page.getByTestId('subtitle-translation-not-configured')).toBeVisible();

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-translation').click();
  await expect(page.getByTestId('translation-third-party-warning')).toContainText('第三方服务');
  await page.getByTestId('translation-api-key-input').fill('deepl-test-key');
  await page.getByTestId('translation-target-language-input').fill('ZH');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('open-factory:translation-settings');
        return raw ? (JSON.parse(raw) as { apiKey?: string }).apiKey ?? null : null;
      })
    )
    .toBeNull();
  await page.getByTestId('settings-close-button').click();

  await expect(page.getByTestId('subtitle-translate-button')).toBeEnabled();
  await page.getByTestId('subtitle-translate-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
          tracks: Array<{ type: string; language?: string; clips: Array<{ text: string }> }>;
        };
        const subtitleTracks = timeline.tracks.filter((track) => track.type === 'subtitle');
        return {
          trackCount: subtitleTracks.length,
          translatedLanguage: subtitleTracks.at(-1)?.language,
          translatedClipCount: subtitleTracks.at(-1)?.clips.length ?? 0,
          translatedTexts: subtitleTracks.at(-1)?.clips.map((clip: { text: string }) => clip.text) ?? []
        };
      })
    )
    .toEqual({
      trackCount: 2,
      translatedLanguage: 'zh',
      translatedClipCount: 2,
      translatedTexts: ['Hello subtitle 翻译', 'Second subtitle 翻译']
    });
});
