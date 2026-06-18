import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('installs a mocked community effect preset and applies it to the selected clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate((contents) => window.__E2E_ACTIONS__!.setEffectPresetCommunityResponse!(contents), makeEffectPresetCommunityJson());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-effect-presets').click();

  await expect(page.getByTestId('effect-preset-community-panel')).toBeVisible();
  await expect(page.getByTestId('effect-preset-source')).toHaveAttribute('data-source', 'remote');
  const communityCard = page.locator('[data-testid="effect-preset-community-card"][data-preset-id="e2e-film-glow"]');
  await expect(communityCard).toBeVisible();
  await expect(communityCard).toContainText('E2E Film Glow');

  await communityCard.getByTestId('effect-preset-install-button').click();

  const presetPath = 'C:/Users/E2E/AppData/Roaming/open-factory/effect-presets/preset-e2e-film-glow.ofeffect.json';
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, presetPath)).toContain('E2E Film Glow');

  await page.getByTestId('settings-close-button').click();
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('media-filter-effects').click();
  const localCard = page.locator('[data-testid="effect-preset-card"][data-preset-id="preset-e2e-film-glow"]');
  await expect(localCard).toBeVisible();
  await localCard.getByTestId('effect-preset-apply-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
          timeline: { tracks: Array<{ clips: Array<{ id: string; effects?: Array<{ type: string }>; blendMode?: string }> }> };
        };
        const clip = project.timeline.tracks.flatMap((track) => track.clips)[0];
        return { effect: clip.effects?.[0]?.type, blendMode: clip.blendMode };
      })
    )
    .toEqual({ effect: 'film-grain', blendMode: 'screen' });
});

function makeEffectPresetCommunityJson(): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      presets: [
        {
          id: 'e2e-film-glow',
          name: 'E2E Film Glow',
          author: 'Open Factory E2E',
          description: 'Cached community effect preset for install/apply tests.',
          tags: ['cinematic', 'portrait'],
          thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="%232e7d67"/></svg>',
          preset: {
            id: 'preset-e2e-film-glow',
            name: 'E2E Film Glow',
            author: 'Open Factory E2E',
            description: 'Installed from the cached community library.',
            tags: ['cinematic', 'portrait'],
            thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="%232e7d67"/></svg>',
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
            stack: {
              colorCorrection: {
                brightness: 0.08,
                contrast: 1.15,
                saturation: 0.8,
                hue: 4,
                lutPath: null
              },
              effects: [
                {
                  id: 'effect-e2e-grain',
                  type: 'film-grain',
                  enabled: true,
                  params: { strength: 0.35, size: 2 }
                }
              ],
              blendMode: 'screen',
              keyframes: {
                opacity: [{ id: 'kf-e2e-opacity', time: 0.5, value: 0.85, easing: 'ease-in-out' }]
              }
            }
          }
        }
      ]
    },
    null,
    2
  );
}
