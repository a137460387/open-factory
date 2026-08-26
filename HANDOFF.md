# HANDOFF.md — 工作交接文档

> 更新时间：2026-08-26 | 基线：main = `5183ae89`（PR #175 merge）| 版本：v4.75.0（已发布，tag 指向 bump 提交 `39e7cf74`，Release 标题「v4.75.0 智能粗剪」，三平台 6 资产）

---

## 1. 项目背景和目标

**open-factory** 是本地优先（local-first）的桌面视频编辑器，技术栈：React 19 + TypeScript + Vite + Tauri 2（Rust）+ Zustand + Bun monorepo（`apps/*` + `packages/*`）。核心约束见 `AGENTS.md`（本地优先判定、Timeline 命令对象、tauri-bridge 层、Store 按功能域拆分等）。

本交接覆盖的工作线（按时间顺序）：

1. **v4.74.1 patch 发布 + CI 基建稳定性专项**（已完成，2026-08-22 前收尾）：三轮 CI 修复解锁 frontend 徽章与 coverage 产出，为 v4.75 主线决策提供数据——历史摘录见 2.1
2. **P0-1 覆盖率攻坚专项**（已结项，2026-08-24）：desktop 覆盖 47.68% → 72.65%，一期预估"70% 需 4-5 期"按期达成并留 2.65pp 缓冲——详见 2.2
3. **P1-2 Smart Rough-Cut 主线**（已结项，2026-08-26）：M1 结构拆分 → M1b 提案对比接活 → M2 参数化，三阶段全部合入——详见 2.3
4. **v4.75.0 发版 + P2 前置桥接**（已合入，2026-08-26）：#173 发版 / #174 发版工作流文档 / #175 转写文本→语义引擎桥接，P2 由 no-go 转 go——详见 2.4

---

## 2. 已完成的事项（含关键决策与原因）

### 2.1 历史工作线摘录（2026-08-22 及之前）

- **v4.74.1 发布链**（PR #156）：--no-ff merge + 三文件 bump（根 package.json / Cargo.toml / tauri.conf.json）+ lightweight tag 打在 bump 提交 + `gh release edit` 校正标题；v4.73.1 轻量 hotfix 不可作发布惯例基准（实际基准 = v4.25.1 + v4.74.0 组合）
- **CI 基建三轮修复**：
  - PR #157：fast-uri GHSA 用扁平 override（bun 1.3.14 不支持嵌套/range-selector overrides）；h2 RUSTSEC 真修复并移除 audit.toml 豁免；e2e timeout 20→50 分钟
  - PR #158：brace-expansion override 移除（各链自然解析 semver 兼容，audit 0 漏洞）；performance 1000 clips CI 预算放宽；audit-logger tampered-hash flaky 根因修复——merge 后 e2e 历史首次全绿
  - PR #159：i18n 环境差异根因修复（Node 全局 navigator 跟随 OS locale + setLanguageAsync 相等早退不加载 en-overrides）——CI coverage 首次生成
- **e2e 时序加固**（PR #161）：timeout 50→60 分钟、关键 spec 15s 可见性等待、AI mock 400ms 延迟——后续连续多轮全绿的基础
- 此前 frontend job 的 2 个 unhandled rejection 基线已消除（当前全量 exit 0）

### 2.2 P0-1 覆盖率攻坚（结项）

**推进轨迹**（desktop 整体，口径 B = lcov 排除 `apps/desktop/src/e2e/**`）：

| 阶段 | PR | 覆盖 | 主要内容 |
|---|---|---|---|
| 一期（勘察） | — | — | 分域可测性分级；预估 70% 需 4-5 期 |
| 二期 | #162 | 58.85% | Timeline 工厂直调模式铺开 |
| 三期 | #163 | 63.49% | Timeline + Inspector 288 用例 |
| 四期-A | #164 | 66.74% | preview 核心 9 文件（renderer/text/video/hw-decode/render-cache 等） |
| 四期-B | #165 | 70.01% | export/hooks 2 文件 + audio-renderer + gpu-acceleration |
| 五期 | #166 | 72.65% | tauri-bridge 7 桥 + store 洼地 8 文件 + cache-service |

