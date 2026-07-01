import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

const savePath = 'C:/Projects/v411-roundtrip.cutproj.json';

test('saves and reloads project with v4.11 fields preserved', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), savePath);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.evaluate(() => {
    const store = window.__E2E_ACTIONS__!;
    const snapshot = store.getProjectSnapshot!();
    const project = { ...snapshot };
    project.characterTimeline = {
      characters: {
        character_1: {
          label: '戴眼镜的男性',
          appearances: [{ clipId: 'clip-1', startTime: 0, endTime: 5, confidence: 0.9 }],
        },
      },
      lastAnalyzedAt: '2026-07-01T00:00:00.000Z',
    };
    project.preflightReport = {
      generatedAt: '2026-07-01T00:00:00.000Z',
      issuesByCategory: { flash: [{ id: 'flash-1', category: 'flash', severity: 'warning', message: '闪烁警告' }] },
      aiSummary: '项目有1个警告',
      totalCritical: 0,
      totalWarnings: 1,
      acknowledgedIssueIds: [],
    };
    project.ttsSegments = [
      {
        id: 'tts-1',
        subtitleClipId: 'subtitle-1',
        originalDuration: 3.0,
        dubbedDuration: 3.5,
        audioPath: 'C:/Media/tts-1.wav',
        language: 'zh',
        timingAdaptation: {
          durationDelta: 0.5,
          adaptationType: 'compress',
          atempoRatio: 0.86,
          suggestedOutPoint: null,
        },
      },
    ];
    store.setProjectSnapshot!(project);
  });

  await page.getByTestId('toolbar-save-project-button').click();

  const savedRaw = await expect
    .poll(
      () => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, savePath),
      { timeout: 15_000 },
    )
    .toBeTruthy();
  const saved = await page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string, savePath);
  const parsed = JSON.parse(saved) as Record<string, unknown>;
  const project = parsed.project as Record<string, unknown>;
  expect(project.characterTimeline).toBeDefined();
  expect(project.preflightReport).toBeDefined();
  expect(Array.isArray(project.ttsSegments)).toBe(true);

  await page.evaluate(
    ([path, contents]) => window.__E2E_ACTIONS__!.setMockFile!(path, contents),
    [savePath, saved] as const,
  );
  await page.evaluate(
    ([path]) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]),
    [savePath] as const,
  );

  await page.getByTestId('toolbar-open-project-button').click();
  await expect(page.locator('[data-testid^="timeline-clip-"]').first()).toBeVisible({ timeout: 15_000 });

  const reloaded = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectSnapshot!());
  expect(reloaded.characterTimeline?.characters.character_1.label).toBe('戴眼镜的男性');
  expect(reloaded.preflightReport?.totalWarnings).toBe(1);
  expect(reloaded.ttsSegments).toHaveLength(1);
  expect(reloaded.ttsSegments![0].timingAdaptation?.adaptationType).toBe('compress');
});

