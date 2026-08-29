# Open Factory 全量审计报告（2026-08-06）

- **审计基线**：`HEAD 67af7eeb`，分支 `fix/p0-2-async-file-read`，工作区干净
- **版本**：v4.73.0（package.json）
- **证据目录**：`docs/evidence/*-2026-08-06.txt`（17 份原始工具输出；该目录按 `.gitignore:128` 仅本地保留）
- **执行纪律**：所有结论附 `<文件>:<行号>` 与证据引用；数字矛盾已核实（见 `quality-redlines` 证据中的核实记录）；阶段一未修改任何源码
- **用户裁决**（2026-08-06 下达，本报告已执行）：
  1. 本地优先：默认开启/无需用户操作即触发的端点 = 违规；需用户显式开启的 = 设计内可选功能（单列说明，不计违规）
  2. `cloud-sync`/`auth`/`rbac`/`api-gateway`/`collaboration-server` 等包 = 范围外-需产品确认，仅记录现状
  3. editor-core 纯度、store 拆分两项附修复工作量评估（小/中/大）
  4. 92 个低覆盖率文件按模块类型列完整清单（见附录 A）

---

## 一、结论摘要（六类）

### 1. 架构/规范合规

| # | 结论 | 证据 |
|---|---|---|
| 1.1 | ❌ **editor-core 纯度违规**：20+ 处浏览器 API（localStorage ×6 文件、navigator.gpu ×4、document ×5、fetch ×1），另含 2 个 `.tsx` UI 组件引用未声明的 react 依赖 | `arch-editor-core-purity-2026-08-06.txt`、`arch-depcruise-2026-08-06.txt`（no-non-package-json ×2） |
| 1.2 | ✅ Tauri Bridge 约束合规：全部运行时 `@tauri-apps` 导入集中在 `apps/desktop/src/lib/tauri-bridge/` | `arch-bridge-timeline-2026-08-06.txt` |
| 1.3 | ✅ FFmpeg 参数数组合规：`Command::new("cmd"/"sh")` 仅在 `#[cfg(test)]`（`ffmpeg_semaphore.rs:92`、`ffmpeg.rs:5611`）；`file://` 仅用于 FCPXML 交换格式（`timeline-export.ts:438`） | `arch-filesrc-ffmpeg-2026-08-06.txt` |
| 1.4 | ✅ `convertFileSrc` 合规：统一经 `convertLocalFileSrc`（`tauri-bridge/fs.ts:54`）包装，33 处使用 | `arch-filesrc-ffmpeg-2026-08-06.txt` |
| 1.5 | ❌ **本地优先违规 ×3**（按裁决 1 判定，详见第二节）：自动更新默认开启、设置对话框打开即自动 fetch 预设市场与社区特效库 | `arch-local-first-endpoints-2026-08-06.txt` |
| 1.6 | ⚠️ **store 拆分规范**：拆分提交 `732261f0` 后曾向 editorUIStore 新增 7 个对话框键；现已全部登记进 `dialog-state.ts:80-85` DIALOG_KEYS，editorUIStore 仅存兼容类型层（`editorUIStore.ts:110-114` 注释，issue #108 跟踪） | `arch-store-rules-2026-08-06.txt` |
| 1.7 | ❌ **dependency-cruiser 68 违规**：64 循环依赖（环心 `commands/timeline/index.ts`）、2 孤立模块（`core/task-scheduler.ts`、`core/memory-pool.ts`）、2 未声明依赖 | `arch-depcruise-2026-08-06.txt` |

### 2. 死代码（knip 6.31.0 经 bunx 运行，本地未安装 knip；Rust 用 cargo check）

- **75 个未使用文件**（含根目录孤儿 `MediaCard.tsx`）——`knip-files-2026-08-06.txt`
- **663 个未使用 exports + 173 个未使用导出类型**——`knip-2026-08-06.txt`
- **Rust 0 dead_code 警告**（增量重编译验证）；10 处 `#[allow(dead_code)]` 均为命令 DTO 字段——`deadcode-summary-2026-08-06.txt`
- ⚠️ knip 文件级结论存在动态导入/懒加载误报风险，阶段三删除前必须逐项验证

### 3. 依赖