**域覆盖终态**：

| 域 | 覆盖 | 来源期次 |
|---|---|---|
| Timeline | 93.55% | 一-二期 |
| Inspector | 94.44% | 二期 |
| preview 域 | 59.36%（四期-A 时点；核心 9 文件 82-100%，四期-B 另补 audio-renderer 88.66% / gpu-acceleration 97.36%） | 四期-A |
| export/hooks | 84.86% | 四期-B |
| tauri-bridge（7 桥接文件） | 89.61% | 五期 |
| store 洼地 8 文件 | 87-100% | 五期 |
| cache-service | 95.78% | 五期 |

**不入期决策登记**（复核时按理由重估）：

| 目标 | 决策期次 | 理由 |
|---|---|---|
| workers/collaboration | 一期 | Worker/协作宿主桩 ROI 低 |
| webgl-compositor（1178 行，11.63%） | 四期-B | ~600 行 GLSL 字符串 + 类方法需完整 GL 上下文 mock，ROI 低；长期候选 = Playwright 截图对比路径 |
| workers 9 文件 550 行 | 五期维持 | 消息循环宿主桩，与一期同因 |

### 2.3 P1-2 Smart Rough-Cut 主线（结项）

**推进轨迹**（基线 ec769bb4 = #150 退役一键编排器后，分步路径为唯一入口）：

| 阶段 | PR | merge commit | 主要内容 |
|---|---|---|---|
| M1 结构拆分 | #169 | `80ea5ece` | SmartRoughCutStepPanel 830 行 → 466 行纯渲染 + `useSmartRoughCut`（414 行 hook）+ `smart-rough-cut-utils`（99 行），行为等价（effect deps/memo deps/getState 非响应式读取逐字搬移，e2e 契约零变更） |
| M1b 提案对比接活 | #170 | `de806e12` | RoughCutComparePanel 影子功能转正：`useRoughCutAnalysis`（contentAnalysis 派生 highlights/onsets，D1-B 决策）+ `ApplyRoughCutProposalCommand`（core 命令，ripple 删间隙 + undo/redo）+ EditorShell stub 接线；未分析 clip 入口禁用（Step 1B 限制） |
| M2 参数化 + 联动 | #171 | `72206d66` | 5 检测参数状态化（sceneThreshold 0.3 / silenceMinDb -40 / silenceMinDuration 0.5 / silenceMargin 0.1 / dialogueSensitivity 'medium'，默认值=原硬编码零回归）+ ParamSlider/segmented 控件（disabled 联动 anyRunning）+ 结果项 hover playhead 联动 |

**累计**：16 文件 +2335/-424（`git diff ec769bb4..72206d66` 实测；逐 PR 合计 +2341/-430）；SmartRoughCut 域单测 3 → 76 用例（utils 27 + hook 29 + 面板 5 + core 命令 5 + state 3 + Compare hook 7）；e2e 531 → 534（rough-cut-compare.spec 2 例 + smart-rough-cut.spec 新增 2 例，既有 3 例零改动）；desktop 覆盖（口径 B）72.84%（ec769bb4 实测）→ 73.04%（+0.20pp，三阶段全程无回落）；三阶段 CI 全绿零 flaky。

**关键决策存档**：
- D1-B：Compare 数据源走 contentAnalysis 派生（帧采样留后续增强）；onsets 从 segments.loudness 上升沿 + dialogueTurns 起点派生，不调 bridge
- D2-A：检测参数 hook 本地 state（会话级），不新增 store
- D3/D4：语义智能建议（M3）与批量处理留 P2——M3 启动前提 = whisper 转写可用性 + contentAnalysis dialogueTurns 覆盖率达可用阈值（待勘察）

### 2.4 v4.75.0 发版 + P2 前置桥接（main 推进 3 PR）

**推进轨迹**（自 #172 HANDOFF 归档点 72206d66 起）：

