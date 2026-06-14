import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('applies a quad split-screen layout to four selected visual clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 0);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(4);
  await clips.nth(0).click();
  await page.keyboard.down('Shift');
  await clips.nth(1).click();
  await clips.nth(2).click();
  await clips.nth(3).click();
  await page.keyboard.up('Shift');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getSelectedClipIds!() as string[])).toHaveLength(4);

  await expect(page.getByTestId('toolbar-split-layout-button')).toBeEnabled();
  await page.getByTestId('toolbar-split-layout-button').click();
  await page.getByTestId('split-layout-option-quad').click();

  const transforms = await page.evaluate(() => {
    const selected = new Set(window.__E2E_ACTIONS__!.getSelectedClipIds!() as string[]);
    return window
      .__E2E_ACTIONS__!.getTimelineSnapshot!()
      .tracks.flatMap((track) => track.clips)
      .filter((clip) => selected.has(clip.id))
      .map((clip) => clip.transform);
  });

  expect(transforms).toHaveLength(4);
  for (const transform of transforms) {
    expect(transform.scaleX).toBeCloseTo(0.5, 3);
    expect(transform.scaleY).toBeCloseTo(0.5, 3);
  }
});
