import { test, expect } from './fixtures';

/**
 * 时间线专业操作 E2E：ripple delete（组感知）、rolling trim、组守卫、Alt+G 闭合间隙、锁轨拒绝
 * fixture：setupTimelineAdvancedFixture（a/b/c 三片段，a+b 成组，trimEnd 各留 6s）
 */
test.describe('Timeline Advanced Operations', () => {
  test('ripple delete shifts later clips by the removed duration and keeps existing gaps', async ({ timeline }) => {
    await timeline.goto();
    await timeline.setupTimelineAdvancedFixture();

    const before = await timeline.getSnapshot();
    expect(before.tracks[0].clips).toHaveLength(3);

    // 桌面实测语义：点击组成员 b 会扩展选区到整组（a+b），ripple 删除整组
    await timeline.selectClip('clip-adv-b');
    await timeline.rippleDeleteSelected();

    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips).toHaveLength(1);
    // 基线差异锁定：c 左移被删区间总时长 4s（0→4→...，c 从 4 左移到 0）
    expect(after.tracks[0].clips[0].id).toBe('clip-adv-c');
    expect(after.tracks[0].clips[0].start).toBeCloseTo(0, 2);
  });

  test('ripple delete of the whole group removes all group members and the group badge', async ({ timeline }) => {
    await timeline.goto();
    await timeline.setupTimelineAdvancedFixture();

    // 点击 b → 选区扩展为整组（a+b）→ ripple 删除 a 与 b
    await timeline.selectClip('clip-adv-b');
    await timeline.rippleDeleteSelected();

    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-adv-c']);
    // c 上不应残留组标识
    const clipC = timeline.getClip('clip-adv-c');
    await expect(clipC).not.toHaveAttribute('data-clip-group-id', 'group-adv-1');
  });

  test('rolling trim adjusts adjacent boundary while preserving total duration', async ({ timeline }) => {
    await timeline.goto();
    await timeline.setupTimelineAdvancedFixture();

    // 按 R 进入 rolling 模式，拖拽 b 的右缘（b|c 边界）
    await timeline.focus();
    await timeline.page.keyboard.down('r');
    await timeline.dragTrimHandle('clip-adv-b', 'right', 30);
    await timeline.page.keyboard.up('r');

    const after = await timeline.getSnapshot();
    const [b, c] = after.tracks[0].clips;
    // 总时长不变
    expect(b.duration + c.duration).toBeCloseTo(4, 2);
  });

  test('rolling trim on a group boundary is rejected with a toast', async ({ timeline }) => {
    await timeline.goto();
    await timeline.setupTimelineAdvancedFixture();

    // b|c 边界：b 在组内、c 无组 → 组守卫拒绝（拖拽结束才执行命令，toast 出现且无变化）
    const before = await timeline.getSnapshot();

    await timeline.focus();
    await timeline.page.keyboard.down('r');
    await timeline.dragTrimHandle('clip-adv-b', 'right', 30);
    await timeline.page.keyboard.up('r');

    const toast = timeline.page.getByText('Rolling trim boundary is locked by a clip group');
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });

    const after = await timeline.getSnapshot();
    const [b] = after.tracks[0].clips;
    expect(b.duration).toBeCloseTo(before.tracks[0].clips[1].duration, 2);
  });

  test('Alt+G closes a single-frame gap at the playhead', async ({ timeline }) => {
    await timeline.goto();
    await timeline.setupTimelineAdvancedFixture();

    // 点 b（选区扩展为整组 a+b）普通删除：保留 0-4 的中段间隙（非 ripple）
    await timeline.selectClip('clip-adv-b');
    await timeline.deleteSelected();

    const withGap = await timeline.getSnapshot();
    expect(withGap.tracks[0].clips).toHaveLength(1);
    expect(withGap.tracks[0].clips[0].id).toBe('clip-adv-c');
    expect(withGap.tracks[0].clips[0].start).toBeCloseTo(4, 2);

    // playhead 置于 a|c 间隙内（0-4 区间），Alt+G 闭合：c 左移 4s
    await timeline.setPlayheadTime(2);
    await timeline.closeGapAtPlayhead();

    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips[0].start).toBeCloseTo(0, 2);
  });

  test('Alt+G on a group-split gap shows a toast and stops instead of closing other gaps', async ({ timeline }) => {
    await timeline.goto();
    await timeline.setupTimelineAdvancedGuardFixture();

    // 焦点需在时间线 scope 内快捷键才生效（fixture 未点击任何元素）
    await timeline.focus();

    // playhead=3 命中 gap (2,4)，组 [a,b] 横跨 → 守卫拒绝：toast + 不改任何片段
    await timeline.closeGapAtPlayhead();

    const toast = timeline.page.getByText('Closing this gap would split clip group "Guard Group"');
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });

    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['clip-guard-a', 0],
      ['clip-guard-b', 4],
    ]);
  });

  test('Alt+G is a silent no-op when no gap exists at the playhead', async ({ timeline }) => {
    await timeline.goto();
    await timeline.setupTimelineAdvancedFixture();

    const before = await timeline.getSnapshot();
    await timeline.setPlayheadTime(1); // a 内部，无间隙
    await timeline.closeGapAtPlayhead();

    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips).toHaveLength(3);
    expect(after.tracks[0].clips[0].duration).toBeCloseTo(before.tracks[0].clips[0].duration, 2);
  });

  test('locked track rejects ripple delete and gap close', async ({ timeline }) => {
    await timeline.goto();
    await timeline.setupTimelineAdvancedFixture();
    await timeline.lockFirstTrack();

    // ripple delete 拒绝（UI 层锁轨 pointer 事件被阻断 + Command 层断言兜底）
    await timeline.selectClip('clip-adv-b');
    await timeline.rippleDeleteSelected();
    let snapshot = await timeline.getSnapshot();
    expect(snapshot.tracks[0].clips).toHaveLength(3);

    // Alt+G 在锁轨上也应跳过（静默 no-op，转下一轨）
    snapshot = await timeline.getSnapshot();
    expect(snapshot.tracks[0].clips).toHaveLength(3);
  });
});