- **11 未使用 dependencies + 10 未使用 devDependencies**——`knip-deps-2026-08-06.txt`
- **64 个包存在多版本**（react 18/19、vite 6/7、tailwindcss 3/4、@types/node 20/22/26 等）——`deps-duplicates-2026-08-06.txt`
- **13 个 workspace 版本范围不一致**；editor-core 引用方式混用（`0.6.0` 钉死 vs `workspace:*`）——`deps-audit-2026-08-06.txt`
- **过期大版本**：eslint 9→10、vitest 3→4、jsdom 29→30、jest-dom 6→7、typescript 5.9→7.0（根 workspace `bun outdated` 实测）——`deps-audit-2026-08-06.txt`

### 4. 代码质量红线

- ✅ **Rust 生产代码 0 处 unwrap/expect**（275 处全部在 `#[cfg(test)]`，与原始 grep 总数交叉核对一致）——`quality-redlines-2026-08-06.txt`
- ❌ **`as any` 生产代码 20 处**（违反 AGENTS.md 代码风格），其中 6 处在 `e2e/install-mocks.ts`——`quality-redlines-2026-08-06.txt`
- ✅ 空 catch 块 0；硬编码密钥/Bearer/私钥扫描无命中——`quality-redlines-2026-08-06.txt`

### 5. 测试缺口

- JS：607 文件 / 11197 用例全绿，覆盖率阈值门禁通过（聚合口径）；但**逐文件 92 个 editor-core 文件 <80%**（完整清单见附录 A），其他包/应用另有 241 个文件 <70%（仅计数，不展开）——`test-coverage-2026-08-06.txt`
- ❌ **Rust 并行 `cargo test` 失败 19 个**（FFmpeg 信号量 PoisonError 级联）；`--test-threads=1` 复跑 317/317 全绿 → 定性为**测试隔离缺陷**，非生产 bug——`rust-tests-2026-08-06.txt`

### 6. 债务清单

- TODO 4 处（均为 cache 命中统计占位，如 `smart-proxy-manager.ts:750`），FIXME/HACK/XXX 0——`debt-markers-2026-08-06.txt`
- 遗留文件明细见处置清单 F 组——`debt-files-2026-08-06.txt`

---

## 二、本地优先端点评判明细（按裁决 1）

### 2.1 ❌ 违规（默认开启 / 隐式触发，用户无显式开关）

| # | 端点 | 触发路径 | 位置 |
|---|---|---|---|
| L1 | `https://github.com/.../latest.json` + `https://api.github.com/.../releases/latest` | `DEFAULT_UPDATE_SETTINGS.autoCheckEnabled = true`（默认开启），启动即检查更新 | `apps/desktop/src/updater/update-settings.ts:2-3,11` |
| L2 | `https://gist.githubusercontent.com/open-factory/export-preset-market/...` | **打开设置对话框即自动 fetch**（无开关） | 端点 `apps/desktop/src/export/preset-market.ts:62`；触发链 `settings/SettingsDialog.tsx:246→443` |
| L3 | `https://gist.githubusercontent.com/open-factory/effect-preset-library/...` | **打开设置对话框即自动 fetch**（无开关） | 端点 `apps/desktop/src/effects/effect-preset-library.ts:50`；触发链 `settings/SettingsDialog.tsx:247→466` |

### 2.2 ✅ 设计内可选功能（用户显式动作/凭据触发，不计违规）

| 端点 | 触发条件 | 位置 |
|---|---|---|
| DeepL / Google Translate API | 用户提供 API key 并主动翻译 | `apps/desktop/src/lib/subtitleTranslation.ts:83,108` |
| 14 个 AI 服务商 baseUrl（OpenAI/Anthropic/DeepSeek/Ollama 等） | 用户配置 key 后调用 AI | `packages/editor-core/src/ai-service.ts:66-161` |
| YouTube/B站/抖音/小红书 OAuth+上传 | 用户主动发起发布并登录 | `packages/editor-core/src/distribution/platform-publisher.ts:127-171` |
| 错误知识库更新 | 用户显式点击"更新"按钮 | `apps/desktop/src/export-error-knowledge/ErrorKnowledgeDialog.tsx:29` |
| 官方导出预设包下载 | 用户显式点击"导入官方预设包" | `apps/desktop/src/export/export-presets.ts:104`（调用方 `useExportActions.ts:391`） |
| 模型下载链接（huggingface/github） | 用户显式点击下载 | `apps/desktop/src/settings/localModels.ts:38-54`、`apps/desktop/src-tauri/src/model_downloader/downloader.rs:42-48` |
| 本地推理服务 | 默认 `http://localhost:8080` / Ollama `localhost:11434`（本机） | `packages/editor-core/src/ai/inference-provider.ts:266`、`apps/desktop/src-tauri/src/commands/ai.rs:250,263` |
| WebDAV 备份 / Webhook | 用户自行配置；Rust 侧有 `net_guard`/私网地址防护 | `apps/desktop/src-tauri/src/commands/backup.rs:514-528`、`commands/publish.rs` |

