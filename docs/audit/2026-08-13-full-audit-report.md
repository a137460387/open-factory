# 全量审计报告 — 2026-08-13

- **审计范围**：open-factory 仓库全量（apps/\*、packages/\*、apps/desktop/src-tauri、scripts、tools）
- **审计模式**：阶段一只读检测（未修改任何源码；仅按流程写入本证据/报告文件）
- **规范依据**：`AGENTS.md`（核心架构约束 / 特定模块约束 / 代码风格）
- **证据目录**：`docs/evidence/`（所有工具原始输出已落盘，下文引用格式为 `证据文件 → 行号`）

## 证据文件清单

| 证据文件 | 工具/方法 | 说明 |
|---|---|---|
| `arch-grep-2026-08-13.txt` | grep 批处理（A1–A13c） | 架构合规逐条检测原始输出 |
| `knip-2026-08-13.txt` | `bunx knip --no-progress`（knip.json 配置，include=exports,types） | 未使用导出/类型原始输出（832 行） |
| `knip-deps-2026-08-13.txt` | `bunx knip --include dependencies,devDependencies` | 未使用依赖 + 未使用导出（859 行） |
| `cargo-check-2026-08-13.txt` | `cargo check --workspace`（src-tauri） | Rust 编译警告/死代码（0 警告） |
| `coverage-2026-08-13.txt` | `bun run test`（vitest run --coverage） | 全量测试 + 覆盖率文本报告原始输出 |
| `coverage-low-2026-08-13.txt` | 由 `coverage/lcov.info` 派生（awk） | 低于阈值文件清单（326 个，含分组统计） |
| `quality-rust-unwrap-2026-08-13.txt` | awk 按 `#[cfg(test)]` 行号分类 | Rust unwrap/expect 生产/测试分类 |
| `quality-grep-2026-08-13.txt` | grep | 空 catch / 吞异常 / console.log |
| `debt-grep-2026-08-13.txt` | grep + find + git | TODO/FIXME/HACK、临时文件、git 跟踪状态 |
| `deps-outdated-2026-08-13.txt` | `bun outdated`（root + apps/desktop） | 过期依赖 |
| `deps-workspace-consistency-2026-08-13.txt` | node 脚本比对全部 package.json | workspace 间版本范围不一致 |
| `deps-duplicates-2026-08-13.txt` / `bun-pm-ls-2026-08-13.txt` | `bun pm ls --all` + node 聚合 | 重复版本依赖（837 个包名，56 个多版本） |

**工具失败与替代说明（审计规范第 1 条）**：
1. `cargo check` 首次运行因 shell 重定向顺序错误（`2>&1 > file`）丢失 stderr 警告，已修正为 `> file 2>&1` 并**重新执行**，第二次为有效输出（重编译主 crate 12.07s，0 警告）。
2. knip/ts-prune 未本地安装（knip 不在 devDependencies），改用 `bunx knip`（未修改 package.json）。
3. knip 的 editor-core `project` 模式为 `src/**/*.ts`，**不覆盖 .tsx**，因此 editor-core 中 2 个 .tsx 文件未被 knip 报告（已用 grep 手动补查，见 A-1）。

---

## 一、架构/规范合规（AGENTS.md 逐条对照）

### 通过项 ✅

