# 时间线高级编辑工具 UX 增强 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐现有高级编辑工具（波纹删除、滑移、滑行、滚动修剪）的 UX 缺口，使这些已实现的功能真正可用。

**Architecture:** 所有核心算法和 Command 已完整实现。本计划仅修改 UI 层：修复快捷键冲突、添加工具栏模式指示器、光标反馈、右键菜单增强、工具栏按钮、E2E 测试。不修改 `packages/editor-core` 中的任何算法或 Command。

**Tech Stack:** React + TypeScript + Tailwind CSS + Lucide React + Playwright E2E

## Global Constraints

- 中文本地化：所有用户可见文本使用 `zhCN` 对象中的键值
- 命令模式：所有时间线修改操作通过 `commandManager.execute(new XxxCommand(...))` 执行
- `data-testid`：所有新增交互元素必须有 `data-testid` 属性
- Tauri 桥接：不涉及 Tauri 后端，纯前端改动
- 不修改 `packages/editor-core` 中的算法或 Command 实现

---

### Task 1: 修复 S 键冲突

**Files:**
- Modify: `apps/desktop/src/shortcuts/timeline-shortcuts.ts:62`

**Interfaces:**
- Produces: `split-selected` 默认绑定从 `['T', 'S']` 改为 `['T']`

- [ ] **Step 1: 修改 split-selected 默认绑定**

在 `timeline-shortcuts.ts` 中找到 `split-selected` 的定义行：

```typescript
// 修改前:
{ action: 'split-selected', defaultBindings: ['T', 'S'] },

// 修改后:
{ action: 'split-selected', defaultBindings: ['T'] },
```

- [ ] **Step 2: 运行快捷键单元测试**

Run: `pnpm test -- --run apps/desktop/src/shortcuts/timeline-shortcuts.test.ts`
Expected: 所有测试通过

- [ ] **Step 3: 运行全量单元测试确认无回归**

Run: `pnpm test -- --run`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/shortcuts/timeline-shortcuts.ts
git commit -m "fix: remove S key from split-selected default binding to resolve slip mode conflict"
```

---

### Task 2: 添加 i18n 字符串

**Files:**
- Modify: `apps/desktop/src/i18n/strings.ts`

**Interfaces:**
- Produces: 新增 `zhCN.timeline.rippleDeleteClip`、`zhCN.timeline.slipMode`、`zhCN.timeline.slideMode`、`zhCN.timeline.rollingTrimMode` 键值

- [ ] **Step 1: 在中文部分添加新字符串**

在 `strings.ts` 的 `timeline` 对象中（约行 2426 附近，`deleteSelectedClip` 之后）添加：

```typescript
rippleDeleteClip: '波纹删除',
slipMode: '滑移',
slideMode: '滑行',
rollingTrimMode: '滚动修剪',
```

- [ ] **Step 2: 在英文部分添加对应字符串**

在英文 `timeline` 对象中（约行 6400+ 附近）添加：

```typescript
rippleDeleteClip: 'Ripple Delete',
slipMode: 'Slip',
slideMode: 'Slide',
rollingTrimMode: 'Rolling Trim',
```

- [ ] **Step 3: 运行类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/i18n/strings.ts
git commit -m "feat(i18n): add strings for ripple delete and editing mode indicators"
```

---

### Task 3: 工具栏模式指示器

**Files:**
- Modify: `apps/desktop/src/components/Timeline/Timeline.tsx` (工具栏区域，约行 3056 zoom slider 之前)

**Interfaces:**
- Consumes: `rollingTrimActive`, `slipEditActive`, `slideEditActive` (已有的 useState)
- Consumes: `zhCN.timeline.slipMode`, `zhCN.timeline.slideMode`, `zhCN.timeline.rollingTrimMode`
- Produces: 工具栏中显示当前编辑模式的 pill 指示器

- [ ] **Step 1: 导入新图标**

在 Timeline.tsx 的 lucide-react import 中添加 `ArrowLeftRight`、`MoveHorizontal` 图标（`Scissors` 已导入）：

```typescript
import { ..., ArrowLeftRight, MoveHorizontal } from 'lucide-react';
```

- [ ] **Step 2: 在工具栏 zoom slider 之前添加模式指示器**

在 Timeline.tsx 工具栏区域（约行 3056，zoom slider `<input>` 之前）插入：

```tsx
{(slipEditActive || slideEditActive || rollingTrimActive) && (
  <div
    className="flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand"
    data-testid="editing-mode-indicator"
  >
    {rollingTrimActive ? (
      <>
        <Scissors size={14} />
        <span>{zhCN.timeline.rollingTrimMode}</span>
      </>
    ) : slipEditActive ? (
      <>
        <ArrowLeftRight size={14} />
        <span>{zhCN.timeline.slipMode}</span>
      </>
    ) : (
      <>
        <MoveHorizontal size={14} />
        <span>{zhCN.timeline.slideMode}</span>
      </>
    )}
  </div>
)}
```

