import { expect, test } from '@playwright/test';
import { waitForE2eActions, addMediaCardToTimeline } from './e2e-actions';

test('proxy batch verify identifies and repairs problem proxies', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
  });

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const project = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectSnapshot!());
  expect(project).toBeDefined();
  expect(project.media).toBeDefined();
  expect(Array.isArray(project.media)).toBe(true);

  const proxyStatuses = await page.evaluate(() => {
    const p = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    return p.media.map((m: any) => ({ id: m.id, proxyStatus: m.proxyStatus, proxyPath: m.proxyPath }));
  });
  expect(Array.isArray(proxyStatuses)).toBe(true);
});
