import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('jumps to an exact frame from preview timecode search', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupFrameSearchFixture!());
  await expect(page.getByTestId('frame-search-input')).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true })));
  await expect(page.getByTestId('frame-search-input')).toBeFocused();
  await page.getByTestId('frame-search-input').fill('00:00:01:12');
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('preview-timecode')).toContainText('00:00:01:12');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!() as number)).toBe(1.5);
});

test('jumps to a direct frame number and reuses persisted history', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupFrameSearchFixture!());

  await page.getByTestId('frame-search-input').fill('f36');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('preview-timecode')).toContainText('00:00:01:12');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!() as number)).toBe(1.5);

  await page.reload();
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupFrameSearchFixture!());
  await page.getByTestId('frame-search-input').click();
  await expect(page.getByTestId('frame-search-history')).toContainText('第 36 帧');
  await page.getByTestId('frame-search-history-frame-0').click();

  await expect(page.getByTestId('preview-timecode')).toContainText('00:00:01:12');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!() as number)).toBe(1.5);
});

test('jumps to a fuzzy matched marker from preview search candidates', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupFrameSearchFixture!());

  await page.getByTestId('frame-search-input').fill('Beat');
  await page.getByTestId('frame-search-candidate-marker-marker-action-beat').click();

  await expect(page.getByTestId('preview-timecode')).toContainText('00:00:02:12');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!() as number)).toBe(2.5);
});

test('jumps to a clip by name and selects it', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupFrameSearchFixture!());

  await page.getByTestId('frame-search-input').fill('Interview');
  await page.getByTestId('frame-search-candidate-clip-clip-interview').click();

  await expect(page.getByTestId('preview-timecode')).toContainText('00:00:03:00');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!() as number)).toBe(3);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getSelectedClipIds!() as string[])).toEqual(['clip-interview']);
});
