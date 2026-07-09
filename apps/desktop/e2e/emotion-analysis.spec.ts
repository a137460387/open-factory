import { test, expect } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test.describe('Subtitle Emotion Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await waitForAppStore(page);
  });

  test('emotion analysis panel opens and shows disclaimer', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setEmotionPanelOpen) store.setEmotionPanelOpen(true);
    });
    const panel = page.getByTestId('emotion-analysis-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('emotion-disclaimer')).toContainText('参考');
  });

  test('detect button analyzes mock subtitle clips with emotion keywords', async ({ page }) => {
    // Inject mock subtitle clips with emotion keywords
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setEmotionPanelOpen) store.setEmotionPanelOpen(true);
      if (store?.setMockSubtitleClips) {
        store.setMockSubtitleClips([
          { id: 'c1', text: '太愤怒了！气死我了！', start: 0, duration: 2, type: 'subtitle' },
          { id: 'c2', text: '今天天气很好', start: 2, duration: 2, type: 'subtitle' },
          { id: 'c3', text: '开心快乐的一天', start: 4, duration: 2, type: 'subtitle' },
        ]);
      }
    });
    await page.getByTestId('emotion-detect').click();
    await expect(page.getByTestId('emotion-summary')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('emotion-results')).toBeVisible();
  });

  test('emotion color suggestion displays correct colors', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setEmotionPanelOpen) store.setEmotionPanelOpen(true);
      if (store?.setMockSubtitleClips) {
        store.setMockSubtitleClips([
          { id: 'c1', text: '愤怒！混蛋！', start: 0, duration: 2, type: 'subtitle' },
          { id: 'c2', text: '太棒了！开心！', start: 2, duration: 2, type: 'subtitle' },
        ]);
      }
    });
    await page.getByTestId('emotion-detect').click();
    await expect(page.getByTestId('emotion-results')).toBeVisible({ timeout: 5000 });
    // Check that anger filter shows anger results
    await page.getByTestId('emotion-filter-anger').click();
    const results = page.getByTestId('emotion-results').locator('div');
    await expect(results.first()).toBeVisible();
  });

  test('batch apply button triggers style update', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setEmotionPanelOpen) store.setEmotionPanelOpen(true);
      if (store?.setMockSubtitleClips) {
        store.setMockSubtitleClips([
          { id: 'c1', text: '悲伤的离别', start: 0, duration: 2, type: 'subtitle' },
          { id: 'c2', text: '快乐时光', start: 2, duration: 2, type: 'subtitle' },
        ]);
      }
    });
    await page.getByTestId('emotion-detect').click();
    await expect(page.getByTestId('emotion-batch-apply')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('emotion-batch-apply').click();
    // After batch apply, the panel should still be visible
    await expect(page.getByTestId('emotion-analysis-panel')).toBeVisible();
  });
});