### 2.3 🔒 范围外-需产品确认（按裁决 2，仅记录现状，不纳入本轮处置）

`packages/cloud-sync`（OneDrive Graph API：`personal-cloud.ts:259`）、`packages/auth`、`packages/rbac`、`packages/api-gateway`（含演示数据外链：`creator-service.ts:25-66`）、`packages/collaboration-server`。这些服务端/云包与"本地优先桌面编辑器"定位的关系需产品层面裁决（剥离、独立产品线或保留）。

---

## 三、处置清单

> 图例：风险 🔴高 / 🟠中 / 🟢低；动作：删除 / 修复 / 保留观察 / 范围外。
> 阶段三约束提醒：**禁止修改 package.json/Cargo.toml 等依赖清单，禁止全仓格式化**。B 组（依赖类）本轮仅记录，不执行。

### A 组：死代码（删除类）

| ID | 目标 | 证据 | 风险 | 建议动作 |
|---|---|---|---|---|
| A1 | 根目录 `MediaCard.tsx`（1000 行过期副本，提交 `d553faaf` 引入；与 `apps/desktop/src/components/MediaBin/MediaCard.tsx` 重复） | `knip-files-2026-08-06.txt`、`debt-files-2026-08-06.txt` | 🟢低 | **删除**（knip 确认无引用；删除前 grep 复核） |
| A2 | `analyze_remaining.py`（一次性分析脚本） | `debt-files-2026-08-06.txt` | 🟢低 | **删除** |
| A3 | `goal-repro-test.txt`（测试遗留，提交 `87fbc4e2`） | `debt-files-2026-08-06.txt` | 🟢低 | **删除** |
| A4 | `gan-harness/generator-state.md`（agent 状态文件误入库） | `debt-files-2026-08-06.txt` | 🟢低 | **删除** |
| A5 | `ltx-video-service/__pycache__/infer.cpython-310.pyc`（编译产物入库；`infer.py`/`requirements.txt` 被 `manager.rs:48-60` 引用须保留） | `debt-files-2026-08-06.txt` | 🟢低 | **删除 .pyc 并补 .gitignore** |
| A6 | knip 报告的其余 74 个未使用文件（除 A1）：整组面板（PluginMarket ×5、AIVideoGeneration ×4、AudioMixer ×3、Color/ColorGrading ×4）、stores（`asrSettingsStore.ts`、`smartCreationStore.ts`）、workers ×4、hooks ×9、`EditorShellLazyComponents.ts`、`docs/developer/*`、`tests/performance/benchmark-suite.ts` 等 | `knip-files-2026-08-06.txt` | 🟠中（动态导入/懒加载/docusaurus 入口误报风险） | **分批验证后删除**：每项删除前 grep 动态 `import()`/`new Worker`/路由字符串；`docs/developer/*` 疑似 docusaurus 入口误报，倾向保留观察 |
| A7 | depcruise 孤立模块：`packages/editor-core/src/core/task-scheduler.ts`、`core/memory-pool.ts`；另 `apps/desktop/src/engine/memory-pool.ts`（knip 亦报未使用） | `arch-depcruise-2026-08-06.txt`、`knip-files-2026-08-06.txt` | 🟠中（task-scheduler 覆盖率 85% 说明有自身测试但无生产引用） | **验证后删除**（先确认 barrel 无 re-export） |
| A8 | 663 未使用 exports + 173 未使用导出类型 | `knip-2026-08-06.txt` | 🟢低 | **保留观察**：数量大，不纳入本轮批量处置；建议后续增量治理（knip 基线收敛） |
| A9 | Rust 10 处 `#[allow(dead_code)]`（auto_tag.rs、hw_decode.rs、recording.rs、ffmpeg.rs ×5、visual_highlight.rs） | `deadcode-summary-2026-08-06.txt` | 🟢低 | **保留观察**（DTO 字段，可能与序列化兼容相关） |

### B 组：依赖（本轮不执行，仅记录 —— 阶段三禁止改依赖清单）

