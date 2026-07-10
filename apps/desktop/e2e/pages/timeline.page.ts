import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/** 时间线快照类型 */
export interface TimelineSnapshot {
  tracks: Array<{
    id: string;
    name: string;
    clips: Array<{
      id: string;
      start: number;
      duration: number;
      trimStart: number;
      trimEnd: number;
      assetId?: string;
    }>;
  }>;
}

/**
 * 时间线页面对象 - 封装时间线区域的所有交互
 */
export class TimelinePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** 获取时间线根元素 */
  get root(): Locator {
    return this.getByTestId('timeline-root');
  }

  /** 获取时间线面板 */
  get panel(): Locator {
    return this.getByTestId('timeline-panel');
  }

  /** 获取播放头 */
  get playhead(): Locator {
    return this.getByTestId('timeline-playhead');
  }

  /** 获取时间线标尺 */
  get ruler(): Locator {
    return this.getByTestId('timeline-ruler');
  }

  /** 通过 clipId 获取剪辑片段 */
  getClip(clipId: string): Locator {
    return this.getByTestId(`timeline-clip-${clipId}`);
  }

  /** 获取所有剪辑片段 */
  getAllClips(): Locator {
    return this.getByTestIdPrefix('timeline-clip-');
  }

  /** 获取第 N 个剪辑片段 */
  getClipByIndex(index: number): Locator {
    return this.getByTestIdPrefix('timeline-clip-').nth(index);
  }

  /** 获取剪辑片段数量 */
  async getClipCount(): Promise<number> {
    return this.getAllClips().count();
  }

  /** 等待剪辑片段出现 */
  async waitForClips(timeout = 10_000): Promise<void> {
    await expect(this.getAllClips().first()).toBeVisible({ timeout });
  }

  /** 等待指定数量的剪辑片段 */
  async expectClipCount(count: number, timeout = 10_000): Promise<void> {
    await expect(this.getAllClips()).toHaveCount(count, { timeout });
  }

  /** 点击时间线区域（用于获取焦点） */
  async focus(): Promise<void> {
    await this.root.click();
  }

  /** 设置播放头位置（秒） */
  async setPlayheadTime(time: number): Promise<void> {
    await this.page.evaluate((t) => window.__E2E_ACTIONS__!.setPlayheadTime!(t), time);
  }

  /** 获取时间线快照 */
  async getSnapshot(): Promise<TimelineSnapshot> {
    return this.page.evaluate(
      () => window.__E2E_ACTIONS__!.getTimelineSnapshot!() as TimelineSnapshot
    );
  }

  /** 获取所有剪辑的 ID 列表 */
  async getClipIds(): Promise<string[]> {
    const snapshot = await this.getSnapshot();
    return snapshot.tracks.flatMap((t) => t.clips.map((c) => c.id));
  }

  /** 获取第一个轨道的所有剪辑 */
  async getFirstTrackClips(): Promise<TimelineSnapshot['tracks'][0]['clips']> {
    const snapshot = await this.getSnapshot();
    return snapshot.tracks[0]?.clips ?? [];
  }

  /** 拖拽剪辑片段偏移 */
  async dragClipBy(clipId: string, deltaX: number, steps = 6): Promise<void> {
    const clip = this.getClip(clipId);
    await this.dragBy(clip, deltaX, 0, steps);
  }

  /** 拖拽第 N 个剪辑片段偏移 */
  async dragClipByIndex(index: number, deltaX: number, steps = 6): Promise<void> {
    const clip = this.getClipByIndex(index);
    await this.dragBy(clip, deltaX, 0, steps);
  }

  /** 拖拽修剪手柄偏移 */
  async dragTrimHandle(clipId: string, side: 'left' | 'right', deltaX: number, steps = 8): Promise<void> {
    const handleTestId = side === 'right'
      ? `timeline-trim-right-${clipId}`
      : `timeline-trim-left-${clipId}`;
    const handle = this.getByTestId(handleTestId);
    await this.dragBy(handle, deltaX, 0, steps);
  }

  /** 选中剪辑片段 */
  async selectClip(clipId: string): Promise<void> {
    await this.getClip(clipId).click();
  }

  /** 删除选中的剪辑片段 (Delete 键) */
  async deleteSelected(): Promise<void> {
    await this.page.keyboard.press('Delete');
  }

  /** Ripple 删除选中的剪辑片段 (Shift+Delete) */
  async rippleDeleteSelected(): Promise<void> {
    await this.page.keyboard.down('Shift');
    await this.page.keyboard.press('Delete');
    await this.page.keyboard.up('Shift');
  }

  /** 标记入点 */
  async markIn(): Promise<void> {
    await this.page.keyboard.press('I');
  }

  /** 标记出点 */
  async markOut(): Promise<void> {
    await this.page.keyboard.press('O');
  }

  /** 添加文本剪辑 */
  async addTextClip(): Promise<void> {
    await this.safeClick('add-text-clip-button');
  }

  /** 缩放滑块 */
  get zoomSlider(): Locator {
    return this.getByTestId('timeline-zoom-slider');
  }

  /** 搜索框 */
  get searchInput(): Locator {
    return this.getByTestId('timeline-search-input');
  }

  /** 导出范围高亮 */
  get exportRangeHighlight(): Locator {
    return this.getByTestId('timeline-export-range-highlight');
  }

  /** 网格线 */
  get gridLine(): Locator {
    return this.getByTestId('timeline-grid-line');
  }

  /** 等待网格线出现 */
  async waitForGridLine(timeout = 5_000): Promise<void> {
    await expect(this.gridLine.first()).toBeVisible({ timeout });
  }
}
