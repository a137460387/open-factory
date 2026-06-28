import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI smart reframe applies target aspect ratio to a video clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAiReframeFixture!());

  const clip = page.getByTestId('timeline-clip-clip-reframe-a');
  await expect(clip).toBeVisible();
  await clip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-ai-reframe').click();

  await expect(page.getByTestId('reframe-dialog')).toBeVisible();
  await page.getByTestId('reframe-aspect-16:9').click();
  await expect(page.getByTestId('reframe-dialog')).toHaveCount(0);

  const snapshot = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: {
        tracks: Array<{
          clips: Array<{ id: string; aiReframe?: { targetAspect: string; keyframes: unknown[]; confidence: number } }>;
        }>;
      };
    };
    const c = project.timeline.tracks[0].clips.find((item) => item.id === 'clip-reframe-a');
    return c?.aiReframe ?? null;
  });

  expect(snapshot).not.toBeNull();
  expect(snapshot!.targetAspect).toBe('16:9');
  expect(snapshot!.keyframes.length).toBeGreaterThan(0);
  expect(snapshot!.confidence).toBeGreaterThan(0);
});
