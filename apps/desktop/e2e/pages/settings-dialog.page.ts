import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * 设置对话框页面对象 - 封装设置弹窗的交互
 */
export class SettingsDialogPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** 获取设置对话框 */
  get dialog(): Locator {
    return this.getByTestId('settings-dialog');
  }

  /** 等待设置对话框可见 */
  async waitForOpen(timeout = 10_000): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout });
  }

  /** 关闭设置对话框 */
  async close(): Promise<void> {
    await this.safeClick('settings-close-button');
  }

  /** 切换到指定标签页 */
  async switchTab(tab: string): Promise<void> {
    await this.safeClick(`settings-tab-${tab}`);
  }

  /** 切换到外观标签 */
  async switchToAppearance(): Promise<void> {
    await this.switchTab('appearance');
  }

  /** 切换到导出预设标签 */
  async switchToExportPresets(): Promise<void> {
    await this.switchTab('export-presets');
  }

  /** 切换到插件标签 */
  async switchToPlugins(): Promise<void> {
    await this.switchTab('plugins');
  }

  /** 切换到快捷键标签 */
  async switchToShortcuts(): Promise<void> {
    await this.switchTab('shortcuts');
  }

  /** 切换到代理标签 */
  async switchToProxy(): Promise<void> {
    await this.switchTab('proxy');
  }

  /** 切换到本地模型标签 */
  async switchToLocalModels(): Promise<void> {
    await this.switchTab('local-models');
  }

  /** 切换到 AI 服务标签 */
  async switchToAIServices(): Promise<void> {
    await this.switchTab('ai-services');
  }

  /** 切换到自动化标签 */
  async switchToAutomation(): Promise<void> {
    await this.switchTab('automation');
  }

  /** 切换到脚本标签 */
  async switchToScripts(): Promise<void> {
    await this.switchTab('scripts');
  }

  /** 切换到 LUT 库标签 */
  async switchToLutLibrary(): Promise<void> {
    await this.switchTab('lut-library');
  }

  /** 切换到协作标签 */
  async switchToCollaboration(): Promise<void> {
    await this.switchTab('collaboration');
  }

  /** 切换到备份标签 */
  async switchToBackup(): Promise<void> {
    await this.switchTab('backup');
  }

  /** 切换到翻译标签 */
  async switchToTranslation(): Promise<void> {
    await this.switchTab('translation');
  }

  /** 切换到效果预设标签 */
  async switchToEffectPresets(): Promise<void> {
    await this.switchTab('effect-presets');
  }

  /** 切换到宏历史标签 */
  async switchToMacros(): Promise<void> {
    await this.switchTab('macros');
  }

  /** 切换到任务监控标签 */
  async switchToTaskMonitor(): Promise<void> {
    await this.switchTab('task-monitor');
  }

  /** 启用低功耗导出模式 */
  async enableLowPowerExport(): Promise<void> {
    await this.getByTestId('settings-export-low-power-toggle').check();
  }

  /** 设置自动保存间隔 */
  async setAutosaveInterval(value: string): Promise<void> {
    await this.safeFill('autosave-interval-input', value);
  }

  /** 选择语言 */
  async setLanguage(language: string): Promise<void> {
    await this.safeSelect('settings-language-select', language);
  }

  /** 选择主题 */
  async setTheme(theme: string): Promise<void> {
    await this.safeSelect('theme-select', theme);
  }
}
