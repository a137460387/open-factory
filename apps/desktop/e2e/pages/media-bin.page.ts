import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * 媒体库页面对象 - 封装媒体导入、文件夹管理等操作
 */
export class MediaBinPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** 导入媒体素材 */
  async importMedia(): Promise<void> {
    await this.safeClick('import-media-button');
  }

  /** 获取媒体卡片数量 */
  async getCardCount(): Promise<number> {
    return this.getByTestIdPrefix('media-card-').count();
  }

  /** 等待指定数量的媒体卡片出现 */
  async expectCardCount(count: number, timeout = 10_000): Promise<void> {
    await expect(this.getByTestIdPrefix('media-card-')).toHaveCount(count, { timeout });
  }

  /** 获取第 N 个媒体卡片 */
  getCardByIndex(index: number): Locator {
    return this.getByTestIdPrefix('media-card-').nth(index);
  }

  /** 通过 assetId 获取媒体卡片 */
  getCardById(assetId: string): Locator {
    return this.getByTestId(`media-card-${assetId}`);
  }

  /** 将第 N 个媒体卡片添加到时间线 */
  async addToTimeline(index = 0): Promise<void> {
    await this.getByTestIdPrefix('media-card-')
      .nth(index)
      .locator('[data-testid^="add-to-timeline-"]')
      .click();
  }

  /** 创建新文件夹 */
  async createFolder(): Promise<void> {
    await this.safeClick('media-folder-create-button');
  }

  /** 搜索媒体 */
  async search(keyword: string): Promise<void> {
    await this.safeFill('media-search-input', keyword);
  }

  /** 切换到列表视图 */
  async switchToListView(): Promise<void> {
    await this.safeClick('media-list-view');
  }

  /** 切换到卡片视图 */
  async switchToCardView(): Promise<void> {
    // 默认就是卡片视图，这里作为显式切换的接口
    await this.safeClick('media-view-list');
  }

  /** 检查是否有缺失媒体标记 */
  async hasMissingMedia(): Promise<boolean> {
    const count = await this.page.locator('[data-testid^="media-card-"][data-missing="true"]').count();
    return count > 0;
  }

  /** 等待媒体卡片出现 */
  async waitForCards(timeout = 10_000): Promise<void> {
    await expect(this.getByTestIdPrefix('media-card-').first()).toBeVisible({ timeout });
  }
}
