import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI anomaly detection marks black frames and static shots on a clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAnomalyDetectionFixture!());

  const clip = page.getByTestId('timeline-clip-clip-anomaly-a');
  await expect(clip).toBeVisible();
  await clip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-anomaly-detect').click();

  const markersContainer = page.getByTestId('anomaly-markers-clip-anomaly-a');
  await expect(markersContainer).toBeVisible({ timeout: 10_000 });

  const marker0 = page.getByTestId('anomaly-marker-clip-anomaly-a-0');
  const marker1 = page.getByTestId('anomaly-marker-clip-anomaly-a-1');
  await expect(marker0).toBeVisible();
  await expect(marker1).toBeVisible();

  const anomaliesBefore = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: {
        tracks: Array<{
          clips: Array<{ id: string; anomalies?: Array<{ type: string; startTime: number; endTime: number; severity: string }> }>;
        }>;
      };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-anomaly-a');
    return c?.anomalies ?? [];
  });
  expect(anomaliesBefore).toHaveLength(2);
  expect(anomaliesBefore[0].type).toBe('black');
  expect(anomaliesBefore[1].type).toBe('static');

  await marker1.click();
  // Wait briefly then check data state first
  await page.waitForTimeout(300);
  const anomaliesAfterClick = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; anomalies?: Array<{ type: string }> }> }> };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-anomaly-a');
    return (c?.anomalies ?? []).map((a) => a.type);
  });
  // If data is correct but DOM doesn't update, we know the issue
  expect(anomaliesAfterClick).toEqual(['black']);
  await expect(page.getByTestId('anomaly-marker-clip-anomaly-a-1')).toHaveCount(0);

  const anomaliesAfter = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: {
        tracks: Array<{
          clips: Array<{ id: string; anomalies?: Array<{ type: string }> }>;
        }>;
      };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-anomaly-a');
    return c?.anomalies ?? [];
  });
  expect(anomaliesAfter).toHaveLength(1);
  expect(anomaliesAfter[0].type).toBe('black');
});