| 规则 | 结论 | 证据 |
|---|---|---|
| editor-core 不依赖 Tauri | 0 处 `@tauri-apps` 引用 | arch-grep [A1]（L4-5，无匹配） |
| Tauri 调用走 bridge | 全部运行时引用位于 `apps/desktop/src/lib/tauri-bridge/` 或 barrel `tauri-bridge.ts`；`video-gen-runner.ts:1` 为 `import type` 豁免；其余仅测试 mock | arch-grep [A3]/[A3b]（L98-176） |
| Tauri 命令在 lib.rs 注册 | 138 个 `#[tauri::command]`，修正 CRLF 比对误差后 **0 个漏注册**（首次比对因 Windows 换行符全量误报，已复核纠正） | arch-grep [A13]/[A13c]（L795-936） |
| FFmpeg 参数数组、禁 shell 字符串 | 58 处 `Command::new` 全部参数数组形式；`Command::new("cmd"/"sh")` 4 处均在 `#[cfg(test)]` 测试模块（`ffmpeg_semaphore.rs:92,100`、`ffmpeg.rs:5611,5619`，用于生成测试子进程）；导出主路径走 `plan.full_args`（`ffmpeg.rs:188,799,821`）；post-export 脚本为参数数组且有非法字符校验（`ffmpeg.rs:1795-1804`） | arch-grep [A6]/[A6b]（L187-249） |
| 预览不用裸 `file://` | 仅 3 处：测试断言（`update-settings.test.ts:16`）、FCPXML 导入解析注释（`fcpxml-import.ts:296`）、FCPXML 导出生成的媒体引用（`timeline-export.ts:438`，属导出产物格式，非预览） | arch-grep [A4]（L178-181） |
| Timeline 变更走命令对象 | 非命令路径的 `clips/tracks` 原地突变仅 4 处：2 处在 e2e mock（`install-mocks.ts:1686,1757`），2 处在脚本运行时草稿状态（`timeline-script-runtime.ts:180,272`）——后者与 `state.operations` 双轨记录，最终经 `RunScriptCommand` 应用（`SettingsDialog.tsx:4,637`），符合命令对象约束；全仓命令执行调用点 256 处 | arch-grep [A11]/[A11b]/[A11c]（L758-824） |
| 无真实硬编码密钥 | [A8] 命中全部为测试夹具与 i18n 文案；仅 `packages/api-gateway/.env.example`（示例文件） | arch-grep [A8]/[A8b]（L462-501） |

### 违规/风险项 ❌⚠️

**A-1｜editor-core 中的孤儿 React 组件（违规 + 死代码）**
`packages/editor-core/src/macro-panel.tsx:8`、`packages/editor-core/src/node-editor-panel.tsx:8` 直接 `import React`，使用 `window.addEventListener`（node-editor-panel.tsx:460-461）、`window.confirm`/`document.createElement`（macro-panel.tsx:301,318,329）。违反「editor-core 必须纯 TS」。全仓引用扫描：**无任何消费方**（不在 `index.ts` 导出，desktop 未引用），且 editor-core 的 package.json 未声明 react 依赖（仅 `earcut`）。knip 因配置模式漏掉 .tsx 未报告。
证据：arch-grep [A5]（L183-185）、[A2]（L9-13）；grep 复核（会话内执行，命令见阶段一记录）。

**A-2｜editor-core 大面积浏览器 API（架构债务）**
约 20 个文件使用 localStorage / document / navigator.gpu / requestAnimationFrame。已排除 `window`/`document` 局部变量同名误报（audio-rhythm-analysis.ts:436、privacy-redaction.ts:104-107、timeline-virtualization.ts:89-183、text-layout.ts:145、scene-detection.ts:457-466、publish-pipeline.ts:73-79 等为合法局部变量）。真实违规集中在：
- localStorage：`macro-storage.ts:266-286`、`workflow-templates.ts:497-515`、`timeline-sequence-compare.ts:128,137`、`ui/shortcut-manager.ts:341,349`、`ui/theme-engine.ts:1154-1193`、`subtitles/style-presets.ts:185-219`
- document/canvas：`ai/template-io.ts:76-81`、`ui/theme-engine.ts:1112-1124`、`ai/inference-backends.ts:149`、`color/gpu-color-processing.ts:1006`、`engine/smart-proxy-manager.ts:167`、`subtitles/canvas-renderer.ts:276,369`、`plugins/plugin-sandbox.ts:137-280`
- navigator.gpu / hardwareConcurrency（多处带运行时守卫）：`engine/webgpu-render-engine-core.ts:79-635`、`engine/smart-proxy-manager.ts:141-154`、`export/export-scheduler.ts:637`、`ai/ai-worker.ts:446`
- requestAnimationFrame：`timeline-virtualization.ts:146`、`engine/incremental-render-engine.ts:728`