- [ ] **Step 3: 运行类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/Timeline/Timeline.tsx
git commit -m "feat: add editing mode indicator to timeline toolbar"
```

---

### Task 4: ClipBlock 光标样式

**Files:**
- Modify: `apps/desktop/src/components/Timeline/TimelineParts.tsx` (ClipBlock 外层 div className，约行 1017-1027)

**Interfaces:**
- Consumes: `data-editing-mode` 属性（已设置在 Timeline 根元素上，Timeline.tsx 行 2875）
- Produces: ClipBlock 根据父元素 `data-editing-mode` 改变光标样式

- [ ] **Step 1: 修改 ClipBlock className 添加条件光标**

在 `TimelineParts.tsx` 的 ClipBlock 外层 `<div>` 的 className 中（约行 1024，`locked ? 'cursor-not-allowed' : 'cursor-grab'` 处）修改为：

```tsx
locked
  ? 'cursor-not-allowed'
  : 'cursor-grab group-data-[editing-mode=slip]:cursor-ew-resize group-data-[editing-mode=slide]:cursor-grab group-data-[editing-mode=rolling-trim]:cursor-col-resize',
```

注意：`data-editing-mode` 设置在 Timeline 根元素上，ClipBlock 是其后代。需要确认 Tailwind 的 `group-data-*` 变体能否穿透多层 DOM。如果不能，则改用内联条件：

```tsx
locked
  ? 'cursor-not-allowed'
  : slipEditActive
    ? 'cursor-ew-resize'
    : slideEditActive
      ? 'cursor-grab'
      : rollingTrimActive
        ? 'cursor-col-resize'
        : 'cursor-grab',
```

这需要将 `slipEditActive`、`slideEditActive`、`rollingTrimActive` 作为 props 传入 ClipBlock（已在 props 中声明，行 991-993）。

- [ ] **Step 2: 确认裁剪手柄光标不受影响**

检查 ClipBlock 中左/右裁剪手柄的 className（约行 1209 和 1336），确认它们有自己的 cursor 类（如 `cursor-col-resize`），不被外层覆盖。如果手柄使用 `cursor-col-resize`，则无需修改。

- [ ] **Step 3: 运行类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/Timeline/TimelineParts.tsx
git commit -m "feat: add cursor style feedback for editing modes on clip blocks"
```

---

### Task 5: 右键菜单增加删除选项

**Files:**
- Modify: `apps/desktop/src/components/Timeline/Timeline.tsx` (ClipActionMenu 组件，约行 4937-5215)

**Interfaces:**
- Consumes: `deleteSelected`, `rippleDeleteSelected` 函数（Timeline.tsx 局部函数）
- Consumes: `zhCN.timeline.deleteSelectedClip`, `zhCN.timeline.rippleDeleteClip`
- Produces: ClipActionMenu 中新增"删除片段"和"波纹删除"菜单项

- [ ] **Step 1: 给 ClipActionMenu 添加 onDelete 和 onRippleDelete 回调 props**

在 `ClipActionMenu` 的 props 类型定义中添加：

```typescript
onDelete(): void;
onRippleDelete(): void;
```

- [ ] **Step 2: 在 ClipActionMenu 渲染中添加删除菜单项**

在分隔线（`<div className="my-1 border-t border-line" />`，约行 5142 "创建分组" 之前）之后、"创建分组"按钮之前插入：

```tsx
<button
  className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
  type="button"
  data-testid="clip-action-delete"
  onClick={onDelete}
>
  {zhCN.timeline.deleteSelectedClip}
</button>
<button
  className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
  type="button"
  data-testid="clip-action-ripple-delete"
  onClick={onRippleDelete}
>
  {zhCN.timeline.rippleDeleteClip}
</button>
<div className="my-1 border-t border-line" />
```

- [ ] **Step 3: 在 ClipActionMenu 调用处传入新 props**

在 Timeline.tsx 中 ClipActionMenu 的调用处（约行 3348）添加：

```tsx
onDelete={() => { deleteSelected(); setClipMenu(undefined); }}
onRippleDelete={() => { rippleDeleteSelected(); setClipMenu(undefined); }}
```

注意：需要确保 `rippleDeleteSelected` 函数在 Timeline.tsx 中存在。当前 Timeline.tsx 只有 `deleteSelected`，没有 `rippleDeleteSelected`。需要添加：

```typescript
function rippleDeleteSelected(): void {
  if (selectedClipIds.length === 0) return;
  commandManager.execute(new RippleDeleteCommand(timelineAccessor, selectedClipIds, project.protectedRanges));
  clearSelectedClipIds();
}
```

确保 `RippleDeleteCommand` 已导入（检查现有 import 语句）。