| PR | merge commit | 主要内容 |
|---|---|---|
| #173 | `70cf89d8` | v4.75.0 发版：三文件 bump（4.74.1→4.75.0，Cargo.lock 经 `cargo update -w --offline` 同步）+ CHANGELOG（Features/Bug Fixes/Refactor/Tests/Docs 分组）；bump 提交 `39e7cf74`；lightweight tag v4.75.0 触发 release.yml 三平台构建自动建 Release（6 资产），`gh release edit` 校正标题「v4.75.0 智能粗剪」并替换 notes；CI 全绿（e2e 534 passed） |
| #174 | `f8eece75` | RELEASING.md 发版工作流文档（97 行）：固化三处既有惯例——lightweight tag 打 bump 提交 / release.yml 自动建 + edit 校正 / merge 信息 `release:` 前缀 |
| #175 | `5183ae89` | P2 前置桥接管线：`collectSubtitleTranscriptForClip`（subtitle 轨按 clip 范围收集 text + 时间对齐，1e-6 容差）+ `useTranscriptForClip` hook（组装 `(transcript, timeAlignment)` 调用 understandSpeech）+ `useSmartRoughCut` 返回值 `speechUnderstanding` 扩展位；4 文件 +260 行，新 hook 覆盖率 100%，e2e 534 零回归 |

**P2 no-go → go 转折点记录**：

1. **勘察结论 no-go**（2026-08-26，P1-2 结项后）：M3 语义建议需"带时间对齐的转写文本"，两个前置数据可用性评估均不达标——whisper 转写管线真实可用但转写文本不回流 contentAnalysis；contentAnalysis dialogueTurns 产出率 54% 但零语义能力（纯能量启发式，无文本输入）；唯一语义引擎 understandSpeech 沉睡在 core，smart-creation-orchestrator 因 `aiAnalysis.transcript` 字段不存在而恒空转
2. **桥接补齐**（PR #175）：不动 understandSpeech 内部实现（沉睡资产激活而非重写）、不动 whisper.rs（转写管线已可用，只接其产物），从时间线 subtitle 轨直读 whisper 产物组装入参
3. **go 判定**：understandSpeech 已激活，`speechUnderstanding`（含 keywords/topics/narrativeMarkers/summary + ready 就绪信号）可从 `useSmartRoughCut` 直接消费——M3 启动的数据前提已补齐

**M3 待决策项**（启动前需决策，勘察项 3 已定位挂载点两处均现成）：

- **挂载点**：SmartRoughCutStepPanel 扩展位（M1 拆分预留，面板头注释明示模式）vs RoughCutComparePanel 路径（Compare 已有 contentAnalysis 数据就绪门控模式可类比）
- **产品形态**：基于叙事标记的粗剪建议列表——understanding 产出的 narrativeMarkers（opening/rising/**climax**/falling/ending）天然适配"高光优先"式建议，keywords/topics 可作建议的语义注脚 vs 其他形态
- **数据就绪信号复用**：`speechUnderstanding.ready` 是否作为 M3 入口门控（类比 Compare 入口依赖 contentAnalysis 的模式：未分析 clip 入口禁用）

**观察池追加**（勘察发现，不在 M3 范围）：ASRStage worker 请求参数空占位未接线；VAD 纯音乐误报 30s"对话轮"（能量启发式天花板）

---

## 3. 当前状态

**位置**：main = `5183ae89`（PR #175 merge），工作区干净，专项分支全部删除。v4.75.0 已发布（tag 指向 bump 提交 `39e7cf74`）。P2 桥接管线已合入，M3 语义建议数据前提就绪（no-go → go，见 2.4），启动前待决策项见 2.4。

**基线数据**：

- desktop 覆盖（口径 B）= **73.02%（CI #175 artifact 实测，桥接合入后）**；历史本地-CI 偏差 ≤0.04pp 稳定规律（CI artifact lcov 可下载复核）
- 全量单测：670 文件全过 exit 0（12390 passed + 3 skipped，含桥接 +7），~150s，无 unhandled rejection
- e2e：534 用例零回归（#175 CI 一次全绿，42.3m）；最近一轮 534 passed
- typecheck 0 错误；coverage 稳定生成

