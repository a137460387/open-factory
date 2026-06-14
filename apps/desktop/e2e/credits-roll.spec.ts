import { expect, test } from '@playwright/test';
import { openExportDialog, waitForE2eActions } from './e2e-actions';

test('drops a txt file to create a credits roll clip and exports drawtext args', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('timeline-scroll-container').evaluate((element) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['导演 | 林青\n演员 | Ada'], 'credits.txt', { type: 'text/plain' }));
    const rect = element.getBoundingClientRect();
    const eventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX: rect.left + 220,
      clientY: rect.top + 80
    };
    element.dispatchEvent(new DragEvent('dragover', eventInit));
    element.dispatchEvent(new DragEvent('drop', eventInit));
  });

  const creditsClip = page.locator('[data-clip-type="credits"]').first();
  await expect(creditsClip).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!()
          .tracks.flatMap((track) => track.clips)
          .find((item) => item.type === 'credits') as { rows?: Array<{ role: string; name: string }> } | undefined;
        return clip?.rows;
      })
    )
    .toEqual([
      { role: '导演', name: '林青' },
      { role: '演员', name: 'Ada' }
    ]);

  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/credits-roll.mp4'));
  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())).toBeTruthy();
  const plan = (await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())) as {
    filterComplex: string;
    textArtifacts: Array<{ placeholder: string; text: string }>;
  };

  expect(plan.filterComplex).toContain('drawtext=textfile=__CREDITSFILE_');
  expect(plan.filterComplex).toContain("y='h-t*");
  expect(plan.textArtifacts.some((artifact) => artifact.placeholder.startsWith('__CREDITSFILE_') && artifact.text.includes('导演'))).toBe(true);
});
