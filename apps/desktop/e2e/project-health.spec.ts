import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('checks project health and fixes missing and orphan media', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupProjectHealthFixture!());

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-project-health-menu-item').click();

  await expect(page.getByTestId('project-health-panel')).toBeVisible();
  await expect(page.getByTestId('project-health-section-missing-media')).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('project-health-section-orphan-media')).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('project-health-missing-item')).toContainText('Health Missing Video');
  await expect(page.getByTestId('project-health-orphan-item')).toContainText('tiny-audio.wav');

  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']));
  await page.getByTestId('project-health-fix-missing-button').click();
  await expect(page.getByTestId('project-health-section-missing-media')).toHaveCount(0);

  await page.getByTestId('project-health-fix-orphan-button').click();
  await expect(page.getByTestId('project-health-empty')).toBeVisible();

  await page.getByTestId('project-health-rescan-button').click();
  await expect(page.getByTestId('project-health-empty')).toBeVisible();
});

test('auto repairs missing media and shows a repair report', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupProjectHealthFixture!());

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-project-health-menu-item').click();

  await expect(page.getByTestId('project-health-section-missing-media')).toHaveAttribute('data-count', '1');
  await page.getByTestId('project-health-auto-repair-button').click();

  await expect(page.getByTestId('project-health-repair-report')).toBeVisible();
  await expect(page.getByTestId('project-health-repair-summary')).toContainText('成功');
  await expect(page.getByTestId('project-health-section-missing-media')).toHaveCount(0);
});
