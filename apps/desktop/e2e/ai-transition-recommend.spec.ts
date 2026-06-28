import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI transition recommend adds a transition between adjacent clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAiTransitionRecommendFixture!());

  const clip = page.getByTestId('timeline-clip-clip-trans-a');
  await expect(clip).toBeVisible();
  await clip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-ai-transition').click();

  await expect(page.getByTestId('transition-dialog')).toBeVisible();
  await expect(page.getByTestId('transition-candidate-0')).toBeVisible();
  await expect(page.getByTestId('transition-candidate-1')).toBeVisible();
  await expect(page.getByTestId('transition-candidate-2')).toBeVisible();

  await page.getByTestId('transition-candidate-0').click();
  await expect(page.getByTestId('transition-dialog')).toHaveCount(0);

  const transitions = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      transitions: Array<{ type: string; fromClipId: string; toClipId: string }>;
    };
    return timeline.transitions;
  });

  expect(transitions.length).toBeGreaterThanOrEqual(1);
  expect(transitions[0].fromClipId).toBe('clip-trans-a');
  expect(transitions[0].toClipId).toBe('clip-trans-b');
});
