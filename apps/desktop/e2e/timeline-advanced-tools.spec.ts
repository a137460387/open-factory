import { test, expect } from './fixtures';
import type { TimelineSnapshot } from './pages/timeline.page';

test.describe('Timeline Advanced Editing Tools', () => {
  test('ripple delete removes clip and closes gap', async ({ timeline }) => {
    // Setup: 添加 3 个连续片段到时间线
    await test.step('setup clips', async () => {
      await timeline.goto();
      await timeline.addThreeConsecutiveClips();
    });

    const before = await timeline.getSnapshot();
    expect(before.tracks[0].clips).toHaveLength(3);

    // 选中第 2 个片段
    await timeline.selectClip(before.tracks[0].clips[1].id);

    // 执行波纹删除
    await timeline.rippleDeleteSelected();

    // 断言: 剩余 2 个片段，无间隙
    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips).toHaveLength(2);

    // 第 3 个片段应前移，紧接第 1 个片段之后
    const clip1 = after.tracks[0].clips[0];
    const clip2 = after.tracks[0].clips[1];
    expect(clip2.start).toBeCloseTo(clip1.start + clip1.duration, 2);
  });

  test('regular delete preserves gap', async ({ timeline }) => {
    await test.step('setup clips', async () => {
      await timeline.goto();
      await timeline.addThreeConsecutiveClips();
    });

    const before = await timeline.getSnapshot();
    await timeline.selectClip(before.tracks[0].clips[1].id);

    // 执行普通删除
    await timeline.deleteSelected();

    // 断言: 剩余 2 个片段，第 3 个位置不变（有间隙）
    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips).toHaveLength(2);
    expect(after.tracks[0].clips[1].start).toBe(before.tracks[0].clips[2].start);
  });

  test('context menu ripple delete works', async ({ timeline }) => {
    await test.step('setup clips', async () => {
      await timeline.goto();
      await timeline.addThreeConsecutiveClips();
    });

    const before = await timeline.getSnapshot();
    const clipId = before.tracks[0].clips[1].id;

    // 右键点击片段
    const clip = timeline.getClip(clipId);
    await expect(clip).toBeVisible();
    await clip.click({ button: 'right' });

    // 等待上下文菜单出现并点击波纹删除菜单项
    const rippleDeleteBtn = timeline.page.getByTestId('clip-action-ripple-delete');
    await expect(rippleDeleteBtn).toBeVisible();
    await rippleDeleteBtn.click();

    // 断言: 片段已删除且无间隙
    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips).toHaveLength(2);
    const clip1 = after.tracks[0].clips[0];
    const clip2 = after.tracks[0].clips[1];
    expect(clip2.start).toBeCloseTo(clip1.start + clip1.duration, 2);
  });

  test('editing mode indicator shows on hold S key', async ({ timeline }) => {
    await test.step('setup clips', async () => {
      await timeline.goto();
      await timeline.addThreeConsecutiveClips();
    });

    // 确保时间线有焦点
    await timeline.focus();

    // 按住 S 键
    await timeline.page.keyboard.down('s');

    // 断言: 指示器出现
    const indicator = timeline.page.getByTestId('editing-mode-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('滑移');

    // 释放 S 键
    await timeline.page.keyboard.up('s');

    // 断言: 指示器消失
    await expect(indicator).not.toBeVisible();
  });
});