---

## 4. 待办与观察池

### 4.1 按需补漏清单（非专项，遇改即测）

- store 三件：editorStore 25.07% / performanceMonitorStore 24.68% / editorFeatureStore 58.88%
- 深水区：color-grading / scripting / plugins / media
- renderer.ts 剩余 144 行 WebGL 深交互路径
- ltx-video downloadModel/deleteModel 浏览器回退缺失（缺 isTauriRuntime 检查，小缺陷候选）

### 4.2 观察池（全量刷新，含来源期次）

| 观察项 | 来源期次 | 说明 |
|---|---|---|
| e2e flaky：nested-sequence-export | e2e 多轮观察 | 间歇性，常规监控 |
| e2e flaky：ai-multicam-cut / credits-roll-drawtext | 四期-B 后第 6 轮 | 单次环境归因，低优先（第 7 轮已一次通过） |
| 慢 runner noisy-neighbor | e2e 稳定性专项 | 定性不变，timeout 余量约 49% |
| getClipSpeed 重复实现 | 二期 | ai-features.ts vs editor-core |
| useClipInspectorState 拆分重构候选 | 三期 | hook 结构过大 |
| generateSubtitles store 引用一致性 | 二期 | — |
| removeAnomaly 边界 | 二期 | 边界条件未定义 |
| vi.clearAllMocks / mockIPC clearMocks 基建纪律 | 四期-B / 五期 | resetAllMocks 防跨测试泄漏；mockIPC clearMocks 不删 `__TAURI_INTERNALS__` 本体，测浏览器回退需手动 delete |
| subtitle 定位 y 双重偏移 | 四期-A | text-renderer，潜在产品缺陷待定 |
| checkAppUpdate 依赖 plugin-updater null 契约 | 五期 | plugin 大版本升级时复核 |
| runPipeline 测试桩依赖 enqueueExport 返回结构 | 四期-B | 返回结构变化需同步桩 |
| syncExportPresetsWithWebdav 错误传播隐晦 | 四期-B | getText 失败内部捕获，仅 putText 失败外显 |
| estimateTextureBytes(NaN) 保守归一 | 四期-B | NaN 污染整积归一为 1，保守设计 |
| relaunch 命名差异 | 五期 | 实际命令为 plugin:process\|restart |
| fast-uri override / release.yml 标题 / audit.toml 豁免复核 | CI 基建专项 | 上游更新后逐项清理 |
| ASRStage worker 请求参数空占位未接线 | P2 勘察（2026-08-26） | 不在 M3 范围 |
| VAD 纯音乐误报 30s"对话轮" | P2 勘察（2026-08-26） | 能量启发式天花板 |

---

## 5. 重要的文件路径和约定

### 5.1 CI 结构（`.github/workflows/`）

- `ci.yml`：changes（paths-filter）→ rust（required，含 cargo-audit）+ frontend（bun audit → typecheck → vitest --coverage）+ e2e（playwright，timeout 60 分钟 × retry 2）+ security-scan（仅 schedule）
- `release.yml`：`on: push: tags: 'v*'`，tauri-action 三平台构建自动建 Release
- **audit 豁免机制**：`apps/desktop/src-tauri/.cargo/audit.toml`（每条豁免须附风险评估注释 + 升级待办）

### 5.2 发布流程惯例（v4.74.1 确立，v4.75.0 沿用）

> 详细工作流已固化为 `RELEASING.md`（PR #174）。

