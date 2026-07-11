# 时间线高级编辑工具 UX 增强设计文档

**日期**: 2026-07-11
**状态**: 已批准
**范围**: 补齐现有高级编辑工具的 UX 缺口，不修改核心算法

---

## 背景

项目已完成 AI 粗剪自动化功能，用户可一键生成大量初剪片段。后续核心痛点是对这些片段进行高效微调。

经过代码库探索发现，核心编辑命令（`RippleDeleteCommand`、`SlipClipCommand`、`SlideClipCommand`、`RollingTrimCommand`）及其底层算法已完整实现，hold-key 模式（S/D/R）也已存在。但存在以下 UX 缺口阻碍实际使用。

## 现有实现盘点

| 功能 | 实现状态 | 测试覆盖 |
|------|----------|----------|
| `RippleDeleteCommand` + `rippleDeleteTrackClips` | ✅ 完整 | 4 个测试用例 |
| `SlipClipCommand` + `buildSlipClip` | ✅ 完整 | 2 个测试用例 |
| `SlideClipCommand` + `buildSlideClipEdit` | ✅ 完整 | 3 个测试用例 |
| `RollingTrimCommand` + `buildRollingTrimClips` | ✅ 完整 | 3 个测试用例 |
| 按住 S/D/R 激活模式 | ✅ 完整 | 无 |
| `Delete`/`Backspace` → `deleteSelected` | ✅ 完整 | 无 |
| `Shift+Delete` → `rippleDeleteSelected` | ✅ 完整 | 无 |

## UX 缺口

1. **S 键冲突** — `split-selected` 默认绑定 `['T', 'S']`，与 slip 模式（按住 S）同时触发
2. **无视觉反馈** — `data-editing-mode` 属性已设置但 CSS 未消费，用户看不到当前模式
3. **右键菜单缺少删除选项** — `ClipActionMenu` 没有"删除"/"波纹删除"
4. **无波纹删除工具栏按钮** — 只有普通删除按钮（Trash2）
5. **无 E2E 测试** — 没有针对这些高级编辑工具的 E2E 测试

---

## 设计方案

### 1. 修复 S 键冲突

**改动文件**: `apps/desktop/src/shortcuts/timeline-shortcuts.ts`

将 `split-selected` 的默认绑定从 `['T', 'S']` 改为 `['T']`。

理由：
- `T` 是 Premiere Pro 的标准分割快捷键
- `S` 应专用于 slip 模式（按住激活），避免同时触发分割操作
- 用户仍可通过自定义快捷键将 `S` 重新绑定到 `split-selected`

### 2. 工具栏模式视觉指示器

**改动文件**:
- `apps/desktop/src/components/Timeline/Timeline.tsx`（工具栏 JSX）
- CSS 文件（光标规则）

#### 2a. 工具栏指示器

在工具栏 zoom slider 之前添加模式状态指示器：

```
[现有按钮...] | [滑移编辑 🔄] | [zoom slider] | [颜色过滤]
```

- 仅当对应模式激活时显示（hold-to-activate）
- 使用 `border-brand bg-brand/10 text-brand` 样式（与 annotation mode 按钮风格一致）
- 显示模式名称 + 对应图标：
  - Slip（滑移）: `ArrowLeftRight` 图标 + "滑移"
  - Slide（滑行）: `MoveHorizontal` 图标 + "滑行"
  - Rolling Trim（滚动修剪）: `Scissors` 图标 + "滚动修剪"

#### 2b. 光标样式

利用已有的 `data-editing-mode` 属性，通过 Tailwind 的 data-attribute 选择器改变 timeline clip 区域光标。

在 ClipBlock 组件的 className 中添加条件光标类：

```tsx
// TimelineParts.tsx - ClipBlock 容器
className={cn(
  '...',
  'data-[editing-mode=slip]:cursor-ew-resize',
  'data-[editing-mode=slide]:cursor-grab',
  'data-[editing-mode=rolling-trim]:cursor-col-resize',
)}
```

注意：裁剪手柄（trim handles）应保留其 `cursor-col-resize`，不受模式影响。需要确保手柄的光标优先级高于 clip 主体。

### 3. 右键菜单增加删除选项

**改动文件**: `apps/desktop/src/components/Timeline/Timeline.tsx`（`ClipActionMenu` 组件）

在 `ClipActionMenu` 的菜单项中，"创建分组"之前添加分隔线和两个菜单项：

```
──────────────
🗑️ 删除片段          Delete
🧹 波纹删除          Shift+Delete
──────────────
📎 创建分组          Ctrl+G
```

- "删除片段"调用 `deleteSelected`（与工具栏按钮相同逻辑）
- "波纹删除"调用 `rippleDeleteSelected`（使用 `RippleDeleteCommand`）
- 快捷键提示显示在菜单项右侧

### 4. 波纹删除工具栏按钮

**改动文件**: `apps/desktop/src/components/Timeline/Timeline.tsx`（工具栏 JSX）

在现有 Trash2 按钮（普通删除）旁边添加波纹删除按钮：

```
[✂️ 分割] [🔗 分组] [📂 取消分组] [🗑️ 删除] [🧹 波纹删除]
```

- 使用 `Eraser` 图标（Lucide）
- `title` 属性显示"波纹删除 (Shift+Delete)"
- 点击调用 `rippleDeleteSelected`（通过 `RippleDeleteCommand`）
- 样式与现有 Trash2 按钮一致：`rounded-md border border-line p-2 hover:bg-panel`

### 5. 清理重复函数（跳过）

Timeline.tsx 的本地 `deleteSelected`/`splitSelected` 用于按钮 onClick，EditorShell 的用于快捷键。两者功能等价，保持现状以避免引入回归。

### 6. E2E 测试

**新增文件**: `apps/desktop/e2e/timeline-advanced-tools.spec.ts`

使用 `TimelinePage` POM，遵循 `STABILITY_CHECKLIST.md` 规范。

#### 测试用例

**TC-1: 波纹删除消除间隙**
1. Mock 素材并生成 3 个连续片段（无间隙）
2. 选中第 2 个片段
3. 执行 `Shift+Delete`（波纹删除）
4. 断言：剩余 2 个片段，第 3 个片段已前移填补空隙，无间隙

**TC-2: 普通删除保留间隙**
1. 同上 setup
2. 选中第 2 个片段
3. 执行 `Delete`（普通删除）
4. 断言：剩余 2 个片段，第 3 个片段位置不变（有间隙）

**TC-3: 右键菜单波纹删除**
1. 生成片段
2. 右键点击片段
3. 点击"波纹删除"菜单项
4. 断言：片段已删除且无间隙

**TC-4: 编辑模式指示器**
1. 生成片段
2. 按住 S 键（不释放）
3. 断言：工具栏出现"滑移"指示器
4. 释放 S 键
5. 断言：指示器消失

---

## 不在范围内

- 核心算法修改（已完整实现）
- 工具箱面板（类似 Premiere 的工具选择器）— 属于方案 B
- 编辑模式状态机重构（替代 5 个独立 useState）— 属于方案 B
- Timeline.tsx 函数去重重构

## 风险评估

- **低风险**: 所有改动集中在 UI 层（JSX + CSS），不修改核心算法或 Command 实现
- **S 键绑定变更**: 可能影响已习惯按 S 分割的用户，但 T 是行业标准
- **右键菜单**: 新增菜单项不影响现有功能