证据：arch-grep [A2]（L7-96）。

**A-3｜仓库内存在与「本地优先」冲突的整套云端/服务包（需人工裁决）**
`packages/auth`（OIDC/SAML SSO）、`packages/rbac`、`packages/audit-log`、`packages/cloud-sync`（OneDrive/WebDAV 个人云）、`packages/api-gateway`（Fastify 网关 + JWT）、`packages/collaboration-server`（WebRTC 中继服务器），外加 web 应用 `apps/creator-dashboard`、`apps/plugin-market`。与 AGENTS.md「禁止登录/云服务依赖」字面冲突；但交叉引用扫描确认：**desktop 主体与这些包零耦合**（仅 vitest.config.ts 收录其测试、alias 配置指向）。疑似独立产品线或休眠模块。
证据：arch-grep [A12]/[A12b]/[A12c]（L767-824, 1149-1155）。

**A-4｜硬编码第三方端点（条款与功能的冲突，需人工裁决）**
生产代码中的外部端点（非测试）：
- AI 供应商目录 13 家 baseUrl：`packages/editor-core/src/ai-service.ts:66-161`
- 字幕翻译 DeepL/Google：`apps/desktop/src/lib/subtitleTranslation.ts:83,108`
- 分发平台 OAuth（YouTube/B站/抖音/小红书）：`packages/editor-core/src/distribution/platform-publisher.ts:127-171`
- 更新器：`apps/desktop/src/updater/update-settings.ts:2-3`
- 预设市场/错误知识库 gist：`preset-market.ts:67`、`ErrorKnowledgeDialog.tsx:29`、`effect-preset-library.ts:56`、`export-presets.ts:104`
- 模型下载 huggingface：`apps/desktop/src-tauri/src/model_downloader/downloader.rs:42-48`、`settings/localModels.ts:38-54`（展示链接）
- 本地回环（合规）：`ai.rs:250,263`（Ollama localhost）、`inference-provider.ts:266`
这些是 AI 辅助/发布/模型下载功能的必要组成，与 AGENTS.md「禁止硬编码云服务端点或第三方 API 地址」字面冲突。
证据：arch-grep [A7]（L251-460）。

**A-5｜文档漂移（低风险）**：AGENTS.md 写「Tauri 调用必须通过 `tauri-bridge.ts`」，实际已演进为 `tauri-bridge.ts` barrel + `tauri-bridge/` 子模块目录（export/media/fs/window/…），语义一致但文档滞后。

---

## 二、死代码

1. **knip（TS）**：未使用导出 **656** 项 + 未使用导出类型 **171** 项 = **827** 项，分布 **113** 个文件（knip.json 仅覆盖 editor-core 与 desktop 两个 workspace、仅 exports/types 维度）。Top 文件：
   | 文件 | 未使用导出数 |
   |---|---|
   | `apps/desktop/src/store/editorFeatureStore.ts` | 108 |
   | `apps/desktop/src/components/Inspector/InspectorEditors.tsx` | 64 |
   | `apps/desktop/src/components/lazyComponents.ts` | 42 |
   | `apps/desktop/src/components/Inspector/CurveEditors.tsx` | 39 |
   | `apps/desktop/src/store/mediaFeatureStore.ts` | 37 |
   | `packages/editor-core/src/export/ffmpeg-builder/project-converter.ts` | 35 |
   | `apps/desktop/src/store/aiFeatureStore.ts` | 26 |
   | `apps/desktop/src/store/timelineFeatureStore.ts` | 24 |
   | `apps/desktop/src/store/editorUIStore.ts` | 19 |
   证据：knip-2026-08-13.txt（段头 L1/L658/L830）；聚合统计见阶段一会话命令输出（awk 按文件计数）。
   **注意**：store 类未使用导出多为拆分重构残留；`lazyComponents.ts` 的导出可能经字符串键动态引用，清理前需逐个验证。
