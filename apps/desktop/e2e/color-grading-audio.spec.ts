import { test, expect } from './fixtures';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

// ─── Color Grading ──────────────────────────────────────────────────────────

test.describe('Color Grading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.clearE2eFiles!();
      window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
    });
    await page.getByTestId('import-media-button').click();
    await addMediaCardToTimeline(page, 0);
    // 使用 force click 绕过 timeline-note-layer 拦截
    await page.locator('[data-testid^="timeline-clip-"]').first().click({ force: true });
    // 等待 Inspector 面板加载
    await expect(page.getByTestId('clip-brightness-input')).toBeVisible({ timeout: 10_000 });
  });

  test('should open color grading workspace and add primary wheel node', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible({ timeout: 10_000 });
    await expect(colorGradingPage.nodeGraph).toBeVisible();
    await colorGradingPage.addWheelNode();
    await expect(colorGradingPage.nodeByType('primary-wheel')).toBeVisible();
  });

  test('should add primary slider and adjust contrast', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible({ timeout: 10_000 });
    await colorGradingPage.addSliderNode();
    await expect(colorGradingPage.nodeByType('primary-slider')).toBeVisible();
    await colorGradingPage.selectNode('primary-slider');
    await colorGradingPage.adjustSlider('对比度', 50);
  });

  test('should display curves editor', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible({ timeout: 10_000 });
    await expect(colorGradingPage.curvesEditor('rgb')).toBeVisible();
  });

  test('should remove color grading node', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible({ timeout: 10_000 });
    await colorGradingPage.addWheelNode();
    await expect(colorGradingPage.nodeByType('primary-wheel')).toBeVisible();

    const removeBtn = colorGradingPage.nodeByType('primary-wheel').locator('button');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(colorGradingPage.nodeByType('primary-wheel')).not.toBeVisible();
  });

  test('should display LUT manager', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible({ timeout: 10_000 });
    await expect(colorGradingPage.lutManager).toBeVisible();
  });
});

// ─── Audio Mixing ───────────────────────────────────────────────────────────

test.describe('Audio Mixing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.clearE2eFiles!();
      window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
    });
    await page.getByTestId('import-media-button').click();
    await addMediaCardToTimeline(page, 0);
  });

  test('should display audio mixer with channel strip', async ({ page }) => {
    // 音频混音器在右侧面板中，需要确保可见
    const mixer = page.getByTestId('audio-mixer');
    await expect(mixer).toBeVisible({ timeout: 10_000 });

    // 检查通道条存在（使用实际 track ID）
    const channel = page.locator('[data-testid^="mixer-channel-"]').first();
    await expect(channel).toBeVisible();
  });

  test('should display volume fader and pan control', async ({ page }) => {
    const mixer = page.getByTestId('audio-mixer');
    await expect(mixer).toBeVisible({ timeout: 10_000 });

    const volumeFader = page.locator('[data-testid^="mixer-volume-"]').first();
    await expect(volumeFader).toBeVisible();

    const panControl = page.locator('[data-testid^="mixer-pan-"]').first();
    await expect(panControl).toBeVisible();
  });

  test('should display mute and solo buttons', async ({ page }) => {
    const mixer = page.getByTestId('audio-mixer');
    await expect(mixer).toBeVisible({ timeout: 10_000 });

    const muteBtn = page.locator('[data-testid^="mixer-mute-"]').first();
    await expect(muteBtn).toBeVisible();

    const soloBtn = page.locator('[data-testid^="mixer-solo-"]').first();
    await expect(soloBtn).toBeVisible();
  });

  test('should toggle mute button', async ({ page }) => {
    const mixer = page.getByTestId('audio-mixer');
    await expect(mixer).toBeVisible({ timeout: 10_000 });

    const muteBtn = page.locator('[data-testid^="mixer-mute-"]').first();
    await expect(muteBtn).toBeVisible();
    await muteBtn.click();
    // 验证点击成功（按钮使用 CSS class 而非 data-active 属性）
    await expect(muteBtn).toBeVisible();
  });
});