1. fix 分支 --no-ff merge 进 main（信息 `release: vX.Y.Z <中文标题>`）
2. bump 三文件 + CHANGELOG 条目 + bump 提交（`chore: bump version to vX.Y.Z`）
3. check:release 验证（smoke:golden 必须 exit 0；smoke:preview/cancel 失败为 main 既有可忽略）
4. lightweight tag 打在 bump 提交上，显式推送（**勿用 --follow-tags**，会静默漏掉 lightweight tag）
5. tag 触发 release.yml 自动建 Release → `gh release edit` 校正标题（仓库惯例：纯版本号或 `vX.Y.Z 主题`）+ notes-file 替换为 CHANGELOG 提取内容
6. main 入库必须走 PR（分支保护），gh pr create → 等 rust 过 → `gh pr merge --merge --delete-branch`

### 5.3 测试基线（当前健康度）

- 全量单测：670 文件全过 exit 0（12390 passed + 3 skipped），~150s，无 unhandled rejection
- 全量 e2e：534 用例，CI 单轮 28-45 分钟（慢 runner 区间），#175 一轮全绿零 flaky
- 覆盖率：desktop（口径 B）73.02% CI #175 artifact 实测（历史本地-CI 偏差 ≤0.04pp）；editor-core thresholds 80% 无违规
- vitest 默认 `reportOnFailure=false`：**测试失败时 coverage 不生成**（CI coverage 依赖测试全绿）

### 5.4 长命令执行方式（TRAE 终端约束）

- 超过 5 分钟的命令必须用 **schtasks 计划任务模式**（`/create` + `/run` + 日志重定向文件 + 轮询 + 事后 `/delete`）
- Start-Process 分离进程会被终端连树回收（约 15 分钟）；脚本必须**纯 ASCII**（PowerShell 5.1 解析无 BOM UTF-8 中文 .ps1 会乱码致语法错误）
- PR body 含中文/引号时用 `--body-file`（命令行内联转义不可靠）

### 5.5 关键模块路径与工具存档

| 类别 | 路径 |
|---|---|
| e2e mock 基建 | `apps/desktop/src/e2e/install-mocks.ts`（VITE_E2E=true 时 main.tsx 动态加载） |
| playwright 配置 | `apps/desktop/playwright.config.ts`（webServer 注入 VITE_E2E、CI retries=2） |
| 覆盖率配置 | 根 `vitest.config.ts`（thresholds：editor-core glob 80%、全局 70%；coverage 排除 `apps/desktop/src/e2e/**`） |
| **覆盖率统计脚本（存档复用）** | `.git/coverage-stats.cjs`（本地 lcov 聚合：desktop 口径 B + preview 逐文件）；另 `.git/phase5-survey.cjs`（tauri-bridge/store/workers/cache 四域分域统计） |
| 项目记忆 | `c:\Users\luoguangyu\.trae-cn\memory\projects\-d-code-Ai-open-factory--p2-ce08563aa2e9a1157684\project_memory.md` |

**成熟测试模式五套**（新测试优先套用）：

1. **工厂直调**：`createXxxHandlers(...)` 直接调用（Timeline/Inspector 9 文件确立）
2. **renderHook + vi.mock store**：props 必须在 renderHook 外创建（引用稳定），否则 project 每渲染为新对象会触发派生效果无限重渲染（export/hooks 教训）
3. **beforeEach mockReset/resetAllMocks**：防跨测试 mock 实现泄漏（Inspector 确立，四期-B/五期沿用）
4. **纯计算函数直调**（preview 四期-A 确立）
5. **Fake Web Audio 上下文**断言节点参数与调用序列（audio-renderer）+ **mockIPC 拦截 invoke** 断言 command/参数/三分支（tauri-bridge 五期确立）

### 5.6 工作约束（来自用户）

- 授权全部本地 git 操作（含 merge/tag）；允许 push main 与既有 tag；PR 工作流分支按既定流程推送；**禁止 force push**；main 直推被分支保护拦截，必须走 PR（required check `rust` + 0 approvals 可自 merge）
- cargo 一律 `--offline` 或 `CARGO_NET_OFFLINE=true`（依赖升级任务明确授权在线时除外）
- 与预期不符立即停止该步如实报告，不猜测不绕行
- 发现其它缺陷只记录不修（单提交原则）
- Conventional Commits 中文描述