2. **Rust（cargo check）**：主 crate 重新编译检查，**0 警告**（含 dead_code/unused_imports）。证据：cargo-check-2026-08-13.txt（L1-3）。
3. **孤儿文件**：`macro-panel.tsx`、`node-editor-panel.tsx`（见 A-1）；`apps/desktop/src-tauri/src/commands/noise_reduction.rs.bak`（未跟踪，与正式文件差异 780 行，见三-债务）。

---

## 三、依赖

> 约束提示：AGENTS.md 与本次任务指令均禁止修改 `package.json`，因此本节全部项仅「观察/待专项批准」。

1. **未使用依赖（knip）**：dependencies **11** 个 + devDependencies **10** 个。证据：knip-deps-2026-08-13.txt（L1-23）。
   - 高置信：`onnxruntime-web`、`sharp`（ai-generator）；`winston`（audit-log）；`jsonwebtoken/passport/openid-client`（auth，与其休眠状态一致）；`chalk`（cli）；`date-fns`（creator-dashboard）；`@open-factory/plugin-sdk`（plugin-market）；`@radix-ui/react-dropdown-menu`、`@radix-ui/react-tooltip`（desktop）
   - **疑似误报需复核**：`tailwindcss`、`tw-animate-css`（desktop devDeps）——实际经 `@tailwindcss/vite` 插件与 CSS import 消费，knip 不跟踪 CSS（见其 Configuration hint：`.css Compiled extension excluded`）
2. **workspace 版本不一致：13 个依赖**。最重：`react`/`react-dom`（plugin-market ^18.3.0 vs 其余 ^19.1.0）、`tailwindcss`（3.4 vs 4）、`@types/node`（^20/^20.14/^22/^26.1.1 四种）、`typescript`（^5.3–^5.8.3）、`@vitest/coverage-v8`（^1.0.0 vs ^3.2.7）。证据：deps-workspace-consistency-2026-08-13.txt。
3. **重复版本：56 个包名存在多版本**（依赖树共 837 个包名）。直接源于上述分裂：`react` 18.3.1+19.2.7、`react-dom`、`scheduler` 0.23.2+0.27.0、`@types/react`、`tailwindcss` 3.4.19+4.3.2、`vite` 6.4.3+7.3.5、`@vitest/coverage-v8` 1.6.1+3.2.7、`@types/node` 三版本；其余为常见传递性重复（glob/minimatch/semver 等，低风险）。证据：deps-duplicates-2026-08-13.txt。
4. **过期大版本**：`typescript` 5.9.3→7.0.2、`vitest`+`@vitest/coverage-v8` 3.2.7→4.1.10、`eslint`+`@eslint/js` 9→10、`vite` 6.4.3→8.2.1、`@vitejs/plugin-react` 4.7.0→6.0.5、`eslint-plugin-react-hooks` 5.2.0→7.1.1、`jsdom` 29→30、`@testing-library/jest-dom` 6→7、`lucide-react` 0.468→1.31.0（desktop）。证据：deps-outdated-2026-08-13.txt。

---

## 四、代码质量红线

