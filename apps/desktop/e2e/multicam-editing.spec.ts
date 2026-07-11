import { expect, test } from '@playwright/test';
import { MulticamEditorPage } from './pages/multicam-editor.page';

test.describe('多机位剪辑', () => {
  let multicam: MulticamEditorPage;

  test.beforeEach(async ({ page }) => {
    multicam = new MulticamEditorPage(page);
    await multicam.goto();
  });

  // -----------------------------------------------------------------------
  // 1. 导入多机位素材并创建多机位序列
  // -----------------------------------------------------------------------

  test('应该能从多个视频片段创建多机位序列', async ({ page }) => {
    // 1. 加载多机位基础夹具（两个机位的视频片段，已选中）
    await multicam.setupMulticamFixture();

    // 2. 验证创建多机位序列按钮可用
    await expect(multicam.getByTestId('toolbar-create-multicam-button')).toBeEnabled();

    // 3. 点击创建多机位序列
    await multicam.createMulticamSequence();

    // 4. 验证多机位预览网格出现（说明多机位序列创建成功）
    await multicam.waitForPreviewGrid();

    // 5. 验证有两个机位按钮
    const angleButtons = page.locator('[data-testid^="multicam-angle-button-"]');
    await expect(angleButtons).toHaveCount(2);
  });

  // -----------------------------------------------------------------------
  // 2. 机位切换
  // -----------------------------------------------------------------------

  test('应该能通过点击按钮切换机位', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具（三个机位的嵌套序列）
    await multicam.setupMulticamAiCutFixture();

    // 2. 验证多机位预览网格可见
    await multicam.waitForPreviewGrid();

    // 3. 记录初始切换点数量
    const initialSwitchCount = await multicam.getSwitchCount();

    // 4. 点击第二个机位按钮
    await multicam.clickAngle('angle-b');

    // 5. 验证切换点数量增加
    await multicam.pollSwitchCount((count) => count > initialSwitchCount);
  });

  test('应该能通过键盘快捷键切换机位', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具
    await multicam.setupMulticamAiCutFixture();

    // 2. 验证多机位预览网格可见
    await multicam.waitForPreviewGrid();

    // 3. 记录初始切换点数量
    const initialSwitchCount = await multicam.getSwitchCount();

    // 4. 按数字键 2 切换到第二个机位
    await page.keyboard.press('2');

    // 5. 验证切换点数量增加
    await multicam.pollSwitchCount((count) => count > initialSwitchCount);
  });

  test('应该能切换实时模式', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具
    await multicam.setupMulticamAiCutFixture();

    // 2. 验证多机位预览网格可见
    await multicam.waitForPreviewGrid();

    // 3. 验证初始状态为非实时模式
    expect(await multicam.isLiveModeActive()).toBe(false);

    // 4. 切换实时模式
    await multicam.toggleLiveMode();

    // 5. 验证实时模式已激活
    expect(await multicam.isLiveModeActive()).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 3. 多机位片段编辑（切换点编辑）
  // -----------------------------------------------------------------------

  test('应该能添加和删除切换点', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具并进入编辑模式
    await multicam.setupMulticamAiCutFixture();
    await multicam.enterMulticamEditMode('clip-mc-nested');

    // 2. 等待角度切换面板可见
    await multicam.waitForAngleSwitcherPanel();

    // 3. 记录初始切换点数量
    const initialCount = await multicam.getSwitchPointCount();

    // 4. 添加一个切换点
    await multicam.addSwitchPoint();

    // 5. 验证切换点数量增加
    await multicam.expectSwitchPointCount(initialCount + 1);

    // 6. 删除刚添加的切换点
    await multicam.deleteSwitchPoint(initialCount);

    // 7. 验证切换点数量恢复
    await multicam.expectSwitchPointCount(initialCount);
  });

  test('应该能执行音频同步', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具并进入编辑模式
    await multicam.setupMulticamAiCutFixture();
    await multicam.enterMulticamEditMode('clip-mc-nested');

    // 2. 等待同步控制区域可见
    await expect(multicam.syncControls).toBeVisible();

    // 3. 选择音频同步模式
    await multicam.selectSyncMode('audio');

    // 4. 点击同步按钮
    await multicam.clickSync();

    // 5. 等待同步完成
    await multicam.waitForSyncComplete();
  });

  // -----------------------------------------------------------------------
  // 4. 撤销/重做
  // -----------------------------------------------------------------------

  test('应该支持撤销和重做机位切换', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具并进入编辑模式
    await multicam.setupMulticamAiCutFixture();
    await multicam.enterMulticamEditMode('clip-mc-nested');

    // 2. 等待角度切换面板可见
    await multicam.waitForAngleSwitcherPanel();

    // 3. 记录初始切换点数量
    const initialSwitchCount = await multicam.getSwitchCount();

    // 4. 添加一个切换点
    await multicam.addSwitchPoint();

    // 5. 验证切换点数量增加
    await multicam.pollSwitchCount((count) => count > initialSwitchCount);

    // 6. 撤销
    await multicam.undo();

    // 7. 验证切换点数量恢复
    await multicam.pollSwitchCount((count) => count === initialSwitchCount);

    // 8. 重做
    await multicam.redo();

    // 9. 验证切换点数量再次增加
    await multicam.pollSwitchCount((count) => count > initialSwitchCount);
  });

  test('应该支持撤销和重做角度切换', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具
    await multicam.setupMulticamAiCutFixture();

    // 2. 验证多机位预览网格可见
    await multicam.waitForPreviewGrid();

    // 3. 记录初始切换点数量
    const initialSwitchCount = await multicam.getSwitchCount();

    // 4. 点击第二个机位按钮
    await multicam.clickAngle('angle-b');

    // 5. 验证切换点数量增加
    await multicam.pollSwitchCount((count) => count > initialSwitchCount);

    // 6. 撤销
    await multicam.undo();

    // 7. 验证切换点数量恢复
    await multicam.pollSwitchCount((count) => count === initialSwitchCount);
  });

  // -----------------------------------------------------------------------
  // 5. 检测时钟漂移
  // -----------------------------------------------------------------------

  test('应该能检测时钟漂移', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具并进入编辑模式
    await multicam.setupMulticamAiCutFixture();
    await multicam.enterMulticamEditMode('clip-mc-nested');

    // 2. 等待漂移检测按钮可见
    await expect(multicam.driftDetectionButton).toBeVisible();

    // 3. 点击漂移检测按钮
    await multicam.clickDriftDetection();

    // 4. 等待检测结果出现
    await multicam.waitForDriftResult();

    // 5. 验证结果包含有效信息
    const message = await multicam.getDriftMessageText();
    expect(message.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 6. 综合场景
  // -----------------------------------------------------------------------

  test('应该能完整执行多机位编辑工作流', async ({ page }) => {
    // 1. 加载多机位 AI 剪辑夹具并进入编辑模式
    await multicam.setupMulticamAiCutFixture();
    await multicam.enterMulticamEditMode('clip-mc-nested');

    // 2. 等待角度切换面板可见
    await multicam.waitForAngleSwitcherPanel();

    // 3. 记录初始状态
    const initialState = await multicam.getMulticamClipState();
    expect(initialState).toBeDefined();
    expect(initialState!.angleCount).toBe(3);

    // 4. 通过预览网格切换机位
    await multicam.clickAngle('angle-b');
    await multicam.pollSwitchCount(
      (count) => count > (initialState?.switchCount ?? 0)
    );

    // 5. 添加切换点
    const switchCountBefore = await multicam.getSwitchPointCount();
    await multicam.addSwitchPoint();
    await multicam.expectSwitchPointCount(switchCountBefore + 1);

    // 6. 撤销切换点添加
    await multicam.undo();
    await multicam.expectSwitchPointCount(switchCountBefore);

    // 7. 检测漂移
    await multicam.clickDriftDetection();
    await multicam.waitForDriftResult();
    const driftText = await multicam.getDriftMessageText();
    expect(driftText.length).toBeGreaterThan(0);
  });
});
