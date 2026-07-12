import { test, expect } from './fixtures';

// ─── Color Grading ──────────────────────────────────────────────────────────

test.describe('Color Grading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-ready')).toBeVisible({ timeout: 15_000 });
  });

  test('should open color grading workspace and add primary wheel node', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible();
    await expect(colorGradingPage.nodeGraph).toBeVisible();
    await colorGradingPage.addWheelNode();
    await expect(colorGradingPage.nodeByType('primary-wheel')).toBeVisible();
    await expect(colorGradingPage.colorWheelPanel).toBeVisible();
  });

  test('should add primary slider and adjust contrast', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible();
    await colorGradingPage.addSliderNode();
    await expect(colorGradingPage.nodeByType('primary-slider')).toBeVisible();
    await expect(colorGradingPage.primarySlidersPanel).toBeVisible();
    await colorGradingPage.selectNode('primary-slider');
    await colorGradingPage.adjustSlider('对比度', 50);
    await expect(colorGradingPage.slider('对比度')).toHaveValue('50');
  });

  test('should display curves editor', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible();
    await expect(colorGradingPage.curvesEditor('rgb')).toBeVisible();
  });

  test('should remove color grading node', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible();
    await colorGradingPage.addWheelNode();
    await expect(colorGradingPage.nodeByType('primary-wheel')).toBeVisible();

    const removeBtn = colorGradingPage.nodeByType('primary-wheel').locator('button');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(colorGradingPage.nodeByType('primary-wheel')).not.toBeVisible();
    await expect(colorGradingPage.nodeGraph).toContainText('点击上方按钮添加调色节点');
  });

  test('should display LUT manager and import button', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible();
    await expect(colorGradingPage.lutManager).toBeVisible();
    await expect(colorGradingPage.getByTestId('import-lut-btn')).toBeVisible();
  });
});

// ─── Audio Mixing ───────────────────────────────────────────────────────────

test.describe('Audio Mixing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-ready')).toBeVisible({ timeout: 15_000 });
  });

  test('should display audio mixer with channel strips', async ({ audioMixerPage }) => {
    await expect(audioMixerPage.mixer).toBeVisible();
    await expect(audioMixerPage.volumeFader('0')).toBeVisible();
    await expect(audioMixerPage.muteButton('0')).toBeVisible();
    await expect(audioMixerPage.soloButton('0')).toBeVisible();
  });

  test('should adjust volume and verify state', async ({ audioMixerPage }) => {
    await expect(audioMixerPage.mixer).toBeVisible();
    await audioMixerPage.setVolume('0', -6);
    await expect(audioMixerPage.volumeFader('0')).toHaveValue('-6');
  });

  test('should toggle mute and solo', async ({ audioMixerPage }) => {
    await expect(audioMixerPage.mixer).toBeVisible();

    await audioMixerPage.toggleMute('0');
    await expect(audioMixerPage.muteButton('0')).toHaveAttribute('data-active', 'true');

    await audioMixerPage.toggleSolo('0');
    await expect(audioMixerPage.soloButton('0')).toHaveAttribute('data-active', 'true');
  });

  test('should display VU meters', async ({ audioMixerPage }) => {
    await expect(audioMixerPage.mixer).toBeVisible();
    await expect(audioMixerPage.getByTestId('vu-meter')).toBeVisible();
  });

  test('should display automation editor', async ({ audioMixerPage }) => {
    await expect(audioMixerPage.mixer).toBeVisible();
    await expect(audioMixerPage.automationEditor).toBeVisible();
  });
});
