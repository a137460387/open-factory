import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/** 多机位剪辑片段状态快照 */
export interface MulticamClipState {
  angleCount: number;
  switchCount: number;
  switches: Array<{ time: number; angleId: string }>;
  activeAngle?: string;
  angles: Array<{ id: string; name: string; offset: number }>;
}

/**
 * 多机位编辑页面对象 - 封装多机位剪辑相关的所有交互
 */
export class MulticamEditorPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // -----------------------------------------------------------------------
  // Fixture 设置
  // -----------------------------------------------------------------------

  /** 加载多机位基础夹具（两个机位的视频片段，已选中） */
  async setupMulticamFixture(): Promise<void> {
    await this.evaluateAction('window.__E2E_ACTIONS__.setupMulticamFixture()');
  }

  /** 加载多机位 AI 剪辑夹具（三个机位的嵌套序列，已选中） */
  async setupMulticamAiCutFixture(): Promise<void> {
    await this.evaluateAction('window.__E2E_ACTIONS__.setupMulticamAiCutFixture()');
  }

  /** 进入多机位编辑模式 */
  async enterMulticamEditMode(clipId: string): Promise<void> {
    await this.page.evaluate(
      (id) => window.__E2E_ACTIONS__!.enterMulticamEditMode!(id),
      clipId
    );
  }

  /** 退出多机位编辑模式 */
  async exitMulticamEditMode(): Promise<void> {
    await this.evaluateAction('window.__E2E_ACTIONS__.exitMulticamEditMode()');
  }

  // -----------------------------------------------------------------------
  // 多机位预览网格
  // -----------------------------------------------------------------------

  /** 获取多机位预览网格 */
  get previewGrid(): Locator {
    return this.getByTestId('multicam-preview-grid');
  }

  /** 等待多机位预览网格可见 */
  async waitForPreviewGrid(timeout = 10_000): Promise<void> {
    await expect(this.previewGrid).toBeVisible({ timeout });
  }

  /** 获取机位切换按钮 */
  getAngleButton(angleId: string): Locator {
    return this.getByTestId(`multicam-angle-button-${angleId}`);
  }

  /** 点击机位按钮切换机位 */
  async clickAngle(angleId: string): Promise<void> {
    await this.getAngleButton(angleId).click();
  }

  /** 获取当前活跃的机位按钮 */
  getActiveAngleButton(): Locator {
    return this.page.locator('[data-testid^="multicam-angle-button-"][data-active="true"]');
  }

  // -----------------------------------------------------------------------
  // 实时模式
  // -----------------------------------------------------------------------

  /** 获取实时模式切换按钮 */
  get liveModeToggle(): Locator {
    return this.getByTestId('multicam-live-mode-toggle');
  }

  /** 切换实时模式 */
  async toggleLiveMode(): Promise<void> {
    await this.liveModeToggle.click();
  }

  /** 检查实时模式是否激活 */
  async isLiveModeActive(): Promise<boolean> {
    return (await this.liveModeToggle.getAttribute('data-active')) === 'true';
  }

  // -----------------------------------------------------------------------
  // 切换历史
  // -----------------------------------------------------------------------

  /** 获取切换历史面板 */
  get cutHistoryPanel(): Locator {
    return this.getByTestId('multicam-cut-history-panel');
  }

  /** 获取切换历史列表 */
  get historyList(): Locator {
    return this.getByTestId('multicam-history-list');
  }

  // -----------------------------------------------------------------------
  // 角度切换面板 (AngleSwitcherPanel - 需要 enterMulticamEditMode)
  // -----------------------------------------------------------------------

  /** 获取角度切换面板 */
  get angleSwitcherPanel(): Locator {
    return this.getByTestId('angle-switcher-panel');
  }

  /** 等待角度切换面板可见 */
  async waitForAngleSwitcherPanel(timeout = 10_000): Promise<void> {
    await expect(this.angleSwitcherPanel).toBeVisible({ timeout });
  }

  // -----------------------------------------------------------------------
  // 同步控制
  // -----------------------------------------------------------------------

  /** 获取同步控制区域 */
  get syncControls(): Locator {
    return this.getByTestId('sync-controls');
  }

  /** 获取同步按钮 */
  get syncButton(): Locator {
    return this.getByTestId('sync-button');
  }

  /** 点击同步按钮 */
  async clickSync(): Promise<void> {
    await this.syncButton.click();
  }

  /** 等待同步完成（按钮文本恢复为"开始同步"） */
  async waitForSyncComplete(timeout = 15_000): Promise<void> {
    await expect(this.syncButton).toBeEnabled({ timeout });
    await expect(this.syncButton).toHaveText('开始同步', { timeout });
  }

  /** 选择同步模式 */
  async selectSyncMode(mode: 'audio' | 'timecode' | 'manual'): Promise<void> {
    await this.getByTestId(`sync-mode-${mode}`).click();
  }

  // -----------------------------------------------------------------------
  // 漂移检测
  // -----------------------------------------------------------------------

  /** 获取漂移检测按钮 */
  get driftDetectionButton(): Locator {
    return this.getByTestId('drift-detection-button');
  }

  /** 点击漂移检测按钮 */
  async clickDriftDetection(): Promise<void> {
    await this.driftDetectionButton.click();
  }

  /** 获取漂移检测结果消息 */
  get driftMessage(): Locator {
    return this.getByTestId('drift-message');
  }

  /** 等待漂移检测结果 */
  async waitForDriftResult(timeout = 15_000): Promise<void> {
    await expect(this.driftMessage).toBeVisible({ timeout });
  }

  /** 获取漂移检测结果文本 */
  async getDriftMessageText(): Promise<string> {
    return (await this.driftMessage.textContent())?.trim() ?? '';
  }

  // -----------------------------------------------------------------------
  // 切换点编辑器
  // -----------------------------------------------------------------------

  /** 获取切换点编辑器 */
  get switchPointEditor(): Locator {
    return this.getByTestId('switch-point-editor');
  }

  /** 获取添加切换点按钮 */
  get addSwitchPointButton(): Locator {
    return this.getByTestId('add-switch-point-button');
  }

  /** 点击添加切换点 */
  async addSwitchPoint(): Promise<void> {
    await this.addSwitchPointButton.click();
  }

  /** 获取指定索引的切换点 */
  getSwitchPoint(index: number): Locator {
    return this.getByTestId(`switch-point-${index}`);
  }

  /** 获取所有切换点 */
  getAllSwitchPoints(): Locator {
    return this.getByTestIdPrefix('switch-point-');
  }

  /** 获取切换点数量 */
  async getSwitchPointCount(): Promise<number> {
    return this.getAllSwitchPoints().count();
  }

  /** 等待切换点出现 */
  async waitForSwitchPoints(timeout = 10_000): Promise<void> {
    await expect(this.getAllSwitchPoints().first()).toBeVisible({ timeout });
  }

  /** 等待切换点数量达到指定值 */
  async expectSwitchPointCount(count: number, timeout = 10_000): Promise<void> {
    await expect(this.getAllSwitchPoints()).toHaveCount(count, { timeout });
  }

  /** 删除指定索引的切换点 */
  async deleteSwitchPoint(index: number): Promise<void> {
    await this.getByTestId(`delete-switch-point-${index}`).click();
  }

  // -----------------------------------------------------------------------
  // 工具栏
  // -----------------------------------------------------------------------

  /** 点击撤销按钮 */
  async undo(): Promise<void> {
    await this.safeClick('toolbar-undo-button');
  }

  /** 点击重做按钮 */
  async redo(): Promise<void> {
    await this.safeClick('toolbar-redo-button');
  }

  /** 点击创建多机位序列按钮 */
  async createMulticamSequence(): Promise<void> {
    await this.safeClick('toolbar-create-multicam-button');
  }

  /** 检查创建多机位序列按钮是否可用 */
  async canCreateMulticamSequence(): Promise<boolean> {
    return !(await this.getByTestId('toolbar-create-multicam-button').isDisabled());
  }

  // -----------------------------------------------------------------------
  // 数据查询
  // -----------------------------------------------------------------------

  /** 获取多机位剪辑状态快照 */
  async getMulticamClipState(): Promise<MulticamClipState | undefined> {
    return this.page.evaluate(
      () => window.__E2E_ACTIONS__!.getMulticamClipState!() as MulticamClipState | undefined
    );
  }

  /** 获取切换点数量（通过状态快照） */
  async getSwitchCount(): Promise<number> {
    const state = await this.getMulticamClipState();
    return state?.switchCount ?? 0;
  }

  /** 轮询等待切换点数量变化 */
  async pollSwitchCount(
    predicate: (count: number) => boolean,
    options?: { timeout?: number }
  ): Promise<void> {
    await this.pollAction(
      async () => {
        const count = await this.getSwitchCount();
        return predicate(count);
      },
      options
    );
  }
}