1. **Rust 生产代码 unwrap/expect：0 处**（275 处全部位于 `#[cfg(test)]` 模块；原始 grep 总数 275 与分类结果交叉核对一致）。证据：quality-rust-unwrap-2026-08-13.txt。
2. **`as any`**：非测试生产代码仅 **6** 处：`apps/creator-dashboard/src/hooks/useCreator.ts:59`、`apps/creator-dashboard/src/lib/api.ts:11`、`packages/api-gateway/src/middleware/auth.ts:57,61,68,72`（均位于云端/web 包；desktop 生产代码 0 处）。测试代码约 242 处（测试夹具，暂不处置）。证据：arch-grep [A9]（L503-751）/ [A9b]。
3. **空 catch 块：0 处**。证据：quality-grep [Q1]。
4. **吞异常**：`apps/desktop/src/video-gen/video-gen-runner.ts:86,101,147` 共 3 处 `.catch(() => {})`；仓库已有 `apps/desktop/src/lib/error-handlers.ts` 工具正是为替换此模式而写。证据：quality-grep [Q2]。
5. **console.log**：非测试源码 8 处，全部为字符串字面量（脚本示例，`timeline-scripting.ts:76-124`）或沙箱 console 桥接（`plugin-sandbox.ts:274`），无真实残留。证据：quality-grep [Q3]。

---

## 五、测试缺口

- **总体**：612 个测试文件 / **11193 通过 + 3 跳过 / 0 失败**；全量行覆盖 72.88%（All files）；vitest 全局 thresholds 通过（EXIT=0）。证据：coverage-2026-08-13.txt（汇总行）。
- **文件级缺口：326 个文件低于其阈值**（editor-core 80% / 其余 70%）：apps/desktop **200**、editor-core **94**、plugin-sdk **1**、其他包 **31**（合计 326，分组统计已交叉核对）。证据：coverage-low-2026-08-13.txt。
- **关键路径 0% 覆盖（优先补测）**：
  - desktop 编排层 hooks 全军覆没：`useEditorShellCallbacks/DerivedState/Effects/Interactions/Orchestrator/Settings/StoreSubscriptions` 等 15+ 个 `useEditorShell*`（0%）
  - 时间线/画布核心：`useTimelineState.ts`、`useCanvasRenderer.ts`、`useCanvasInteraction.ts`（0%）
  - 渲染/发布：`webgl-transition-renderer.ts`（0%）、`publish-pipeline-runner.ts`（0%）、`lazyComponents.ts`（0%）
  - editor-core 面板类：`quality/panel.ts`（7.43%）、`resources/panel.ts`（7.17%）、`subtitles/index.ts`（0%）
  - 其他包：`rbac/index.ts`（0%）、`collaboration/settings.ts`（0%）
- 说明：全局阈值之所以通过，是因 thresholds 按目录聚合稀释；文件级缺口不影响当前 CI，但上述核心交互路径无回归保护。

---

## 六、债务清单

1. **标记**：TODO **4** 处（全部为缓存命中率跟踪）：`engine/incremental-render-engine.ts:539`、`engine/smart-proxy-manager.ts:750,754`、`engine/render-pipeline.ts:163`；FIXME/HACK/XXX/WORKAROUND **0**。证据：debt-grep [D1]/[D2]。
2. **遗留文件**：
   - `apps/desktop/src-tauri/src/commands/noise_reduction.rs.bak` — 未跟踪备份文件，与正式文件差异 780 行。证据：debt-grep [D3]。
   - `.logs/`（goal-evaluator.log 3.9MB、goal-lifecycle.log 277KB）— **未被 gitignore 且未跟踪**，存在误提交风险。证据：debt-grep [D4]。
   - `hw-decode-benchmark-report.json` — 本地基准产物（已 ignored，观察即可）。
3. 其他根目录项均为正常跟踪内容（budget.json 为 check:bundle 预算、ltx-video-service 为 Python 推理服务组件、examples/docker/test-data 为资料目录）。

---

## 处置清单（阶段三候选）

> 风险等级：高=涉及架构方向或需人工裁决；中=需分批谨慎验证；低=可安全执行。
> **未经批准不得执行任何项。**

