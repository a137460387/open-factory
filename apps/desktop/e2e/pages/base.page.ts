import { expect, type Locator, type Page } from '@playwright/test';

/**
 * 页面对象基类 - 封装所有页面共享的通用操作
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /** 导航到应用首页并等待 E2E mock 层就绪 */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForE2eActions();
  }

  /** 等待 E2E mock 层加载完成 */
  async waitForE2eActions(): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => Boolean(window.__E2E_ACTIONS__)), {
        timeout: 15_000
      })
      .toBe(true);
  }

  /** 等待 App Store 初始化完成 */
  async waitForAppStore(): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => Boolean((window as any).__APP_STORE__)), {
        timeout: 15_000
      })
      .toBe(true);
  }

  /** 通过 testid 获取元素 */
  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** 通过 testid 前缀获取元素 */
  getByTestIdPrefix(prefix: string): Locator {
    return this.page.locator(`[data-testid^="${prefix}"]`);
  }

  /** 等待元素可见 */
  async waitVisible(testId: string, timeout = 10_000): Promise<void> {
    await expect(this.getByTestId(testId)).toBeVisible({ timeout });
  }

  /** 等待元素消失 */
  async waitHidden(testId: string, timeout = 10_000): Promise<void> {
    await expect(this.getByTestId(testId)).not.toBeVisible({ timeout });
  }

  /** 安全点击 - 自动等待元素可见并可交互 */
  async safeClick(testId: string, timeout = 10_000): Promise<void> {
    await this.getByTestId(testId).click({ timeout });
  }

  /** 安全填充 - 自动等待输入框可见并清空后填入 */
  async safeFill(testId: string, value: string, timeout = 10_000): Promise<void> {
    await this.getByTestId(testId).fill(value, { timeout });
  }

  /** 安全选择下拉选项 */
  async safeSelect(testId: string, value: string, timeout = 10_000): Promise<void> {
    await this.getByTestId(testId).selectOption(value, { timeout });
  }

  /** 执行 E2E action 并等待结果 */
  async evaluateAction<T>(expression: string): Promise<T> {
    return this.page.evaluate(expression) as Promise<T>;
  }

  /** 轮询等待 E2E action 返回非空值 */
  async pollAction<T>(fn: () => Promise<T>, options?: { timeout?: number }): Promise<void> {
    await expect
      .poll(async () => fn(), {
        timeout: options?.timeout ?? 15_000
      })
      .toBeTruthy();
  }

  /** 拖拽元素偏移 */
  async dragBy(locator: Locator, deltaX: number, deltaY = 0, steps = 6): Promise<void> {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + deltaX, startY + deltaY, { steps });
    await this.page.mouse.up();
  }
}
