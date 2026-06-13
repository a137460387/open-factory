import { expect, test, type Locator, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('drags storyboard cards and syncs the reordered clip starts back to the timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupStoryboardFixture!());

  await page.getByTestId('storyboard-toggle-button').click();
  await expect(page.getByTestId('storyboard-view')).toBeVisible();
  await expect(page.getByTestId('storyboard-card-clip-story-a')).toBeVisible();

  await dragCardTo(page, page.getByTestId('storyboard-card-clip-story-c'), page.getByTestId('storyboard-card-clip-story-a'));

  await expect.poll(() => getStoryboardTimelineOrder(page)).toEqual(['clip-story-c', 'clip-story-a', 'clip-story-b']);

  await page.getByTestId('storyboard-toggle-button').click();
  await expect(page.getByTestId('timeline-clip-clip-story-c')).toBeVisible();
  await expect.poll(() => getStoryboardTimelineOrder(page)).toEqual(['clip-story-c', 'clip-story-a', 'clip-story-b']);
});

async function dragCardTo(page: Page, source: Locator, target: Locator): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function getStoryboardTimelineOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ clips: Array<{ id: string; start: number }> }> };
    return [...timeline.tracks[0].clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)).map((clip) => clip.id);
  });
}