| # | 目标路径 | 证据引用 | 风险 | 建议动作 |
|---|---|---|---|---|
| 1 | `apps/desktop/src-tauri/src/commands/noise_reduction.rs.bak` | debt-grep [D3]；diff 780 行 | 低 | **删除**（未跟踪，先人工确认内容无保留价值） |
| 2 | `.logs/`（2 个日志文件） | debt-grep [D4] | 低 | **删除 + 在 .gitignore 增加 `.logs/`** |
| 3 | `video-gen-runner.ts:86,101,147` 吞异常 | quality-grep [Q2] | 低 | **修复**：改用现有 `lib/error-handlers.ts` 记录日志的 catch 处理器 |
| 4 | `packages/editor-core/src/macro-panel.tsx`、`node-editor-panel.tsx` | arch-grep [A2]/[A5]；引用扫描为空 | 中 | **删除**（孤儿 + 违反纯 TS + 未声明 react 依赖；删除后跑 typecheck/test 验证） |
| 5 | knip.json editor-core project 模式补 `.tsx` | 阶段一工具失败说明第 3 条 | 低 | **修复**（配置文件，非 package.json） |
| 6 | knip 827 项未使用导出（分批：先 store 系 editorFeatureStore 108 项等，再 Inspector 组件，最后 editor-core） | knip-2026-08-13.txt 全文 | 中 | **修复（分批）**：每批前 grep 验证无动态引用（尤其 lazyComponents.ts），每批后 typecheck+test |
| 7 | `useCreator.ts:59`、`api.ts:11`、`api-gateway/middleware/auth.ts:57,61,68,72` 的 `as any` | arch-grep [A9b] | 低 | **修复**：换具体类型（位于 web/云端包，若 #10 裁决为保留则执行） |
| 8 | editor-core 浏览器 API（localStorage/document 等约 20 文件） | arch-grep [A2] | 中 | **修复（长期重构）**：存储/渲染适配层下沉 desktop 或注入抽象；本次仅列观察，不实施 |
| 9 | 关键路径 0% 覆盖补测（useEditorShell\* 编排层、useTimelineState、webgl-transition-renderer、publish-pipeline-runner 等） | coverage-low-2026-08-13.txt | 中 | **修复（分批补测）**：优先时间线/编排核心 |
| 10 | auth/rbac/api-gateway/audit-log/cloud-sync/collaboration-server + creator-dashboard/plugin-market 的存废 | arch-grep [A12] | 高 | **人工裁决**：独立产品线保留（在 AGENTS.md 明确边界）或整体移除；未裁决前不动 |
| 11 | 硬编码第三方端点（AI 目录/翻译/分发/更新器/预设市场） | arch-grep [A7] | 高 | **人工裁决**：修订 AGENTS.md 条款边界（区分遥测/登录 vs 用户主动在线功能），或端点配置化 |
| 12 | AGENTS.md 中 tauri-bridge 表述更新为目录+barrel | arch-grep [A3] | 低 | **修复（文档）** |
| 13 | TODO ×4（缓存命中率跟踪） | debt-grep [D2] | 低 | **保留观察**（功能性 TODO，非阻塞） |
| 14 | 未使用依赖 21 个（含 tailwind 误报复核） | knip-deps L1-23 | 中 | **观察/专项批准**：涉及 package.json 修改，本阶段禁止；先人工复核 tailwindcss/tw-animate-css 误报 |
| 15 | workspace 版本统一（react 18→19 分裂为首）+ 重复版本收敛 | deps-workspace-consistency / deps-duplicates | 中 | **观察/专项任务**：涉及 package.json，另立升级专项 |
| 16 | 过期大版本（vitest 4、eslint 10、ts 7、vite 8 等） | deps-outdated | 中 | **观察/专项任务**：大版本升级需独立验证 |

## 数字一致性核对（审计规范第 3 条）

- knip：656（exports）+171（types）=827，与段头计数一致（knip-2026-08-13.txt L1/L658）。
- Rust unwrap/expect：原始 grep 275 = 生产 0 + 测试模块 275，交叉核对一致。
- 覆盖率缺口：200+94+1+31=326，与明细行数一致。
- Tauri 命令：138 个定义；A13b 首次报告 138 个"漏注册"为 CRLF 比对误差，A13c 复核为 0，两数字冲突已定位根因并采信复核结果。
- as any：总计 248（测试 242 + 生产 6）。

