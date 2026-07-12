import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Color Grading 页面对象 - 封装调色工作区的所有交互
 *
 * data-testid 属性来源：
 * - ColorGradingWorkspace: color-grading-workspace
 * - NodeGraphView:        node-graph-view, add-wheel-node, add-slider-node, node-{type}
 * - CurvesEditor:         curves-editor-{channel}
 * - LUTManager:           lut-manager, import-lut-btn, lut-file-input, lut-library-list,
 *                         lut-entry-{id}, apply-lut-{id}, delete-lut-{id},
 *                         active-lut-layers, lut-layer-{id}, toggle-lut-{id},
 *                         lut-intensity-{id}, remove-lut-{id}
 * - ColorWheelPanel:      color-wheel-panel, color-wheel-{name}, master-slider-{name}
 * - PrimarySlidersPanel:  primary-sliders-panel, slider-{name}
 */
export class ColorGradingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Root locators ───────────────────────────────────────────────────

  get workspace(): Locator {
    return this.getByTestId('color-grading-workspace');
  }

  get nodeGraph(): Locator {
    return this.getByTestId('node-graph-view');
  }

  get colorWheelPanel(): Locator {
    return this.getByTestId('color-wheel-panel');
  }

  get primarySlidersPanel(): Locator {
    return this.getByTestId('primary-sliders-panel');
  }

  get lutManager(): Locator {
    return this.getByTestId('lut-manager');
  }

  // ── Node Graph actions ─────────────────────────────────────────────

  /** 点击 "添加色轮节点" 按钮 */
  async addWheelNode(): Promise<void> {
    await this.safeClick('add-wheel-node');
  }

  /** 点击 "添加滑块节点" 按钮 */
  async addSliderNode(): Promise<void> {
    await this.safeClick('add-slider-node');
  }

  /** 通过节点类型点击对应的添加按钮 (如 'wheel' 或 'slider') */
  async addNode(type: string): Promise<void> {
    await this.safeClick(`add-${type}-node`);
  }

  /** 选择指定类型的节点（如 'primary-wheel', 'primary-slider'） */
  async selectNode(type: string): Promise<void> {
    await this.safeClick(`node-${type}`);
  }

  /** 获取指定类型的节点 locator */
  nodeByType(type: string): Locator {
    return this.getByTestId(`node-${type}`);
  }

  // ── Curves Editor ──────────────────────────────────────────────────

  /** 获取指定通道的曲线编辑器 locator（'rgb' | 'red' | 'green' | 'blue'） */
  curvesEditor(channel: string = 'rgb'): Locator {
    return this.getByTestId(`curves-editor-${channel}`);
  }

  // ── Color Wheel Panel ──────────────────────────────────────────────

  /** 获取指定色轮的 locator（'lift (暗部)', 'gamma (中间调)', 'gain (高光)', 'offset (偏移)'） */
  colorWheel(name: string): Locator {
    return this.getByTestId(`color-wheel-${name}`);
  }

  /** 获取指定主亮度滑块的 locator（'lift', 'gamma', 'gain', 'offset'） */
  masterSlider(name: string): Locator {
    return this.getByTestId(`master-slider-${name}`);
  }

  // ── Primary Sliders Panel ──────────────────────────────────────────

  /** 获取指定滑块的 locator（'色温', '色调', '对比度', '轴心', '饱和度', '色相'） */
  slider(name: string): Locator {
    return this.getByTestId(`slider-${name}`);
  }

  /** 拖拽滑块到指定值 */
  async adjustSlider(name: string, value: number): Promise<void> {
    await this.safeFill(`slider-${name}`, String(value));
  }

  // ── LUT Manager ────────────────────────────────────────────────────

  /** 点击 "导入 LUT" 按钮 */
  async clickImportLUT(): Promise<void> {
    await this.safeClick('import-lut-btn');
  }

  /** 获取 LUT 文件隐藏 input（用于 setInputFiles） */
  get lutFileInput(): Locator {
    return this.getByTestId('lut-file-input');
  }

  /** 通过文件路径导入 LUT */
  async importLUT(filePath: string): Promise<void> {
    await this.lutFileInput.setInputFiles(filePath);
  }

  /** 获取 LUT 库列表 locator */
  get lutLibraryList(): Locator {
    return this.getByTestId('lut-library-list');
  }

  /** 获取 LUT 库为空时的提示 locator */
  get lutLibraryEmpty(): Locator {
    return this.getByTestId('lut-library-empty');
  }

  /** 获取指定 LUT 条目 locator */
  lutEntry(lutId: string): Locator {
    return this.getByTestId(`lut-entry-${lutId}`);
  }

  /** 获取指定 LUT 名称文本 locator */
  lutName(lutId: string): Locator {
    return this.getByTestId(`lut-name-${lutId}`);
  }

  /** 获取指定 LUT 信息文本 locator */
  lutInfo(lutId: string): Locator {
    return this.getByTestId(`lut-info-${lutId}`);
  }

  /** 点击 "应用" 按钮应用指定 LUT */
  async applyLUT(lutId: string): Promise<void> {
    await this.safeClick(`apply-lut-${lutId}`);
  }

  /** 点击 "删除" 按钮从库中移除指定 LUT */
  async deleteLUT(lutId: string): Promise<void> {
    await this.safeClick(`delete-lut-${lutId}`);
  }

  /** 获取活动 LUT 图层列表 locator */
  get activeLUTLayers(): Locator {
    return this.getByTestId('active-lut-layers');
  }

  /** 获取 "无活动 LUT" 提示 locator */
  get noActiveLUT(): Locator {
    return this.getByTestId('no-active-lut');
  }

  /** 获取指定 LUT 图层 locator */
  lutLayer(layerId: string): Locator {
    return this.getByTestId(`lut-layer-${layerId}`);
  }

  /** 切换指定 LUT 图层的启用/禁用状态 */
  async toggleLUTLayer(layerId: string): Promise<void> {
    await this.safeClick(`toggle-lut-${layerId}`);
  }

  /** 获取指定 LUT 图层强度滑块 locator */
  lutIntensity(layerId: string): Locator {
    return this.getByTestId(`lut-intensity-${layerId}`);
  }

  /** 获取指定 LUT 图层强度值文本 locator */
  lutIntensityValue(layerId: string): Locator {
    return this.getByTestId(`lut-intensity-value-${layerId}`);
  }

  /** 移除指定 LUT 图层 */
  async removeLUTLayer(layerId: string): Promise<void> {
    await this.safeClick(`remove-lut-${layerId}`);
  }
}
