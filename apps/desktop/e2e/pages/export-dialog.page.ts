import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/** 导出任务状态类型 */
export type ExportTaskStatus = 'pending' | 'running' | 'success' | 'canceled' | 'scheduled' | 'error';

/**
 * 导出对话框页面对象 - 封装导出弹窗的所有交互
 */
export class ExportDialogPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** 获取导出对话框 */
  get dialog(): Locator {
    return this.getByTestId('export-dialog');
  }

  /** 等待导出对话框可见 */
  async waitForOpen(timeout = 15_000): Promise<void> {
    // 15s：ExportDialog 为双层 lazy chunk（ShellFloatingDialogs →
    // ExportDialogs → ExportDialog），慢 runner 上加载+渲染链实测可超
    // 10s（run 32625097893 nested-sequence-export 两用例稳定失败根因）
    await expect(this.dialog).toBeVisible({ timeout });
  }

  /** 关闭导出对话框 */
  async close(): Promise<void> {
    const closeBtn = this.dialog.getByRole('button', { name: '关闭导出弹窗' });
    await closeBtn.click();
  }

  /** 选择导出预设 */
  async selectPreset(preset: string): Promise<void> {
    await this.safeSelect('export-preset-select', preset);
  }

  /** 选择帧率 */
  async selectFps(fps: string): Promise<void> {
    await this.safeSelect('export-fps-select', fps);
  }

  /** 设置最大并发数 */
  async setMaxConcurrent(value: string): Promise<void> {
    await this.safeSelect('export-max-concurrent-select', value);
  }

  /** 选择导出优先级 */
  async setPriority(priority: 'low' | 'medium' | 'high'): Promise<void> {
    await this.safeSelect('export-priority-select', priority);
  }

  /** 选择导出范围 */
  async setRange(range: string): Promise<void> {
    await this.safeSelect('export-range-select', range);
  }

  /** 填写导出路径（支持多行批量：每行一个输出路径，入队时每行一个任务）。
   * 对应 single 模式的 export-batch-paths 多行 textarea（绑定 batchOutputPaths，
   * useExportActions 入队时按换行拆分；为空才回退单路径 export-output-path）。
   * 注：该 textarea 曾在向导拆分（bd315fd6）中丢失、helper 一度被误导向单路径
   * export-output-path（f8355019），现已随 UI 恢复回填原控件。 */
  async fillBatchPaths(paths: string): Promise<void> {
    await this.safeFill('export-batch-paths', paths);
  }

  /** 点击入队按钮 */
  async enqueue(): Promise<void> {
    await this.safeClick('export-enqueue-button');
  }

  /** 选择预设 + 填路径 + 入队的快捷方法 */
  async quickExport(preset: string, paths: string): Promise<void> {
    await this.selectPreset(preset);
    await this.fillBatchPaths(paths);
    await this.enqueue();
  }

  /** 启用硬件编码 */
  async enableHardwareEncoding(): Promise<void> {
    await this.getByTestId('export-hardware-encoding-toggle').check();
  }

  /** 获取导出队列列表 */
  get queueList(): Locator {
    return this.getByTestId('export-queue-list');
  }

  /** 获取第 N 个任务的状态元素 */
  getTaskStatus(index: number): Locator {
    return this.queueList.getByTestId('export-task-status').nth(index);
  }

  /** 等待任务达到指定状态 */
  async expectTaskStatus(index: number, status: ExportTaskStatus, timeout = 15_000): Promise<void> {
    await expect(this.getTaskStatus(index)).toHaveAttribute('data-status', status, { timeout });
  }

  /** 取消第 N 个任务 */
  async cancelTask(index: number): Promise<void> {
    await this.getByTestId('export-task-cancel-button').nth(index).click();
  }

  /** 重试第 N 个任务 */
  async retryTask(index: number): Promise<void> {
    await this.getByTestId('export-task-retry-button').nth(index).click();
  }

  /** 获取费用估算面板 */
  get costEstimatePanel(): Locator {
    return this.getByTestId('export-cost-estimate-panel');
  }

  /** 获取费用时长文本 */
  async getCostDuration(): Promise<string> {
    return (await this.getByTestId('export-cost-duration').textContent())?.trim() ?? '';
  }

  /** 获取费用大小文本 */
  get costSize(): Locator {
    return this.getByTestId('export-cost-size');
  }

  /** 获取预检面板 */
  get preflightPanel(): Locator {
    return this.getByTestId('export-preflight-panel');
  }

  /** 获取预检问题 */
  get preflightIssue(): Locator {
    return this.getByTestId('export-preflight-issue');
  }

  /** 点击预检重新链接按钮 */
  async preflightRelink(): Promise<void> {
    await this.safeClick('export-preflight-relink-button');
  }

  /** 获取导出历史列表 */
  get historyList(): Locator {
    return this.getByTestId('export-history-list');
  }

  /** 启用计划导出 */
  async enableSchedule(): Promise<void> {
    await this.getByTestId('export-schedule-toggle').check();
  }

  /** 设置计划开始时间 */
  async setScheduleTime(value: string): Promise<void> {
    await this.safeFill('export-schedule-start-input', value);
  }

  /** 获取任务优先级文本 */
  getTaskPriority(index: number): Locator {
    return this.getByTestId('export-task-priority').nth(index);
  }
}