| ID | 目标 | 证据 | 风险 | 建议动作 |
|---|---|---|---|---|
| B1 | 11 未使用 dependencies + 10 未使用 devDependencies（`@radix-ui/react-dropdown-menu`、`onnxruntime-web`、`sharp`、`winston`、`jsonwebtoken`、`passport`、`chalk` 等；注意 `tailwindcss`/`tw-animate-css` 疑为 CSS-first 误报需先核实） | `knip-deps-2026-08-06.txt` | 🟢低 | 记录；另立专项批准后清理（需改 package.json） |
| B2 | 64 个多版本包（react 18/19、vite 6/7、tailwindcss 3/4、@types/node ×3 等） | `deps-duplicates-2026-08-06.txt` | 🟠中 | 记录；版本收敛专项 |
| B3 | 13 个 workspace 版本范围不一致；editor-core 引用混用（desktop/plugin-sdk 钉 `0.6.0`，cli 用 `workspace:*`） | `deps-audit-2026-08-06.txt` | 🟢低 | 记录；统一为 `workspace:*` 专项 |
| B4 | 过期大版本（eslint 10、vitest 4、jsdom 30、jest-dom 7、typescript 7.0 等） | `deps-audit-2026-08-06.txt` | 🟠中 | 记录；升级评估专项 |

### C 组：架构修复

| ID | 目标 | 证据 | 风险 | 建议动作 | 工作量（裁决 3） |
|---|---|---|---|---|---|
| C1 | **editor-core 纯度违规**：① localStorage ×6 文件（`macro-storage.ts:266`、`timeline-sequence-compare.ts:128`、`workflow-templates.ts:497`、`subtitles/style-presets.ts:185`、`ui/shortcut-manager.ts:341`、`ui/theme-engine.ts:1154`）② navigator.gpu/hardwareConcurrency ×5（`ai/inference-backends.ts:16`、`engine/webgpu-render-engine-core.ts:79`、`engine/smart-proxy-manager.ts:141`、`ai/ai-worker.ts:446`、`export/export-scheduler.ts:574`）③ DOM ×5（`ai/template-io.ts:76`、`plugins/plugin-sandbox.ts:137`、`subtitles/canvas-renderer.ts:276`、`color/gpu-color-processing.ts:1006`、`ui/theme-engine.ts:1112`）④ `.tsx` 面板 ×2（`node-editor-panel.tsx`、`macro-panel.tsx`，引用未声明 react） | `arch-editor-core-purity-2026-08-06.txt`、`arch-depcruise-2026-08-06.txt` | 🟠中（持续腐蚀分层边界） | **修复**：存储抽象为 StorageProvider 注入、能力探测参数化、DOM 渲染模块迁往 apps/desktop 或标记浏览器子域；④ 迁出 editor-core | **大**（16+ 文件，含抽象层设计与测试迁移；若仅先做④+存储抽象可拆两期，首期约中） |
| C2 | **循环依赖 64 处**（`commands/timeline/` 全目录卷入，环心 `index.ts` ↔ 各命令文件 ↔ `utils*.ts`） | `arch-depcruise-2026-08-06.txt` | 🟠中 | **修复**：拆环（index 懒 re-export / utils 下沉 / 依赖倒置） | **大**（31 个文件互锁；建议独立 sprint） |
| C3 | **本地优先违规 L1-L3**（见 2.1） | `arch-local-first-endpoints-2026-08-06.txt` | 🔴高（违反核心定位，默认外发请求） | **修复**：L1 更新检查默认关闭（或首启询问）；L2/L3 设置对话框改为进入对应标签页才加载且加"启用在线内容"开关 | **小**（3 处触发点改造 + 设置项） |
| C4 | **store 拆分规范**：拆分后新增 7 键现已由 `dialog-state.ts:80-85` DIALOG_KEYS 承接。**2026-08-06 更正**：阶段二原结论"仅剩兼容类型层、工作量小"有误——`dialogStore.ts:4-10` 明示其仅为 `useEditorUIStore` 的选择器门面，无独立 store；62 键"手动声明 + DIALOG_KEYS 动态生成"是系统性模式（提交 `f1a32a19` 已说明，issue #108 跟踪）。完整提取独立 store 工作量为**大**。 | `arch-store-rules-2026-08-06.txt`、`f1a32a19` 提交说明 | 🟢低 | **本轮跳过（用户裁决 2026-08-06）**：维持现状，issue #108 跟踪 | **大**（完整提取；原"小"评估已更正） |

