import { expect, test, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('smart rough cut panel runs scene, silence, and Whisper steps', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());

  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  await expect(page.getByTestId('smart-rough-cut-panel')).toBeVisible();

  await page.getByTestId('smart-scene-button').click();
  await expect(page.getByTestId('smart-scene-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('smart-scene-preview')).toContainText('检测到 1 个切点');
  await page.getByTestId('smart-scene-apply-button').click();
  await expect.poll(() => getVideoClipCount(page)).toBe(2);

  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());
  await page.getByTestId('smart-silence-button').click();
  await expect(page.getByTestId('smart-silence-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('smart-silence-preview')).toContainText('将删除 1 段静音');
  await page.getByTestId('smart-silence-apply-button').click();
  await expect.poll(() => getVideoClipCount(page)).toBe(2);

  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());
  await page.getByTestId('whisper-executable-path-input').fill('C:/Tools/whisper.exe');
  await page.getByTestId('whisper-model-path-input').fill('C:/Models/base.bin');
  await expect(page.getByTestId('smart-whisper-button')).toBeEnabled();
  await page.getByTestId('smart-whisper-button').click();
  await expect(page.getByTestId('smart-whisper-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.locator('[data-clip-type="subtitle"]')).toHaveCount(2);
  await expect(page.getByTestId('smart-rough-cut-report')).toContainText('生成 2 条字幕');
});

test('smart rough cut applies only selected scene result items', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!();
    window.__E2E_ACTIONS__!.setSceneDetectionTimes!([0.8, 1.7]);
  });

  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  await page.getByTestId('smart-scene-button').click();
  await expect(page.getByTestId('smart-scene-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.locator('[data-testid^="smart-scene-item-"]')).toHaveCount(3);

  await page.getByTestId('smart-scene-checkbox-scene-1').uncheck();
  await page.getByTestId('smart-scene-apply-button').click();

  const clips = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ id: string; clips: Array<{ start: number; duration: number }> }>;
    };
    return timeline.tracks.find((track) => track.id === 'track-video')?.clips ?? [];
  });
  expect(clips).toHaveLength(2);
  expect(clips[0]).toMatchObject({ start: 0, duration: 0.8 });
  expect(clips[1]).toMatchObject({ start: 0.8 });
});

test('smart rough cut dialogue mode creates one clip per detected voice interval', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());

  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  await page.getByTestId('smart-rough-cut-tab-dialogue').click();
  await page.getByTestId('smart-dialogue-button').click();

  await expect(page.getByTestId('smart-dialogue-status')).toHaveAttribute('data-status', 'complete');
  await expect.poll(() => getVideoClipCount(page)).toBe(2);
  await expect(page.getByTestId('smart-rough-cut-report')).toContainText('2 个对话 clip');
});

test('smart rough cut scene threshold slider adjusts detection sensitivity', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());

  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  // 默认阈值 0.3 → mock 返回 1 个切点（fixture 默认 mockSceneTimes=[1]）
  await page.getByTestId('smart-scene-button').click();
  await expect(page.getByTestId('smart-scene-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('smart-scene-preview')).toContainText('检测到 1 个切点');

  // 重置后调低阈值到 0.2 → mock 追加切点 2 → 2 个切点
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());
  await page.getByTestId('smart-scene-threshold').fill('0.2');
  await expect(page.getByTestId('smart-scene-threshold')).toHaveValue('0.2');
  await page.getByTestId('smart-scene-button').click();
  await expect(page.getByTestId('smart-scene-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('smart-scene-preview')).toContainText('检测到 2 个切点');
});

test('smart rough cut hovering a scene result item moves the playhead to its start', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!();
    window.__E2E_ACTIONS__!.setSceneDetectionTimes!([0.8, 1.7]);
  });

  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  await page.getByTestId('smart-scene-button').click();
  await expect(page.getByTestId('smart-scene-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.locator('[data-testid^="smart-scene-item-"]')).toHaveCount(3);

  // hover scene-1（区间 [0.8, 1.7]，start=0.8）→ playhead 跳到 0.8
  await page.getByTestId('smart-scene-item-scene-1').hover();
  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!()))
    .toBe(0.8);
});

