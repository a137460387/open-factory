import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('character timeline: shows 2 character entries with correct labels', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupCharacterTimelineFixture!());

  await expect(page.getByTestId('timeline-clip-clip-char-1')).toBeVisible({ timeout: 10_000 });

  const panel = page.getByTestId('character-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  const entry1 = page.getByTestId('character-entry-character_1');
  await expect(entry1).toBeVisible();
  await expect(entry1).toContainText('戴眼镜的男性');

  const entry2 = page.getByTestId('character-entry-character_2');
  await expect(entry2).toBeVisible();
  await expect(entry2).toContainText('红色上衣的女性');

  // Verify project data has the correct structure
  const charData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      characterTimeline?: { characters: Record<string, { label: string; appearances: Array<{ clipId: string }> }> };
    };
    return project.characterTimeline;
  });
  expect(charData).toBeTruthy();
  expect(Object.keys(charData!.characters)).toHaveLength(2);
  expect(charData!.characters.character_1.label).toBe('戴眼镜的男性');
  expect(charData!.characters.character_2.label).toBe('红色上衣的女性');
});

test('character timeline: merged character shows 1 entry with appearances from both clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupCharacterTimelineMergeFixture!());

  await expect(page.getByTestId('timeline-clip-clip-char-merge-1')).toBeVisible({ timeout: 10_000 });

  const panel = page.getByTestId('character-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  // Only 1 character entry because Jaccard similarity > 0.6 merged them
  const entry1 = page.getByTestId('character-entry-character_1');
  await expect(entry1).toBeVisible();
  await expect(entry1).toContainText('戴眼镜, 蓝色上衣, 男性');

  // Verify merged character has appearances from both clips
  const charData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      characterTimeline?: { characters: Record<string, { label: string; appearances: Array<{ clipId: string }> }> };
    };
    return project.characterTimeline;
  });
  expect(charData).toBeTruthy();
  expect(Object.keys(charData!.characters)).toHaveLength(1);

  const appearances = charData!.characters.character_1.appearances;
  expect(appearances).toHaveLength(2);
  const clipIds = appearances.map((a) => a.clipId).sort();
  expect(clipIds).toEqual(['clip-char-merge-1', 'clip-char-merge-2']);
});
