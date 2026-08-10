import { expect, test } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test.describe('App Launch', () => {
  test('loads successfully with correct title', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // index.html 的 <title> 为 "open-factory"（连字符小写），旧断言 "Open Factory"（带空格）已过时
    await expect(page).toHaveTitle(/open-factory/i);
  });

  test('shows main interface elements', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await waitForAppStore(page);

    await expect(page.getByTestId('timeline-root')).toBeVisible();
    await expect(page.getByTestId('timeline-ruler')).toBeVisible();
    // Inspector 无独立根 testid；启动时未选中 clip，渲染空态占位。
    await expect(page.getByTestId('inspector-empty-state')).toBeVisible();
    await expect(page.getByTestId('import-media-button')).toBeVisible();
  });

  test('loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForE2eActions(page);
    await waitForAppStore(page);

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('devtools') && !e.includes('HMR'),
    );
    expect(criticalErrors).toEqual([]);
  });

  test('toolbar shows project name', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    await expect(page.getByTestId('toolbar-project-name')).toBeVisible();
  });
});