async function getVideoClipCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ id: string; clips: unknown[] }>;
    };
    return timeline.tracks.find((track) => track.id === 'track-video')?.clips.length ?? 0;
  });
}

/** 含叙事标记的中文转写（opening/rising/climax 全命中，时间对齐 0 / 0.8 / 1.6） */
const SEMANTIC_SRT = [
  '1',
  '00:00:00,000 --> 00:00:00,800',
  '大家好，欢迎观看本期节目。',
  '',
  '2',
  '00:00:00,800 --> 00:00:01,600',
  '今天我们介绍项目背景与目标。',
  '',
  '3',
  '00:00:01,600 --> 00:00:02,400',
  '这部分是最关键的核心要点。',
  '',
].join('\n');

async function setupSemanticFixture(page: Page): Promise<void> {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((srt) => {
    window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!();
    window.__E2E_ACTIONS__!.setWhisperSrtContents!(srt);
  }, SEMANTIC_SRT);
}

test('smart rough cut semantic suggestions are gated until whisper transcript exists', async ({ page }) => {
  await setupSemanticFixture(page);

  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  await expect(page.getByTestId('smart-rough-cut-panel')).toBeVisible();

  // 未转写：入口门控（提示可见、列表不渲染）
  await expect(page.getByTestId('smart-semantic')).toHaveAttribute('data-ready', 'false');
  await expect(page.getByTestId('smart-semantic-hint')).toContainText('请先运行 Whisper 字幕生成转写文本');
  await expect(page.locator('[data-testid^="smart-semantic-item-"]')).toHaveCount(0);

  // 生成转写 → 语义建议就绪
  await page.getByTestId('whisper-executable-path-input').fill('C:/Tools/whisper.exe');
  await page.getByTestId('whisper-model-path-input').fill('C:/Models/base.bin');
  await page.getByTestId('smart-whisper-button').click();
  await expect(page.getByTestId('smart-whisper-status')).toHaveAttribute('data-status', 'complete');

  // whisper 完成后 hook 选中首个 subtitle clip；选回视频 clip 使语义收集覆盖完整转写范围
  await page.evaluate(() => window.__E2E_ACTIONS__!.selectClip!('clip-smart-video'));

  await expect(page.getByTestId('smart-semantic')).toHaveAttribute('data-ready', 'true');
  // 3 项建议：climax 优先（DOM 首位）+ opening/rising 按时间殿后
  await expect(page.locator('[data-testid^="smart-semantic-item-"]')).toHaveCount(3);
  const climaxItems = page.locator('[data-testid^="smart-semantic-item-"][data-climax="true"]');
  await expect(climaxItems).toHaveCount(1);
  await expect(climaxItems).toContainText('高潮片段');
  await expect(climaxItems).toContainText('1.60s - 2.50s');
  await expect(climaxItems).toContainText('置信度 70%');
  await expect(page.getByTestId('smart-semantic-item-semantic-0')).toContainText('开场');
  await expect(page.getByTestId('smart-semantic-item-semantic-1')).toContainText('铺垫');
});

test('smart rough cut hovering a semantic suggestion moves the playhead to its start', async ({ page }) => {
  await setupSemanticFixture(page);

  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  await page.getByTestId('whisper-executable-path-input').fill('C:/Tools/whisper.exe');
  await page.getByTestId('whisper-model-path-input').fill('C:/Models/base.bin');
  await page.getByTestId('smart-whisper-button').click();
  await expect(page.getByTestId('smart-whisper-status')).toHaveAttribute('data-status', 'complete');
  await page.evaluate(() => window.__E2E_ACTIONS__!.selectClip!('clip-smart-video'));

  // hover climax 建议项（区间 [1.6, 2.5]，start=1.6）→ playhead 跳到 1.6
  await page.getByTestId('smart-semantic-item-semantic-2').hover();
  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!()))
    .toBe(1.6);
});

// ── M3-3 A1：语义建议对比审阅 + 单条显式应用 ──────────────────