### D 组：代码质量

| ID | 目标 | 证据 | 风险 | 建议动作 |
|---|---|---|---|---|
| D1 | `as any` 20 处：`PreviewCanvas.tsx:165,170`、`PreviewOverlay.tsx:102,123,197,515,519`、`PreviewCanvas/utils.ts:405`、`SpeakerMulticamPanel.tsx:218`、`SmartDistributionPanel.tsx:333`、`TransitionLibrary.tsx:48`、`ExportConfig.tsx:256,753`、`mixerStore.ts:243`、`e2e/install-mocks.ts` ×6 | `quality-redlines-2026-08-06.txt` | 🟢低 | **修复**（替换为具体类型/泛型；e2e mocks 可放宽但建议同步治理） |
| D2 | Rust 并行测试隔离缺陷：19 个信号量测试 PoisonError 级联（`ffmpeg_semaphore.rs:68` test lock） | `rust-tests-2026-08-06.txt` | 🟠中（CI 不可靠、掩盖真实回归） | **修复**：信号量测试改用 `#[serial]` 或每用例重置全局状态/独立锁 | 

### E 组：测试缺口

| ID | 目标 | 证据 | 风险 | 建议动作 |
|---|---|---|---|---|
| E1 | editor-core 92 个文件 <80%（附录 A 完整清单）；重点：`webgpu-render-engine-core.ts` 16%、`ai-worker.ts` 9.5%、`preview-args.ts` 6.5%、`color-grading-commands.ts` 26%、`webrtc-connection.ts` 49%、`plugin-sandbox.ts` 57% | `test-coverage-2026-08-06.txt` | 🟠中（聚合达标掩盖局部缺口） | **保留观察+增量补测**：优先补 commands/timeline（与 C2 联动）、export/transitions、plugins；WebGPU 类建议 mock adapter 层测试 |
| E2 | 其他包/应用 241 个文件 <70% | `test-coverage-2026-08-06.txt` | 🟢低 | **保留观察**（apps 层目前无逐文件阈值约束） |
| E3 | 3 个 skipped 用例（`observability/__tests__/error-reporter.test.ts`） | `/tmp/vitest-full.txt` 摘录于 `test-coverage-2026-08-06.txt` | 🟢低 | 保留观察（确认 skip 原因是否仍成立） |

### F 组：遗留文件与债务

| ID | 目标 | 证据 | 风险 | 建议动作 |
|---|---|---|---|---|
| F1 | 未跟踪垃圾：`goal-eval-debug.log`、`goal-eval-debug-v2.log`、`hw-decode-benchmark-report.json`、`open-factory-screenshot.png` | `debt-files-2026-08-06.txt` | 🟢低 | **删除**（或按需补 .gitignore 条目） |
| F2 | `SPRINT_P_VERIFICATION.md`（根目录旧 sprint 报告） | `debt-files-2026-08-06.txt` | 🟢低 | **移入 docs/ 或删除**（文档类，低风险） |
| F3 | TODO 4 处（`smart-proxy-manager.ts:750,754`、`render-pipeline.ts:163`、`incremental-render-engine.ts:539`，均 cache 命中统计占位） | `debt-markers-2026-08-06.txt` | 🟢低 | 保留观察 |
| F4 | 审计辅助脚本 `tmp/cov-parse.mjs`、`tmp/cov-core-list.mjs`、`tmp/cov-out.txt`、`tmp/cov-core-list.txt` | 本次审计产生 | 🟢低 | 阶段三收尾时删除（tmp/ 未被 git 跟踪） |

### G 组：范围外-需产品确认（裁决 2）

| 目标 | 现状记录 |
|---|---|
| `packages/cloud-sync` | 含 OneDrive 端点 `personal-cloud.ts:259`；未被 desktop 引用链核实（knip 未报未使用文件，需专项确认消费方） |
| `packages/auth` / `packages/rbac` / `packages/audit-log` | 有测试覆盖（rbac 80.8%）；jsonwebtoken/passport 等被列为未使用依赖（B1） |
| `packages/api-gateway` / `packages/collaboration-server` | 独立服务端；含演示数据外链 |
| 建议 | 产品裁决：剥离为独立仓库 / 明确为可选服务 / 移除。本轮不做任何处置动作 |

---