- [ ] **Step 4: 运行类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/Timeline/Timeline.tsx
git commit -m "feat: add delete and ripple delete options to clip context menu"
```

---

### Task 6: 波纹删除工具栏按钮

**Files:**
- Modify: `apps/desktop/src/components/Timeline/Timeline.tsx` (工具栏区域，约行 3053-3055)

**Interfaces:**
- Consumes: `rippleDeleteSelected` 函数（Task 5 中添加）
- Consumes: `zhCN.timeline.rippleDeleteClip`
- Produces: 工具栏中新增波纹删除按钮

- [ ] **Step 1: 导入 Eraser 图标**

在 Timeline.tsx 的 lucide-react import 中添加 `Eraser`：

```typescript
import { ..., Eraser } from 'lucide-react';
```

- [ ] **Step 2: 在 Trash2 按钮之后添加波纹删除按钮**

在现有删除按钮（约行 3053-3055）之后插入：

```tsx
<button
  className="rounded-md border border-line p-2 hover:bg-panel"
  title={`${zhCN.timeline.rippleDeleteClip} (Shift+Delete)`}
  data-testid="ripple-delete-button"
  onClick={rippleDeleteSelected}
>
  <Eraser size={16} />
</button>
```

- [ ] **Step 3: 运行类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/Timeline/Timeline.tsx
git commit -m "feat: add ripple delete button to timeline toolbar"
```

---

### Task 7: E2E 测试

**Files:**
- Create: `apps/desktop/e2e/timeline-advanced-tools.spec.ts`

**Interfaces:**
- Consumes: `TimelinePage` POM（已有 `rippleDeleteSelected()`, `waitForEditingMode()`, `getSnapshot()`, `selectClip()` 等方法）
- Consumes: `fixtures` 中的 `timeline` fixture

- [ ] **Step 1: 创建 E2E 测试文件**

创建 `apps/desktop/e2e/timeline-advanced-tools.spec.ts`：

```typescript
import { test, expect } from './fixtures';

test.describe('Timeline Advanced Editing Tools', () => {
  test('ripple delete removes clip and closes gap', async ({ timeline }) => {
    // Setup: 添加 3 个连续片段到时间线
    await test.step('setup clips', async () => {
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
      await timeline.addThreeConsecutiveClips();
    });

    const before = await timeline.getSnapshot();
    const clipId = before.tracks[0].clips[1].id;

    // 右键点击片段
    const clip = timeline.getClip(clipId);
    await clip.click({ button: 'right' });

    // 点击波纹删除菜单项
    const rippleDeleteBtn = timeline.page.getByTestId('clip-action-ripple-delete');
    await rippleDeleteBtn.click();

    // 断言: 片段已删除且无间隙
    const after = await timeline.getSnapshot();
    expect(after.tracks[0].clips).toHaveLength(2);
  });

  test('editing mode indicator shows on hold S key', async ({ timeline }) => {
    await test.step('setup clips', async () => {
      await timeline.addThreeConsecutiveClips();
    });

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
```

注意：`addThreeConsecutiveClips` 方法需要在 `TimelinePage` 中添加（如果尚不存在）。如果 `TimelinePage` 没有此辅助方法，需要先添加它，或使用已有的 `addMediaCardToTimeline` 等辅助函数。

- [ ] **Step 2: 检查 TimelinePage 是否有 addThreeConsecutiveClips 辅助方法**

如果不存在，在 `timeline.page.ts` 中添加：

```typescript
async addThreeConsecutiveClips(): Promise<void> {
  // 使用 __E2E_ACTIONS__ 添加测试片段
  await this.page.evaluate(() => {
    window.__E2E_ACTIONS__!.addTestClips!(3);
  });
  await this.waitForClips();
}
```

如果 `__E2E_ACTIONS__` 没有 `addTestClips` 方法，则需要使用已有的 mock 素材 + 拖拽方式创建片段。

- [ ] **Step 3: 运行 E2E 测试**

Run: `pnpm test:e2e --grep "timeline-advanced-tools"`
Expected: 所有 4 个测试通过

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/e2e/timeline-advanced-tools.spec.ts
git commit -m "test(e2e): add tests for timeline advanced editing tools"
```

---

### Task 8: 最终验证与提交

- [ ] **Step 1: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 2: 运行 lint**

Run: `pnpm lint`
Expected: 无错误

- [ ] **Step 3: 运行全量单元测试**

Run: `pnpm test -- --run`
Expected: 所有测试通过

- [ ] **Step 4: 运行 E2E 测试**

Run: `pnpm test:e2e --grep "timeline-advanced-tools"`
Expected: 所有测试通过

- [ ] **Step 5: 创建功能分支并推送**

```bash
git checkout -b feat/timeline-advanced-tools
git push -u origin feat/timeline-advanced-tools
```

- [ ] **Step 6: 创建 PR**

```bash
gh pr create --title "feat: Add advanced timeline editing tools UX enhancements" --body "补齐时间线高级编辑工具的 UX 缺口：修复 S 键冲突、添加工具栏模式指示器、光标反馈、右键菜单删除选项、波纹删除按钮、E2E 测试。"
```

- [ ] **Step 7: 等待 CI 通过并合并**

```bash
gh pr checks --watch
gh pr merge --squash --delete-branch --admin
```
