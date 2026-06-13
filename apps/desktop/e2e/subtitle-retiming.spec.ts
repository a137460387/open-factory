import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('shifts every subtitle in the selected subtitle track by one second', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEfficientEditingFixture!());

  await page.getByTestId('import-subtitles-button').click();
  const subtitleClips = page.locator('[data-clip-type="subtitle"]');
  await expect(subtitleClips).toHaveCount(2);

  const before = await page.evaluate(() =>
    window.__E2E_ACTIONS__!
      .getTimelineSnapshot!()
      .tracks.flatMap((track) => track.clips)
      .filter((clip) => clip.type === 'subtitle')
      .map((clip) => ({ id: clip.id, start: clip.start }))
  );

  await subtitleClips.first().click();
  await page.getByTestId('subtitle-shift-input').fill('1');
  await page.getByTestId('subtitle-shift-input').press('Enter');
  await page.getByTestId('subtitle-shift-apply-button').click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__E2E_ACTIONS__!
          .getTimelineSnapshot!()
          .tracks.flatMap((track) => track.clips)
          .filter((clip) => clip.type === 'subtitle')
          .map((clip) => ({ id: clip.id, start: clip.start }))
      )
    )
    .toEqual(before.map((clip) => ({ ...clip, start: clip.start + 1 })));
});