/** 打开面板并使语义建议就绪（沿用既用例的转写注入链路） */
async function openPanelWithSemanticReady(page: Page): Promise<void> {
  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  await page.getByTestId('whisper-executable-path-input').fill('C:/Tools/whisper.exe');
  await page.getByTestId('whisper-model-path-input').fill('C:/Models/base.bin');
  await page.getByTestId('smart-whisper-button').click();
  await expect(page.getByTestId('smart-whisper-status')).toHaveAttribute('data-status', 'complete');
  await page.evaluate(() => window.__E2E_ACTIONS__!.selectClip!('clip-smart-video'));
  await expect(page.getByTestId('smart-semantic')).toHaveAttribute('data-ready', 'true');
}

async function getVideoClipDuration(page: Page): Promise<number> {
  return page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ id: string; clips: Array<{ duration: number }> }>;
    };
    return timeline.tracks.find((track) => track.id === 'track-video')?.clips[0]?.duration ?? -1;
  });
}

test('smart rough cut semantic review dialog shows before and after for a suggestion', async ({ page }) => {
  await setupSemanticFixture(page);
  await openPanelWithSemanticReady(page);

  // climax 建议（semantic-2，区间 [1.6, 2.5)）→ 打开对比审阅
  await page.getByTestId('smart-semantic-review-semantic-2').click();

  await expect(page.getByTestId('semantic-review-dialog')).toBeVisible();
  await expect(page.getByTestId('semantic-review-summary')).toContainText('高潮片段');
  await expect(page.getByTestId('semantic-review-before')).toBeVisible();
  await expect(page.getByTestId('semantic-review-after')).toBeVisible();
  await expect(page.getByTestId('semantic-review-after-bar')).toBeVisible();
  // 保留 0.9s / 原 2.5s = 36%
  await expect(page.getByTestId('semantic-review-ratio')).toContainText('保留 36%');

  await page.getByTestId('semantic-review-close').click();
  await expect(page.getByTestId('semantic-review-dialog')).toBeHidden();
});

test('smart rough cut applying a semantic suggestion trims the clip and undo restores it', async ({ page }) => {
  await setupSemanticFixture(page);
  await openPanelWithSemanticReady(page);

  await page.getByTestId('smart-semantic-review-semantic-2').click();
  // 采纳 climax 建议 [1.6, 2.5) → clip 裁剪为 0.9s（波纹前置）
  await page.getByTestId('semantic-review-apply').click();

  await expect(page.getByTestId('semantic-review-feedback')).toHaveAttribute('data-result', 'success');
  await expect(page.getByTestId('semantic-review-feedback')).toContainText('Ctrl+Z');
  await expect.poll(() => getVideoClipDuration(page)).toBeCloseTo(0.9);

  // 关闭审阅覆盖层后走既有 undo 链路恢复原时长（toolbar-undo-button，ai-chat-editor 同款）
  await page.getByTestId('semantic-review-close').click();
  await page.getByTestId('toolbar-undo-button').click();
  await expect.poll(() => getVideoClipDuration(page)).toBeCloseTo(2.5);
});

test('smart rough cut whole-clip semantic suggestion disables apply with an explanation', async ({ page }) => {
  // 单条字幕仅含一个 marker（time=0）→ 唯一建议区间 [0, 2.5) 覆盖整个 clip
  const singleMarkerSrt = ['1', '00:00:00,000 --> 00:00:00,800', '这部分是最关键的核心要点。', ''].join('\n');
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((srt) => {
    window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!();
    window.__E2E_ACTIONS__!.setWhisperSrtContents!(srt);
  }, singleMarkerSrt);
  await openPanelWithSemanticReady(page);

  await expect(page.locator('[data-testid^="smart-semantic-item-"]')).toHaveCount(1);
  await page.getByTestId('smart-semantic-review-semantic-0').click();

  // 覆盖整个 clip：采纳入口禁用 + 说明可见，时间线不变
  await expect(page.getByTestId('semantic-review-whole-clip')).toContainText('覆盖整个片段');
  await expect(page.getByTestId('semantic-review-apply')).toBeDisabled();
  await expect.poll(() => getVideoClipDuration(page)).toBeCloseTo(2.5);
});
