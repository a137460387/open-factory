import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('conforms proxy media paths from the file menu', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.evaluate(() => {
    const actions = window.__E2E_ACTIONS__!;
    const project = actions.getProjectSnapshot!() as any;
    actions.setProjectSnapshot!({
      ...project,
      media: [
        {
          id: 'proxy-scene-01',
          type: 'video',
          name: 'scene01_proxy.mp4',
          path: 'C:/Proxy/scene01_proxy.mp4',
          duration: 6,
          width: 1920,
          height: 1080,
          frameRate: 30,
          hasAudio: true
        }
      ]
    });
    actions.setMockFile!('C:/Originals/scene01.mov', 'mock original media');
    actions.setOpenDirectoryPath!('C:/Originals');
  });

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-conform-media-menu-item').click();

  await expect
    .poll(() => page.evaluate(() => (window.__E2E_ACTIONS__!.getProjectMedia!() as any[])[0]?.path), { timeout: 10_000 })
    .toBe('C:/Originals/scene01.mov');
});