## 阶段三执行守则（预设）

- 仅执行上表中获批准项；按批次：①低风险删除/修复（#1-3）→ ②孤儿组件与配置（#4-5）→ ③其余按批准范围。
- 每批完成后运行 `bun run typecheck` + `bun run test`（必要时 `bun run build`），通过后再进下一批。
- 每项操作前 grep/读文件二次确认目标存在，并与证据文件核对；写操作前先用只读命令核实状态。
- 不修改任何 `package.json`/`Cargo.toml`；不全仓格式化；收到暂停指令立即停在最小操作单元。

---

## 阶段三执行记录（2026-08-13，批准范围：低风险批 #1/#2/#3/#5 + #4 + #12）

### 批次①（#1/#2/#3/#5）— 已完成并验证
| 项 | 执行内容 | 前置核实 | 结果 |
|---|---|---|---|
| #1 | 删除 `apps/desktop/src-tauri/src/commands/noise_reduction.rs.bak`（14275 字节，未跟踪） | 存在性✓；`git ls-files` 仅正式 .rs✓；全仓无引用✓；`mod.rs:17` 声明的是 `noise_reduction`✓ | 已删除 |
| #2 | 删除 `.logs/`（goal-evaluator.log 3.9MB + goal-lifecycle.log 277KB）；`.gitignore` "Logs and error output" 段新增 `.logs/` | 目录内容与未忽略状态核实✓ | 已删除+已忽略 |
| #3 | `video-gen-runner.ts:86,101,147` 三处 `.catch(() => {})` 改为 `.catch(silentError('…'))`，新增 `import { silentError } from '../lib/error-handlers'` | 三处位置读文件确认✓；复用现有 error-handlers 工具✓ | 已修复，残留 0 |
| #5 | `knip.json` editor-core project：`src/**/*.ts` → `src/**/*.{ts,tsx}` | — | 已修复 |

验证：`bun run typecheck` EXIT=0；`bun run test` EXIT=0（612 文件 / 11193 通过 + 3 跳过，与基线一致）。

### 批次②（#4）— 已完成并验证
- 删除 `packages/editor-core/src/macro-panel.tsx`（21953 字节）与 `packages/editor-core/src/node-editor-panel.tsx`（30042 字节）。
- 前置核实：两文件存在✓；均为 git 跟踪✓；全仓 src 引用扫描为空（dist 命中为已忽略的陈旧构建产物）✓；`index.ts` 未导出✓；`tsconfig.build.json` 仅排除 `__tests__`，无显式包含✓；两文件仅单向 import 兄弟模块（macro-types/macro-storage/macro-playback、node-editor-types/node-editor-engine/workflow-executor/workflow-templates），无反向依赖✓。
- 验证：typecheck EXIT=0；test EXIT=0（612/11193+3 跳过，与基线一致）。

### 批次③（#12）— 已完成并验证
- `AGENTS.md` 两处更新：「架构约束」与「Tauri Bridge 约束」改为描述 barrel（`tauri-bridge.ts`）+ 子模块目录（`tauri-bridge/`）结构；如实标注 audio-visual-analysis、ipc-optimizer 为按子模块路径直接引用的例外（核对 `tauri-bridge.ts` barrel 实际导出列表后修正措辞）。
- 最终验证（覆盖三批全部改动）：typecheck EXIT=0；test EXIT=0（612/11193+3）；`bun run build` EXIT=0（50.27s）。

### 未执行项（未批准或受限，保持原状）
- #6 死导出清理、#7 web 包 as any、#8 editor-core 浏览器 API、#9 补测、#13 TODO：未批准/建议观察。
- #10 云端包群存废、#11 硬编码端点条款边界：待人工裁决。
- #14/#15/#16 依赖类：涉 package.json 修改，本阶段禁止。