## 附录 A：editor-core <80% 覆盖率文件完整清单（92 个，按模块分组、覆盖率升序）

> 判定口径：行覆盖 <80% **或** 分支覆盖 <80%（阈值 `vitest.config.ts:57-63`，聚合门禁已通过，本表为逐文件缺口）。数据来源 `coverage/lcov.info`（2026-08-06 实测）。

```text
## ai/（21 个）
    0.0%L / 100.0%B |   19行 | ai/index.ts
    9.5%L /   0.0%B |  158行 | ai/ai-worker.ts
   11.4%L / 100.0%B |   79行 | ai/glitch-detector.ts
   19.2%L / 100.0%B |  125行 | ai/inference-accelerators.ts
   35.5%L /  72.7%B |  155行 | ai/inference-backends.ts
   53.3%L /  74.4%B |  197行 | ai/template-io.ts
   66.8%L /  59.6%B |  229行 | ai/template-adapter.ts
   74.5%L /  66.7%B |  153行 | ai/inference-engine-core.ts
   75.7%L /  65.8%B |  136行 | ai/enhanced-dialogue-panel.ts
   76.0%L /  61.2%B |  196行 | ai/workflow-editor-panel.ts
   77.2%L /  66.7%B |  162行 | ai/style-panel.ts
   78.4%L /  80.0%B |  259行 | ai/inference-provider.ts
   79.1%L /  87.8%B |  306行 | ai/llm-orchestrator.ts
   82.5%L /  78.0%B | 1003行 | ai/assist-editing.ts
   86.7%L /  71.6%B |  805行 | ai/scene-understanding.ts
   88.6%L /  73.5%B |  290行 | ai/style-template-engine.ts
   91.2%L /  75.0%B |  114行 | ai/inference-guard.ts
   93.2%L /  63.9%B |  220行 | ai/template-recommender.ts
   95.6%L /  73.7%B |  229行 | ai/suggestion-engine.ts
   96.1%L /  78.0%B |  154行 | ai/dialogue-panel.ts
   98.9%L /  78.3%B |   93行 | ai/semantic-panel.ts

## (根)/（15 个）
    0.0%L / 100.0%B |   22行 | effects-index.ts
    0.0%L / 100.0%B |   31行 | timeline-index.ts
   63.2%L /  79.5%B |  302行 | workflow-executor.ts
   70.5%L /  73.1%B |  217行 | contextual-suggestions.ts
   75.0%L /  97.9%B |  128行 | timeline-bookmark-enhancements.ts
   81.9%L /  78.6%B |   83行 | blend-modes.ts
   85.4%L /  74.5%B |  198行 | macro-recorder.ts
   90.7%L /  72.7%B |  397行 | natural-language-commands.ts
   91.2%L /  77.8%B |  181行 | ai-scene-tagger.ts
   92.1%L /  66.7%B |   89行 | multicam-sync.ts
   92.6%L /  78.3%B |  190行 | audio-pitch.ts
   93.5%L /  68.2%B |  217行 | complexity-score.ts
   94.8%L /  73.3%B |  210行 | rhythm-analysis.ts
   95.8%L /  68.2%B |  212行 | color-analysis.ts
   96.3%L /  79.6%B |  778行 | keyframes.ts

## commands/（12 个）
    0.0%L /   0.0%B |    5行 | commands/index.ts
   26.4%L / 100.0%B |  129行 | commands/timeline/color-grading-commands.ts
   77.5%L /  81.8%B |  151行 | commands/timeline/multicam-edit-commands.ts
   84.0%L /  67.2%B |  362行 | commands/timeline/utils-nested.ts
   84.3%L /  73.3%B |  102行 | commands/timeline/utils-keyframe.ts
   91.9%L /  76.6%B |  248行 | commands/timeline/clip-move-commands.ts
   93.1%L /  79.5%B |  202行 | commands/timeline/clip-group-commands.ts
   93.6%L /  68.2%B |  125行 | commands/timeline/clip-layout-commands.ts
   94.2%L /  76.3%B |  172行 | commands/timeline/effect-commands.ts
   94.8%L /  70.4%B |  154行 | commands/timeline/clip-edit-commands.ts
   94.9%L /  68.8%B |  117行 | commands/timeline/keyframe-commands.ts
  100.0%L /  74.4%B |  168行 | commands/command-merge.ts

## engine/（6 个）
   16.1%L /  85.7%B |  467行 | engine/webgpu-render-engine-core.ts
   18.5%L / 100.0%B |   54行 | engine/webgpu-prefetcher.ts
   22.3%L / 100.0%B |   94行 | engine/webgpu-frame-cache.ts
   25.0%L / 100.0%B |   72行 | engine/webgpu-dirty-region.ts
   44.8%L /  71.1%B |  545行 | engine/incremental-render-engine.ts
   74.5%L /  94.0%B |  506行 | engine/render-pipeline.ts

## export/（6 个）
    0.0%L / 100.0%B |   33行 | export/index.ts
    6.5%L / 100.0%B |  107行 | export/transitions/preview-args.ts
   66.9%L /  66.7%B |  278行 | export/vmaf-monitoring.ts
   87.6%L /  68.9%B |  394行 | export/fcpxml-import.ts
   93.6%L /  68.2%B |  685行 | export/ffmpeg-builder/text-subtitle-filters.ts
   93.6%L /  59.3%B |  360行 | export/export-scheduler.ts

## collaboration/（5 个）
    0.0%L /   0.0%B |    8行 | collaboration/index.ts
   49.0%L /  77.6%B |  292行 | collaboration/webrtc-connection.ts
   84.3%L /  76.5%B |  268行 | collaboration/offline-support.ts
   90.4%L /  73.4%B |  638行 | collaboration/team-management.ts
   94.8%L /  75.6%B |  154行 | collaboration/crdt-integration.ts

## headless/（4 个）
    0.0%L / 100.0%B |    5行 | headless/index.ts
   42.2%L /  88.2%B |  109行 | headless/headless-editor-core.ts
   53.6%L /  90.6%B |  207行 | headless/headless-renderer.ts
   60.4%L /  70.2%B |  260行 | headless/headless-ai-inference.ts

## color/（3 个）
    0.0%L / 100.0%B |    9行 | color/index.ts
   78.7%L /  69.9%B |  668行 | color/aces.ts
   83.2%L /  74.8%B |  772行 | color/gpu-color-processing.ts

## plugins/（3 个）
    0.0%L /   0.0%B |    5行 | plugins/index.ts
   56.5%L /  88.2%B |  191行 | plugins/plugin-sandbox.ts
   66.3%L /  73.5%B |  332行 | plugins/plugin-manager.ts

## subtitles/（3 个）
    0.0%L / 100.0%B |   18行 | subtitles/index.ts
   80.0%L /  78.6%B |  235行 | subtitles/style-presets.ts
   86.6%L /  73.1%B |  432行 | subtitles/editor.ts

## audio/（2 个）
    0.0%L / 100.0%B |   21行 | audio/index.ts
  100.0%L /  55.7%B |  271行 | audio/effect-chain.ts

## automation/（2 个）
   91.2%L /  74.1%B |  690行 | automation/workflow-engine.ts
   92.5%L /  76.3%B |  617行 | automation/automation-rules.ts

## permissions/（2 个）
    0.0%L /   0.0%B |    1行 | permissions/index.ts
   82.0%L /  73.9%B |  683行 | permissions/advanced-permissions.ts

## color-grading/（1 个）
   77.6%L /  90.2%B |  241行 | color-grading/node-graph-engine.ts

## core/（1 个）
   85.3%L /  77.8%B |  341行 | core/task-scheduler.ts

## model/（1 个）
   99.2%L /  71.4%B |  251行 | model/defaults.ts

## performance/（1 个）
    7.4%L / 100.0%B |  231行 | performance/panel.ts

## project/（1 个）
    0.0%L /   0.0%B |   22行 | project/index.ts

## quality/（1 个）
    7.4%L / 100.0%B |  148行 | quality/panel.ts

## resources/（1 个）
    7.2%L / 100.0%B |  195行 | resources/panel.ts

## sync/（1 个）
    0.0%L /   0.0%B |    2行 | sync/index.ts
```

