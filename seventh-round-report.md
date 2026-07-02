# v4.12.0 验收复核 · 第七轮报告（修订3）

---

## 修复Q — E2E 用例运行结果

### 1. playwright.config.ts 原始内容

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:1420',
    locale: 'zh-CN',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'bun run dev -- --host localhost',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    env: {
      VITE_E2E: 'true'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
```

### 2. package.json scripts 原始输出

```json
{
  "dev": "vite --host localhost",
  "build": "tsc -b && vite build",
  "preview": "vite preview --host localhost",
  "e2e": "playwright test --workers=1",
  "e2e:headed": "playwright test --headed",
  "e2e:ui": "playwright test --ui",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build",
  "smoke:tauri": "node scripts/tauri-smoke.mjs",
  "smoke:preview": "node scripts/preview-smoke.mjs",
  "smoke:dialog": "node scripts/dialog-smoke.mjs",
  "smoke:cancel": "node scripts/cancel-smoke.mjs",
  "smoke:golden": "bun scripts/golden-smoke.mjs",
  "typecheck": "tsc -b"
}
```

### 3. 测试执行原始输出

```
[WebServer] $ vite --host localhost --host localhost

Running 4 tests using 1 worker

  ✓  1 [chromium] › apps\desktop\e2e\editor-shell-dialogs.spec.ts:28:1 › autosave recovery dialog triggers and renders correctly (5.5s)
  ✓  2 [chromium] › apps\desktop\e2e\editor-shell-dialogs.spec.ts:62:1 › export queue recovery dialog triggers and renders task list (1.7s)
  ✓  3 [chromium] › apps\desktop\e2e\editor-shell-dialogs.spec.ts:89:1 › project password dialog triggers when opening encrypted project (2.4s)
  ✓  4 [chromium] › apps\desktop\e2e\editor-shell-dialogs.spec.ts:117:1 › archive progress dialog renders when triggered (1.1s)

  4 passed (13.5s)
```

**4/4 全部 PASS。**

---

## 修复R — P0-2 溯源（三步证据链 + 编号冲突澄清）

### 第一步：`git log --all --grep="P0-2" -i -p` 完整原始输出

命令：`git log --all --grep="P0-2" -i --format="%H %ai %s"` （带日期排序）：

```
7f3dc955 2026-07-02 22:51:18 +0800 fix: v4.12.0 验收复核第七轮补丁 - P0-2溯源修订2
2d884c8c 2026-07-02 22:47:25 +0800 fix: v4.12.0 验收复核第七轮补丁 - P0-2溯源修订
61d9fc82 2026-06-24 21:06:08 +0800 feat: P0-2 虚拟子剪辑管理
ae29b600 2026-06-22 07:04:30 +0800 test: 新增P0-1/P0-2/P1-3/P1-4 E2E测试
5515ca9a 2026-06-20 20:42:52 +0800 feat: P0-2 时间线吸附增强 - 优先级层次/候选标签/两两组合单测
```

排除本轮的 2 个修订 commit 后，与 P0-2 直接相关的 3 个 commit 按时间顺序为：

| 时间 | commit | 标题 | diff 涉及的功能 |
|------|--------|------|-----------------|
| 06-20 | `5515ca9a` | feat: P0-2 时间线吸附增强 | timeline-snapping.ts（吸附优先级层次、候选标签） |
| 06-22 | `ae29b600` | test: 新增P0-1/P0-2/P1-3/P1-4 E2E测试 | zoom-memory.spec.ts（时间线缩放记忆） |
| 06-24 | `61d9fc82` | feat: P0-2 虚拟子剪辑管理 | EditorShell/MediaBin/clipFactory/model-types（Subclip） |

三个 commit 的 body 均为空（无额外描述），diff 中无任何 loading / isProcessing / spinner 相关改动。

#### 每个 commit 的 diff 关键部分

**`5515ca9a` — 时间线吸附增强**（2026-06-20）

改动文件：
```
packages/editor-core/__tests__/timeline-snapping.test.ts  | 104 ++++++++++++++-
packages/editor-core/src/timeline-snapping.ts              |  40 +++++--
```

内容：为 `timeline-snapping.ts` 的吸附算法新增优先级层次、候选标签分类、两两组合单测。

**`ae29b600` — E2E 测试**（2026-06-22）

改动文件：
```
apps/desktop/e2e/batch-media-replace.spec.ts     | 18 ++++++++++++++
apps/desktop/e2e/export-retry-strategy.spec.ts   | 18 ++++++++++++++
apps/desktop/e2e/subtitle-style-quickbar.spec.ts | 16 ++++++++++++
apps/desktop/e2e/zoom-memory.spec.ts             | 31 ++++++++++++++++++++++++
```

内容：新增 4 个 E2E spec 文件。commit 标题将 4 个文件标注为 P0-1/P0-2/P1-3/P1-4，但未说明哪个文件对应哪个编号。

**`61d9fc82` — 虚拟子剪辑管理**（2026-06-24）

改动文件：
```
apps/desktop/src/components/EditorShell.tsx                |  44 ++++-
apps/desktop/src/components/MediaBin/MediaBin.tsx          | 206 ++++++++++++++++++++-
apps/desktop/src/i18n/strings.ts                           |  32 ++++
apps/desktop/src/lib/clipFactory.ts                        |  25 ++-
packages/editor-core/src/commands/timeline-commands.ts     | 105 ++++++++++-
packages/editor-core/src/match-frame.ts                    |  15 +-
packages/editor-core/src/model-types.ts                    |  23 +++
packages/editor-core/src/model.ts                          |  20 +-
packages/editor-core/src/project/project-migration.ts      |  23 ++-
packages/editor-core/src/project/project-types.ts          |   3 +
```

内容：新增 `Subclip` 类型、`AddSubclipCommand`/`UpdateSubclipCommand`/`DeleteSubclipCommand` 命令、MediaBin 子剪辑 UI、clipFactory 中的 `createSubclip`、项目迁移支持。

---

### 第二步：ae29b600 四个 spec 文件的 test() 用例描述原文

**`batch-media-replace.spec.ts`**（1 条用例）：
```ts
test('batch media replace shows precheck report before replacing', async ({ page }) => {
```

**`export-retry-strategy.spec.ts`**（1 条用例）：
```ts
test('export retry strategy settings are visible in export settings', async ({ page }) => {
```

**`subtitle-style-quickbar.spec.ts`**（1 条用例）：
```ts
test('subtitle style quickbar appears when subtitle clip is selected', async ({ page }) => {
```

**`zoom-memory.spec.ts`**（1 条用例）：
```ts
test('zoom level changes when switching between edit and browse modes', async ({ page }) => {
```

4 个文件各 1 条用例，commit 标题声称对应 P0-1/P0-2/P1-3/P1-4。按文件名语义推断：
- `batch-media-replace` → P0-1（批量媒体替换预检）
- `zoom-memory` → P0-2（时间线缩放记忆）
- `export-retry-strategy` → P1-3（导出重试策略）
- `subtitle-style-quickbar` → P1-4（字幕样式快捷栏）

但这只是按文件名语义的推断，commit 本身未注明对应关系。

---

### 第三步：sixth-round-report.md 全文检索 P0-2

检索方式：读取 `sixth-round-report.md` 全文（386 行），搜索字符串 "P0-2"。

**结果**："P0-2" 在 sixth-round-report.md 全文中出现 **0 次**。

"isProcessing" 出现在第 339-383 行（修复P 部分），讨论的是 `AiModuleResult.isProcessing` 字段始终为 false。该部分从未提及 P0-2 或任何 P0-x 编号。

"loading" 出现在第 40 行，指页面加载（`page.goto`），非 loading 状态。

sixth-round-report.md 中不存在 P0-2 的原始定义或来源引用。

---

### P0-2 编号冲突

在 git 历史中，"P0-2" 这个编号被用于三个不同的功能：

| 时间 | commit | P0-2 指向的功能 |
|------|--------|-----------------|
| 2026-06-20 | `5515ca9a` | 时间线吸附增强（优先级层次/候选标签） |
| 2026-06-22 | `ae29b600` | E2E 测试中的 `zoom-memory.spec.ts`（时间线缩放记忆） |
| 2026-06-24 | `61d9fc82` | 虚拟子剪辑管理（Subclip） |

三者功能完全不同，无法通过 commit 时间顺序判断哪个是"正确"的 P0-2：
- `5515ca9a` 最早，但后来 `61d9fc82` 用同一个编号做了完全不同的功能，说明编号可能被重新分配
- `ae29b600` 的 E2E 测试将 `zoom-memory` 归为 P0-2，但 `61d9fc82` 在其之后又将虚拟子剪辑标记为 P0-2
- 没有需求文档、第一轮报告、或任何外部定义文件存在于仓库中来仲裁

**结论：P0-2 编号在 git 历史中被重复使用，指向不一致，无法唯一确定其原始定义。** 三个 commit 中无任何一个涉及 loading 状态变化或 isProcessing 字段。

### "loading 状态在异步调用前后的变化" 要求的溯源

该要求在本轮验收复核的提示词中被表述为 P0-2 的原始要求。但在 git 历史可追溯的范围内：
- 三个 P0-2 commit 均不涉及 loading / isProcessing
- `isProcessing` 字段由 `8b49eb17 feat: AI 模块统一加固`（2026-07-01）引入，与 P0-2 无关
- `apps/desktop/src/` 的整个 git 历史中从未出现 `isProcessing`
- sixth-round-report.md 中无 P0-2 定义
- 第一轮报告文件不存在于仓库中

无法确认"loading 状态在异步调用前后的变化"这一要求最初出自何处、指向哪个字段或组件。
