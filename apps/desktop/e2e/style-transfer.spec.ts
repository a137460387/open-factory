import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('extracts style and applies it to another clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupStyleTransferFixture!());

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-style-transfer-menu-item').click();
  await expect(page.getByTestId('style-transfer-dialog')).toBeVisible();

  await page.getByTestId('style-transfer-source-clip-select').selectOption('clip-style-source');
  await page.getByTestId('style-transfer-target-clip-select').selectOption('clip-style-target');
  await page.getByTestId('style-transfer-extract-button').click();
  await expect(page.getByTestId('style-transfer-summary')).toContainText('片段 1');

  await page.getByTestId('style-transfer-preview-button').click();
  await expect(page.getByTestId('style-transfer-preview-result')).toContainText('亮度');

  await page.getByTestId('style-transfer-apply-button').click();

  const target = await page.evaluate(() => {
    return window.__E2E_ACTIONS__!
      .getTimelineSnapshot!()
      .tracks.flatMap((track) => track.clips)
      .find((clip) => clip.id === 'clip-style-target') as {
      colorCorrection: { brightness: number; saturation: number; lutPath?: string | null };
      effects?: Array<{ type: string; params: Record<string, number> }>;
    };
  });
  expect(target.colorCorrection.brightness).toBe(0.6);
  expect(target.colorCorrection.saturation).toBe(1.6);
  expect(target.colorCorrection.lutPath).toBe('C:/Looks/warm.cube');
  expect(target.effects?.[0]).toMatchObject({ type: 'sharpen', params: { strength: 2 } });
});
