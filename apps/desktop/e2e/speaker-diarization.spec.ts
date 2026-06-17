import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('splits alternating mock speakers into two independent audio tracks', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setupEfficientEditingFixture!();
  });

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-speaker-diarization-menu-item').click();

  await expect(page.getByTestId('speaker-diarization-dialog')).toBeVisible();
  await expect(page.getByTestId('speaker-diarization-track')).toHaveCount(2);
  await page.getByTestId('speaker-diarization-apply').click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__E2E_ACTIONS__!
            .getTimelineSnapshot!()
            .tracks.filter((track) => track.type === 'audio' && String(track.name).startsWith('说话人')).length
      )
    )
    .toBe(2);
});