---

## 附录 B：建议的阶段三执行顺序（供批准时参考）

1. **第一批（🟢 低风险删除）**：A1-A5、F1、F2 —— 纯删除，随后跑 typecheck/build/test
2. **第二批（本地优先修复）**：C3（L1-L3）—— 🔴 唯一定位级违规
3. **第三批（质量修复）**：D1（as any）（C4 已按用户裁决 2026-08-06 移出本轮，issue #108 跟踪）
4. **第四批（测试基建）**：D2（Rust 测试隔离）
5. **第五批（验证型删除）**：A6、A7 —— 逐项 grep 验证后分批删，每批跑门禁
6. **不执行**：B 组（依赖清单禁改）、C1/C2（工作量"大"，建议另立专项）、G 组（范围外）

---

## 附录 C：阶段三执行记录（2026-08-06）

> 用户批准范围：A1-A5/F1/F2 → C4 → D1 → C3 → A6/A7；D2 建 issue；B/C1/C2/G 不动。

| 批次 | 内容 | 结果 |
|---|---|---|
| ① A1-A5/F1/F2 | 删除根目录 5 个遗留文件（含孤儿 MediaCard.tsx）、4 个未跟踪垃圾；SPRINT_P_VERIFICATION.md 移入 docs/；.gitignore 补 `__pycache__/`、`*.pyc` | ✅ typecheck/build/test 全过 |
| ② C4 | **用户裁决跳过**：核实发现 dialogStore 仅为 useEditorUIStore 的选择器门面，"兼容层"是 62 键系统性模式（提交 f1a32a19 已说明），原"工作量小"结论更正为"大"，issue #108 跟踪 | 未执行（报告已更正） |
| ③ D1 | 20 处 `as any` 全部消除：类型收紧 14 处（含 PreviewCanvas compareMode 类型链、multicam `in` narrowing）、`createProject` 工厂替换非法 mock 1 处（顺带修复 `timecodeFormat:'hh:mm:ss:ff'` 非法值）、install-mocks 3 处类型化 + 删除无消费方的 `commandManager` 死 mock 键（该键靠 `as any` 绕过 TauriMocks 多余属性检查） | ✅ 三门禁全过 |
| ④ C3 | L1：核实开关已存在（GeneralSettingsPanel.tsx:238）且链路完整，按裁决保留默认值；L2/L3：预设市场/社区特效库改为**进入对应标签页才加载**，新增持久化开关"启用在线内容"（`appSettings.onlineContentEnabled`，**默认关闭**，关闭时仅读本地缓存、绝不发起远程请求）；双面板各加勾选框；中英文案齐备；新增 4 个单测（验证关闭时零网络请求）；更新 1 个 e2e spec | ✅ 三门禁全过（11201 用例）。⚠️ Playwright e2e 套件未在本地执行，spec 改动需 CI 验证 |
| ⑤a A6 | 70 个未使用文件删除（36 无引用 + 34 死簇链：AI 面板链 ×9、AIVideoGeneration ×5、MultiCamera ×4、PluginMarket ×5、barrel ×7、editor-core 三个目录 barrel）。**保留**：waveform-render.worker.ts（AudioWaveformDisplay.tsx:194 `new Worker(new URL())` 动态加载，knip 误报）、docs/developer ×3（docusaurus 独立子项目） | ✅ 三门禁全过 |
| ⑤b A7 | **裁决 a 已执行（2026-08-06 补充核查后）**：首轮删除时验证脚本的 grep 排除条件误伤测试导入行（`../src/core/...` 被过滤自引用用的 `src.core` 模式误排除），"零消费者"误判已更正为"仅被专属测试引用、生产消费者为零"并回滚。补充核查确认：两模块诞生于 2026-07-21 v4.52.0 后实质停更（老代码）；editor-core 主 barrel 未导出且 package.json exports 无 `./core` 子路径/通配（对外不可达）。按用户规则"老代码+未对外导出→删除"，模块连同 2 个专属测试（共 41 用例：17+24）一并删除，独立 commit（见 git log 第 4 个提交） | ✅ 三门禁全过（11160 用例） |
| D2 | 建 issue 跟踪 Rust 并行测试隔离缺陷（19 个信号量测试 PoisonError 级联） | ✅ https://github.com/a137460387/open-factory/issues/111 |

**未执行（维持记录）**：B 组依赖清理（禁改依赖清单）、C1 editor-core 纯度（大）、C2 循环依赖 64 处（大）、C4（issue #108）、E1/E2 覆盖率补测（增量）、G 组云服务包（产品裁决）。

**累计改动**：79 个文件删除 + 1 个移动（SPRINT_P_VERIFICATION.md → docs/）、14 个源文件修改、2 个测试文件新增用例、.gitignore 更新。已提交至分支 `chore/full-audit-2026-08-06`（4 个 commit，见 git log），最终门禁 typecheck/build/test（605 文件 11160 用例）全绿，未 push。
