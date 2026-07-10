import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * AI 面板页面对象 - 封装各种 AI 功能面板的交互
 */
export class AIPanelPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ─── AI 粗剪 ────────────────────────────────────────

  /** 获取 AI 粗剪面板 */
  get roughCutPanel(): Locator {
    return this.getByTestId('ai-rough-cut-panel');
  }

  /** 打开 AI 粗剪面板 */
  async openRoughCut(): Promise<void> {
    await this.safeClick('toolbar-ai-rough-cut-button');
    await expect(this.roughCutPanel).toBeVisible();
  }

  /** 填写粗剪描述 */
  async fillRoughCutDescription(text: string): Promise<void> {
    await this.safeFill('ai-rough-cut-text-input', text);
  }

  /** 开始粗剪生成 */
  async startRoughCut(): Promise<void> {
    await this.safeClick('ai-rough-cut-start');
  }

  /** 等待故事板生成完成 */
  async waitForStoryboard(timeout = 10_000): Promise<void> {
    await expect(this.getByTestId('ai-rough-cut-storyboard')).toBeVisible({ timeout });
  }

  /** 获取故事板中的剪辑数量 */
  async getStoryboardClipCount(): Promise<number> {
    return this.getByTestIdPrefix('ai-rough-cut-clip-').count();
  }

  /** 确认粗剪到时间线 */
  async confirmRoughCut(): Promise<void> {
    await this.safeClick('ai-rough-cut-confirm');
  }

  // ─── AI 聊天编辑器 ──────────────────────────────────

  /** 获取 AI 聊天编辑器面板 */
  get chatEditorPanel(): Locator {
    return this.getByTestId('ai-chat-editor-panel');
  }

  /** 打开 AI 聊天编辑器 */
  async openChatEditor(): Promise<void> {
    await this.safeClick('toolbar-ai-chat-editor-button');
    await expect(this.chatEditorPanel).toBeVisible();
  }

  /** 输入聊天消息 */
  async inputChatMessage(text: string): Promise<void> {
    await this.safeFill('ai-chat-editor-input', text);
  }

  /** 发送聊天消息 */
  async sendChatMessage(): Promise<void> {
    await this.safeClick('ai-chat-editor-send');
  }

  /** 获取聊天消息列表 */
  get chatMessages(): Locator {
    return this.getByTestId('ai-chat-editor-messages');
  }

  // ─── AI 旁白 ────────────────────────────────────────

  /** 获取 AI 旁白面板 */
  get narrationPanel(): Locator {
    return this.getByTestId('ai-narration-panel');
  }

  /** 生成旁白 */
  async generateNarration(): Promise<void> {
    await this.safeClick('ai-narration-generate');
  }

  /** 等待旁白结果 */
  async waitForNarrationResult(timeout = 10_000): Promise<void> {
    await expect(this.getByTestId('ai-narration-result')).toBeVisible({ timeout });
  }

  /** 重新生成旁白 */
  async regenerateNarration(): Promise<void> {
    await this.safeClick('ai-narration-regenerate');
  }

  // ─── AI 视频摘要 ────────────────────────────────────

  /** 获取 AI 视频摘要面板 */
  get videoSummaryPanel(): Locator {
    return this.getByTestId('ai-video-summary-panel');
  }

  /** 开始生成摘要 */
  async startVideoSummary(): Promise<void> {
    await this.safeClick('ai-video-summary-start');
  }

  /** 等待摘要结果 */
  async waitForVideoSummaryResult(timeout = 10_000): Promise<void> {
    await expect(this.getByTestId('ai-video-summary-result')).toBeVisible({ timeout });
  }

  // ─── AI B-Roll ──────────────────────────────────────

  /** 获取 B-Roll 建议区域 */
  get brollSection(): Locator {
    return this.getByTestId('ai-broll-section');
  }

  /** 展开 B-Roll 区域 */
  async expandBrollSection(): Promise<void> {
    await this.brollSection.locator('summary').click();
  }

  /** 获取 B-Roll 结果 */
  get brollResults(): Locator {
    return this.getByTestId('ai-broll-results');
  }

  /** 等待 B-Roll 结果 */
  async waitForBrollResults(timeout = 10_000): Promise<void> {
    await expect(this.brollResults).toBeVisible({ timeout });
  }

  /** 插入第 N 个 B-Roll 建议 */
  async insertBrollSuggestion(index: number): Promise<void> {
    await this.safeClick(`ai-broll-insert-${index}`);
  }

  /** 拒绝第 N 个 B-Roll 建议 */
  async rejectBrollSuggestion(index: number): Promise<void> {
    await this.safeClick(`ai-broll-reject-${index}`);
  }

  // ─── AI 响度 ────────────────────────────────────────

  /** 获取 AI 响度区域 */
  get loudnessSection(): Locator {
    return this.getByTestId('ai-loudness-section');
  }

  /** 展开响度区域 */
  async expandLoudnessSection(): Promise<void> {
    await this.loudnessSection.locator('summary').click();
  }

  /** 测量响度 */
  async measureLoudness(): Promise<void> {
    await this.safeClick('ai-loudness-measure');
  }

  /** 等待响度测量结果 */
  async waitForLoudnessResult(timeout = 10_000): Promise<void> {
    await expect(this.getByTestId('ai-loudness-result')).toBeVisible({ timeout });
  }

  /** 应用响度建议 */
  async applyLoudness(): Promise<void> {
    await this.safeClick('ai-loudness-apply');
  }

  /** 选择响度平台 */
  async selectLoudnessPlatform(platform: string): Promise<void> {
    await this.safeSelect('ai-loudness-platform-select', platform);
  }

  // ─── AI 场景匹配 ────────────────────────────────────

  /** 分析场景匹配 */
  async analyzeSceneMatch(): Promise<void> {
    await this.safeClick('ai-scene-match-analyze');
  }

  /** 等待场景匹配结果 */
  async waitForSceneMatchResults(timeout = 10_000): Promise<void> {
    await expect(this.getByTestId('ai-scene-match-results')).toBeVisible({ timeout });
  }

  // ─── AI 字幕润色 ────────────────────────────────────

  /** 开始字幕润色 */
  async startSubtitlePolish(): Promise<void> {
    await this.safeClick('subtitle-ai-polish-start-button');
  }

  /** 等待字幕润色结果 */
  async waitForSubtitlePolishResults(timeout = 10_000): Promise<void> {
    await expect(this.getByTestId('subtitle-ai-polish-results')).toBeVisible({ timeout });
  }

  /** 接受所有字幕润色建议 */
  async acceptAllSubtitlePolish(): Promise<void> {
    await this.safeClick('subtitle-ai-polish-accept-all');
  }
}
