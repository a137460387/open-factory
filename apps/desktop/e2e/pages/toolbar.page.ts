import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * 工具栏页面对象 - 封装顶部工具栏的所有交互
 */
export class ToolbarPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** 点击导入媒体按钮 */
  async importMedia(): Promise<void> {
    await this.safeClick('import-media-button');
  }

  /** 点击导出按钮 */
  async openExport(): Promise<void> {
    await this.safeClick('toolbar-export-button');
  }

  /** 点击撤销按钮 */
  async undo(): Promise<void> {
    await this.safeClick('toolbar-undo-button');
  }

  /** 点击设置按钮 */
  async openSettings(): Promise<void> {
    await this.safeClick('toolbar-settings-button');
  }

  /** 点击 AI 粗剪按钮 */
  async openAIRoughCut(): Promise<void> {
    await this.safeClick('toolbar-ai-rough-cut-button');
  }

  /** 点击 AI 聊天编辑器按钮 */
  async openAIChatEditor(): Promise<void> {
    await this.safeClick('toolbar-ai-chat-editor-button');
  }

  /** 点击网格吸附按钮 */
  async toggleGridSnap(): Promise<void> {
    await this.safeClick('toolbar-grid-snap-button');
  }

  /** 设置网格吸附单位 */
  async setGridSnapUnit(unit: string): Promise<void> {
    await this.safeSelect('toolbar-grid-snap-unit-select', unit);
  }

  /** 点击打开项目按钮 */
  async openProject(): Promise<void> {
    await this.safeClick('toolbar-open-project-button');
  }

  /** 点击保存项目按钮 */
  async saveProject(): Promise<void> {
    await this.safeClick('toolbar-save-project-button');
  }

  /** 点击历史面板按钮 */
  async openHistory(): Promise<void> {
    await this.safeClick('toolbar-history-button');
  }

  /** 点击音乐匹配按钮 */
  async openMusicMatch(): Promise<void> {
    await this.safeClick('toolbar-music-match-button');
  }

  /** 点击高光片段按钮 */
  async openHighlightReel(): Promise<void> {
    await this.safeClick('toolbar-highlight-reel-button');
  }

  /** 点击导演模式按钮 */
  async openDirectorMode(): Promise<void> {
    await this.safeClick('toolbar-director-mode-button');
  }

  /** 点击 PIP 画中画按钮 */
  async openPIP(): Promise<void> {
    await this.safeClick('toolbar-pip-button');
  }

  /** 点击新建项目按钮 */
  async newProject(): Promise<void> {
    await this.safeClick('toolbar-new-project-button');
  }
}
