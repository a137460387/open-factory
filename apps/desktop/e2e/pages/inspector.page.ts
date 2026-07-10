import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * 检查器面板页面对象 - 封装右侧检查器面板的交互
 */
export class InspectorPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** 获取检查器面板 */
  get panel(): Locator {
    return this.getByTestId('inspector-panel');
  }

  /** 关闭检查器 */
  async close(): Promise<void> {
    await this.safeClick('inspector-close-button');
  }

  /** 检查是否显示空状态 */
  async isEmpty(): Promise<boolean> {
    return this.getByTestId('inspector-empty-state').isVisible();
  }

  /** 检查是否显示多选状态 */
  async isMultipleSelection(): Promise<boolean> {
    return this.getByTestId('inspector-multiple-selection-state').isVisible();
  }

  /** 获取变换 X 输入框 */
  get transformX(): Locator {
    return this.getByTestId('clip-transform-x-input');
  }

  /** 获取缩放 X 输入框 */
  get scaleX(): Locator {
    return this.getByTestId('clip-scale-x-input');
  }

  /** 获取旋转输入框 */
  get rotation(): Locator {
    return this.getByTestId('clip-rotation-input');
  }

  /** 获取亮度输入框 */
  get brightness(): Locator {
    return this.getByTestId('clip-brightness-input');
  }

  /** 获取速度输入框 */
  get speed(): Locator {
    return this.getByTestId('clip-speed-input');
  }

  /** 填写变换 X 值 */
  async fillTransformX(value: string): Promise<void> {
    await this.safeFill('clip-transform-x-input', value);
  }

  /** 填写缩放 X 值 */
  async fillScaleX(value: string): Promise<void> {
    await this.safeFill('clip-scale-x-input', value);
  }

  /** 填写旋转值 */
  async fillRotation(value: string): Promise<void> {
    await this.safeFill('clip-rotation-input', value);
  }

  /** 填写速度值 */
  async fillSpeed(value: string): Promise<void> {
    await this.safeFill('clip-speed-input', value);
  }

  /** 添加效果 */
  async addEffect(): Promise<void> {
    await this.safeClick('add-effect-button');
  }

  /** 添加遮罩 */
  async addMask(): Promise<void> {
    await this.safeClick('add-mask-button');
  }
}
