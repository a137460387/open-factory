import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI narration script generates 3 segments with time ranges and text', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAINarrationScriptFixture!());

  // Open narration panel from tools menu
  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-narration-menu-item').click();
  await expect(page.getByTestId('ai-narration-panel')).toBeVisible();

  // Start generation
  await page.getByTestId('ai-narration-generate').click();

  // Wait for result
  await expect(page.getByTestId('ai-narration-result')).toBeVisible({ timeout: 10_000 });

  // Verify 3 segments with text
  await expect(page.getByTestId('ai-narration-text-0')).toBeVisible();
  await expect(page.getByTestId('ai-narration-text-0')).toContainText('开场旁白文稿内容。');

  await expect(page.getByTestId('ai-narration-text-1')).toBeVisible();
  await expect(page.getByTestId('ai-narration-text-1')).toContainText('第二段旁白内容。');

  await expect(page.getByTestId('ai-narration-text-2')).toBeVisible();
  await expect(page.getByTestId('ai-narration-text-2')).toContainText('结尾旁白总结。');

  // Verify time ranges are displayed (check for time range labels)
  await expect(page.getByTestId('ai-narration-result')).toContainText('0:00');
  await expect(page.getByTestId('ai-narration-result')).toContainText('0:03');
  await expect(page.getByTestId('ai-narration-result')).toContainText('0:06');

  // Verify speaker notes
  await expect(page.getByTestId('ai-narration-note-0')).toBeVisible();
  await expect(page.getByTestId('ai-narration-note-1')).toBeVisible();
  await expect(page.getByTestId('ai-narration-note-2')).toBeVisible();

  // Verify send-to-TTS button is available
  await expect(page.getByTestId('ai-narration-send-tts')).toBeVisible();
  await page.getByTestId('ai-narration-send-tts').click();

  // Verify regenerate button works
  await expect(page.getByTestId('ai-narration-regenerate')).toBeVisible();
});
