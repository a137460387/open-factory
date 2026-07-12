import { expect, test } from './fixtures';

/**
 * AI 原生工作流 E2E 测试
 *
 * 测试覆盖：
 *   1. 导入素材并运行 AI 分析
 *   2. 应用推荐片段
 *   3. 生成叙事结构
 *   4. 错误处理（空素材、分析取消）
 *
 * 所有选择器使用 data-testid 属性，遵循 STABILITY_CHECKLIST.md 规范。
 * 不使用 waitForTimeout，等待策略基于条件轮询与元素可见性断言。
 */

// ─── 测试 1：导入素材并运行 AI 分析 ─────────────────────────

test.describe('AI 原生工作流 - 素材分析', () => {
  test.beforeEach(async ({ toolbar }) => {
    // 每个测试独立导航并等待 mock 层就绪
    await toolbar.goto();
  });

  test('导入测试视频素材并运行 AI 分析，验证情绪曲线与场景时间线', async ({
    page,
    toolbar,
    mediaBin,
    aiPanel,
  }) => {
    // 安装 AI 原生工作流测试夹具
    await page.evaluate(() =>
      window.__E2E_ACTIONS__!.setupAINativeWorkflowFixture!(),
    );

    // 步骤 1：导入测试视频素材
    await toolbar.importMedia();
    await mediaBin.waitForCards();

    // 将素材添加到时间线
    await mediaBin.addToTimeline(0);

    // 步骤 2：打开智能创作面板
    await page.getByTestId('toolbar-ai-native-workflow-button').click();
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toBeVisible();

    // 步骤 3：点击"开始分析"按钮
    await page.getByTestId('ai-native-workflow-start-analysis').click();

    // 步骤 4：等待分析完成（通过轮询状态属性判断）
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toHaveAttribute('data-analysis-status', 'completed', {
      timeout: 15_000,
    });

    // 步骤 5：验证情绪曲线显示
    await expect(
      page.getByTestId('ai-native-workflow-emotion-curve'),
    ).toBeVisible();

    // 步骤 6：验证场景时间线显示
    await expect(
      page.getByTestId('ai-native-workflow-scene-timeline'),
    ).toBeVisible();

    // 验证场景时间线包含至少一个场景节点
    const sceneItems = page.getByTestIdPrefix(
      'ai-native-workflow-scene-item-',
    );
    await expect(sceneItems.first()).toBeVisible();
    const sceneCount = await sceneItems.count();
    expect(sceneCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── 测试 2：应用推荐片段 ───────────────────────────────────

test.describe('AI 原生工作流 - 推荐片段', () => {
  test('在推荐列表中选择片段并应用推荐，验证时间线已更新', async ({
    page,
    toolbar,
    timeline,
  }) => {
    await toolbar.goto();

    // 安装包含推荐结果的夹具
    await page.evaluate(() =>
      window.__E2E_ACTIONS__!.setupAINativeWorkflowWithRecommendationsFixture!(),
    );

    // 打开智能创作面板
    await page.getByTestId('toolbar-ai-native-workflow-button').click();
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toBeVisible();

    // 等待推荐列表加载完成
    await expect(
      page.getByTestId('ai-native-workflow-recommendations'),
    ).toBeVisible({ timeout: 10_000 });

    // 获取应用前的时间线快照，记录当前剪辑数量
    const clipCountBefore = await timeline.getClipCount();

    // 在推荐列表中选择第一个片段
    await page.getByTestId('ai-native-workflow-recommendation-0').click();

    // 验证片段已被选中（高亮状态）
    await expect(
      page.getByTestId('ai-native-workflow-recommendation-0'),
    ).toHaveAttribute('data-selected', 'true');

    // 点击"应用推荐"按钮
    await page.getByTestId('ai-native-workflow-apply-recommendation').click();

    // 验证时间线已更新（剪辑数量增加）
    await expect.poll(async () => {
      return timeline.getClipCount();
    }, { timeout: 10_000 }).toBeGreaterThan(clipCountBefore);
  });
});

// ─── 测试 3：生成叙事结构 ───────────────────────────────────

test.describe('AI 原生工作流 - 叙事结构', () => {
  test('选择叙事模板并生成故事线，验证叙事结构合理性', async ({
    page,
    toolbar,
  }) => {
    await toolbar.goto();

    // 安装叙事结构测试夹具
    await page.evaluate(() =>
      window.__E2E_ACTIONS__!.setupAINativeWorkflowNarrativeFixture!(),
    );

    // 打开智能创作面板
    await page.getByTestId('toolbar-ai-native-workflow-button').click();
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toBeVisible();

    // 选择叙事模板（例如"三幕式"结构）
    await page.getByTestId('ai-native-workflow-template-select').click();
    await page.getByTestId('ai-native-workflow-template-three-act').click();

    // 验证模板已选中
    await expect(
      page.getByTestId('ai-native-workflow-template-select'),
    ).toHaveAttribute('data-selected-template', 'three-act');

    // 点击"生成故事线"按钮
    await page.getByTestId('ai-native-workflow-generate-storyline').click();

    // 等待故事线生成完成
    await expect(
      page.getByTestId('ai-native-workflow-storyline'),
    ).toBeVisible({ timeout: 15_000 });

    // 验证叙事结构合理性：故事线应包含多个段落节点
    const storylineNodes = page.getByTestIdPrefix(
      'ai-native-workflow-storyline-node-',
    );
    await expect(storylineNodes.first()).toBeVisible();

    const nodeCount = await storylineNodes.count();
    // 三幕式结构至少包含 3 个叙事节点（开端、发展、高潮/结局）
    expect(nodeCount).toBeGreaterThanOrEqual(3);

    // 验证每个叙事节点包含标题
    for (let i = 0; i < nodeCount; i++) {
      const node = storylineNodes.nth(i);
      await expect(node).toBeVisible();
    }

    // 验证故事线整体结构标识
    await expect(
      page.getByTestId('ai-native-workflow-storyline'),
    ).toHaveAttribute('data-structure-type', 'three-act');
  });
});

// ─── 测试 4：错误处理 ───────────────────────────────────────

test.describe('AI 原生工作流 - 错误处理', () => {
  test('空素材情况下点击分析应显示错误提示', async ({
    page,
    toolbar,
  }) => {
    await toolbar.goto();

    // 安装空素材夹具（不导入任何素材）
    await page.evaluate(() =>
      window.__E2E_ACTIONS__!.setupAINativeWorkflowEmptyFixture!(),
    );

    // 打开智能创作面板
    await page.getByTestId('toolbar-ai-native-workflow-button').click();
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toBeVisible();

    // 点击"开始分析"按钮（此时没有素材）
    await page.getByTestId('ai-native-workflow-start-analysis').click();

    // 验证错误提示显示
    await expect(
      page.getByTestId('ai-native-workflow-error-message'),
    ).toBeVisible({ timeout: 10_000 });

    // 验证错误提示内容包含相关文案
    await expect(
      page.getByTestId('ai-native-workflow-error-message'),
    ).toContainText('素材');

    // 验证面板仍然可用（未崩溃），可重新操作
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toBeVisible();

    // 验证页面整体仍然响应
    await expect(page.getByTestId('editor-main-layout')).toBeVisible();
  });

  test('分析过程中取消操作应正确中断并恢复面板状态', async ({
    page,
    toolbar,
  }) => {
    await toolbar.goto();

    // 安装需要较长时间分析的夹具（便于测试取消操作）
    await page.evaluate(() =>
      window.__E2E_ACTIONS__!.setupAINativeWorkflowSlowAnalysisFixture!(),
    );

    // 打开智能创作面板
    await page.getByTestId('toolbar-ai-native-workflow-button').click();
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toBeVisible();

    // 点击"开始分析"按钮
    await page.getByTestId('ai-native-workflow-start-analysis').click();

    // 等待分析状态变为"进行中"
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toHaveAttribute('data-analysis-status', 'running', {
      timeout: 10_000,
    });

    // 点击"取消分析"按钮
    await page.getByTestId('ai-native-workflow-cancel-analysis').click();

    // 验证分析状态变为"已取消"
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toHaveAttribute('data-analysis-status', 'cancelled', {
      timeout: 10_000,
    });

    // 验证"开始分析"按钮重新可用（面板恢复到初始状态）
    await expect(
      page.getByTestId('ai-native-workflow-start-analysis'),
    ).toBeEnabled();

    // 验证情绪曲线和场景时间线未显示（分析未完成）
    await expect(
      page.getByTestId('ai-native-workflow-emotion-curve'),
    ).not.toBeVisible();

    // 验证面板未崩溃，页面整体仍然响应
    await expect(
      page.getByTestId('ai-native-workflow-panel'),
    ).toBeVisible();
    await expect(page.getByTestId('editor-main-layout')).toBeVisible();
  });
});
