# smart-rough-cut 系列（×3）新 orchestrator 重写——调研与设计方案

日期：2026-08-11
状态：调研 + 设计方案（本轮不产生任何生产代码改动）
关联：issue #114 剩余 8 项产品决策类失败中的 smart-rough-cut.spec.ts ×3

---

## 1. 现有代码调研结论（现状、完成度、可复用程度）

### 1.1 两套面板并存，接线指向了与行为规格不符的那一套

| 面板 | 文件 | 规模 | UX 形态 | 当前状态 |
|---|---|---|---|---|
| **SmartRoughCutPanel**（分步面板） | `apps/desktop/src/components/SmartRoughCut/SmartRoughCutPanel.tsx` | 824 行 | 分步执行：scene/silence/whisper/dialogue/broll/rhythm 各自独立按钮 + 状态徽标 + 结果预览 + 选中应用；tabs（basic/dialogue/broll/rhythm）；累计报告 | **孤儿**：仅存 lazy import（ShellRightPanel.tsx:20、lazyComponents.ts:5），**不被渲染** |
| **SmartRoughCutOrchestratorPanel**（一键编排面板） | 同目录 `SmartRoughCutOrchestratorPanel.tsx` | 408 行 | 一键运行全部分析 → 建议列表 → 一键应用；根 testid 为 `smart-rough-cut-orchestrator-panel` | **当前挂载**：ShellRightPanel.tsx:290-291，`smartRoughCutOpen` 时渲染 |

接线切换点：commit `1ff08c92`（v4.27.0，2026-07-16，"智能粗剪面板与导出性能升级"）引入一键编排面板并把 ShellRightPanel 接线从分步面板切到编排面板。spec 的 3 个用例写于切换之前（d9c1dc7d/f4a6c093/a0cd7915 时期），针对的是分步面板的行为契约。

### 1.2 分步面板（SmartRoughCutPanel）完成度：与 spec 逐点吻合

该面板通过 `SmartStep`（渲染 `${testId}-status`（含 `data-status`）与 `${testId}-button`）和 `SelectableResultList`（渲染 `${testId}-preview`/`-apply-button`/`-select-all`/`-select-none`）组合出 spec 要求的全部 testid；`smart-scene-item-${id}`/`smart-scene-checkbox-${id}`、tabs（`smart-rough-cut-tab-${tab}`，含 dialogue）、`smart-rough-cut-report` 均存在。

i18n 字符串与 spec 断言逐字匹配（strings.ts:3046-3064）：
- `scenePreview([t])` → "检测到 N 个切点：…"（含 spec 期望的"检测到 1 个切点"）
- `silencePreview(n, d)` → "将删除 N 段静音，合计 …s。"
- `report(...)` → "…生成 N 条字幕 / M 个对话 clip / …"

### 1.3 三个检测步骤的后端与 mock：全部现成，无需新写

| 步骤 | 检测实现 | e2e 下的数据来源 | 现状 |
|---|---|---|---|
| 场景检测 | `detectSceneChanges`（tauri-bridge invoke） | install-mocks.ts:1134-1147 直接返回 `mockSceneTimes`（默认 `[1]`，`setSceneDetectionTimes` 可注入） | ✅ 完整 |
| 静音检测 | `detectClipSilence`（lib/silenceDetection.ts，浏览器内 WebAudio 真实解码分析） | fixture 的 silence-pattern.wav（install-mocks.ts:7909 生成：2.5s，仅 [1.0,1.5) 静音）→ 恰好 1 段静音 | ✅ 完整（真实算法 + mock 音源） |
| Whisper | `getWhisperAvailability`（fsExists 校验可执行文件+模型路径）+ `buildWhisperSubtitleTrackForClip` → `runWhisper` invoke | mock fsExists 已注册 `C:/Tools/whisper.exe`、`C:/Models/base.bin`（install-mocks.ts:244-277）；`runWhisper` mock 返回固定 2 条 cue 的 SRT（install-mocks.ts:1148-1168） | ✅ 完整 |
| 对话检测 | `detectClipDialogue`（lib/dialogueDetection.ts，WebAudio 帧分析 + e2e 兜底帧） | silence-pattern.wav 的语音区间为 [0,1)、[1.5,2.5) → 2 个区间；另有 `isE2eRuntime()` 兜底 | ✅ 完整 |

命令对象（全部已存在、支持 undo/redo、符合 Timeline 命令对象约束）：`SplitClipAtTimesCommand`（clip-split-commands.ts:69）、`RemoveSilenceCommand`（clip-smart-commands.ts:63）、`DialogueRoughCutCommand`（clip-smart-commands.ts:99，按区间数替换生成 clip）、`AddTrackCommand`。

e2e fixture `setupSmartRoughCutFixture`（install-mocks.ts:2488）：建 2.5s 视频 clip `clip-smart-video`（track-video）+ 选中该 clip——面板的 `selectedClip` 依赖已满足。

时间线渲染 `data-clip-type={clip.type}`（TimelineClipComponents.tsx:780）已存在，字幕 track 断言可用。

### 1.4 core 层三个模块的关系（避免混淆）

- `smart-rough-cut.ts`（459 行）：旧版"粗剪提案"引擎（cut points/segments/proposals + AI prompt 构建），与本 3 例无直接关系；
- `smart-rough-cut-v2.ts`（427 行）：clip 构建器（buildDialogueRoughCutClips/buildBrollInsertClips/buildRhythmAssembleClips 等），被命令对象和两个面板共用；
- `smart-rough-cut-orchestrator.ts`（525 行）：**已存在的"新编排器" core**——`orchestrateSmartRoughCut(analysisData, options)` 把多路分析数据转成建议列表 + 报告，配 `smartRoughCutOrchestratorStore.ts`（zustand，143 行）与单测 `smart-rough-cut-orchestrator.test.ts`。仅被一键编排面板消费。

**结论：orchestrator 概念不是没有，而是已经有一套完整实现（core + store + 面板 + 单测），问题在于这套实现的"一键式"交互与 spec 的"分步式"行为契约冲突，且接线切过去后把符合契约的分步面板晾成了孤儿。**

### 1.5 其他依赖核查

- 无其他 e2e 引用编排面板 testid（grep 全 e2e 目录确认），改接线不会波及其他用例；
- `RoughCutComparePanel`（对比查看器）由 EditorShell 独立挂载，与本 3 例无关；
- whisper 路径输入框在 Toolbar 常驻（Toolbar.tsx:566/583，绑定 whisperSettingsStore），与面板挂载无关，spec 的 fill 步骤天然可用。

---

## 2. 3 个用例的行为规格提取

### 用例 :4 —— 面板运行场景/静音/Whisper 三步骤

前置：`setupSmartRoughCutFixture`；交互与断言序列：
1. `toolbar-smart-rough-cut-button` → `smart-rough-cut-panel` 可见；
2. **场景**：`smart-scene-button` → `smart-scene-status[data-status=complete]` → `smart-scene-preview` 含 "检测到 1 个切点" → `smart-scene-apply-button` → track-video clip 数 1→2（切点在 mock 默认 `[1]`）；
3. 重置 fixture；**静音**：`smart-silence-button` → `smart-silence-status[data-status=complete]` → `smart-silence-preview` 含 "将删除 1 段静音" → `smart-silence-apply-button` → clip 数 2（静音段 [1.0,1.5) 把 clip 切成两段）；
4. 重置 fixture；**Whisper**：填 `whisper-executable-path-input`/`whisper-model-path-input` → `smart-whisper-button` 变为 enabled → 点击 → `smart-whisper-status[data-status=complete]` → `[data-clip-type="subtitle"]` 数量 2 → `smart-rough-cut-report` 含 "生成 2 条字幕"。

### 用例 :35 —— 只应用被选中的场景结果项

`setSceneDetectionTimes([0.8, 1.7])` → 运行场景检测 → `[data-testid^="smart-scene-item-"]` 数量 **3**（两个切点切出 3 段）→ **uncheck `smart-scene-checkbox-scene-1`**（即取消 splitTime=1.7 的那一段）→ apply → track-video 恰好 2 个 clip：`clips[0] = {start:0, duration:0.8}`、`clips[1] = {start:0.8}`（只在 0.8 处切）。

### 用例 :62 —— 对话模式每个语音区间生成一个 clip

`smart-rough-cut-tab-dialogue` → `smart-dialogue-button` → `smart-dialogue-status[data-status=complete]` → track-video clip 数 2（语音区间 [0,1)、[1.5,2.5) 各生成一个 clip，替换原 clip）→ `smart-rough-cut-report` 含 "2 个对话 clip"。

**规格要点归纳**：三步骤（+对话）各自独立可运行、独立状态可见（running/complete/error）、结果先预览后应用、scene 结果支持逐项勾选、报告跨步骤累计。spec **不要求**三步骤自动串联一键执行。

---

## 3. 当前失败根因定位（实测验证）

实跑 3 例（docs/evidence/e2e-smart-rough-cut-diagnose-2026-08-11.txt），全部在首个面板级定位处失败：

| 用例 | 失败行 | 失败定位器 |
|---|---|---|
| :4 | spec 第 10 行 | `getByTestId('smart-rough-cut-panel')` 不存在（实际渲染的是 `smart-rough-cut-orchestrator-panel`） |
| :35 | spec 第 44 行 | `getByTestId('smart-scene-button')` 不存在 |
| :62 | spec 第 68 行 | `getByTestId('smart-rough-cut-tab-dialogue')` 不存在 |

**结论：不是功能缺失，是典型的"重构丢接线"**——与 export.spec 拆分重构同类。检测后端、命令对象、mock、fixture、i18n 全部完好且被其他用例持续使用；唯一断裂点是 v4.27.0 把入口接线切到了一键编排面板，其 testid/交互与行为规格完全不对应。

---

## 4. 新 orchestrator 设计方案

### 4.1 现有实现的问题（基于调研的如实描述）

1. **行为契约错配**：挂载的一键编排面板把 scene/silence/whisper/dialogue 打包成一次黑盒分析，无分步状态、无分步预览/应用，与 spec 的分步契约冲突；
2. **资产错位**：符合契约的分步面板（含完整状态机 `smart-rough-cut-state.ts`，有单测）被晾成孤儿；符合"编排器"命名的 core/store 却只服务一键面板；
3. **状态层分裂**：分步状态（smart-rough-cut-state.ts 纯函数）与编排状态（smartRoughCutOrchestratorStore）两套并存，无统一编排入口。

### 4.2 新 orchestrator 的形态与职责

新 orchestrator = **分步执行编排器**：编排 scene/silence/whisper/dialogue（broll/rhythm 保留扩展位）四步骤的**独立执行、状态流转、结果暂存与选择、命令化应用、报告整合**。它要解决的不是"自动串联三步骤"（spec 无此要求），而是把已有但分裂的三层重新对齐：

```
┌─ UI 层：分步编排面板（tabs: basic/dialogue/broll/rhythm）
│   每步骤卡片 = 运行按钮 + 状态徽标(data-status) + 结果预览 + 逐项勾选 + 应用
│   底部：跨步骤累计报告 smart-rough-cut-report
├─ 状态层：统一步骤状态机（zustand store）
│   steps: {scene,silence,whisper,dialogue,broll,rhythm} → idle/running/complete/error
│   pending 结果 + selection + report 计数
├─ 执行层：现有命令对象（零改动）
│   SplitClipAtTimesCommand / RemoveSilenceCommand / DialogueRoughCutCommand / AddTrackCommand
└─ 检测适配层：现有实现（零改动）
    detectSceneChanges(invoke,mock) / detectClipSilence(WebAudio) /
    detectClipDialogue(WebAudio+e2e兜底) / whisper(getWhisperAvailability+runWhisper,mock)
```

职责边界：
- **编排**：步骤互不阻塞（anyRunning 仅防并发）、每步骤 running→complete/error 流转、失败 toast + 错误展示、apply 后写入 report 计数；
- **整合**：report 聚合各步骤产出（静音秒数/切分数/字幕数/对话 clip 数/B-roll/节奏）；
- **不做**：不自动串联执行、不跨步骤改写结果（scene 结果只作用于 scene apply）。

### 4.3 与现有编排器 core 的关系

`orchestrateSmartRoughCut`（建议生成引擎）服务的是"一键模式"，与分步契约正交。其去留属于开放决策（见第 7 节），不影响 3 例转绿：分步编排只依赖状态机 + 命令对象 + 检测适配层。

---

## 5. 逐条用例对照表

| 用例 | 关键断言 | 设计方案满足路径 |
|---|---|---|
| :4-场景 | status complete；preview "检测到 1 个切点"；apply 后 2 clips | `smart-scene-button` → runStep('scene') → detectSceneChanges mock 返回 `[1]` → buildSceneCandidates 得 2 候选（preview 文案已由 i18n 保证）→ apply 执行 SplitClipAtTimesCommand([1.0]) → 2 clips |
| :4-静音 | preview "将删除 1 段静音"；apply 后 2 clips | detectClipSilence 解码 silence-pattern.wav → [1.0,1.5) 一段 → RemoveSilenceCommand → 保留段 [0,1.0)/[1.5,2.5) → 2 clips |
| :4-Whisper | 填路径后按钮 enabled；2 条 `[data-clip-type="subtitle"]`；report "生成 2 条字幕" | Toolbar 输入写 whisperSettingsStore → getWhisperAvailability（mock fsExists 通过）→ runWhisper mock 2-cue SRT → buildWhisperSubtitleTrackForClip → AddTrackCommand 字幕轨（2 clip）→ report 计数 2 |
| :35 | 3 个 item；取消 scene-1；apply 后 clips[0]={0,0.8}、clips[1]={0.8} | setSceneDetectionTimes([0.8,1.7]) → 3 候选（scene-0/1/2）→ selection 记录勾选 → apply 只取选中项的 splitTime（[0.8]）→ SplitClipAtTimesCommand → 断言的两个 clip |
| :62 | dialogue tab；complete；2 clips；report "2 个对话 clip" | tab 切换 → detectClipDialogue 得 2 区间 → DialogueRoughCutCommand 替换生成 2 clip → report 计数 2 |

注：以上路径在 SmartRoughCutPanel 中已全部实现过（含 i18n/命令/选择逻辑），对照表的每一环都有现存代码支撑，非推演。

---

## 6. 预估改动范围

### 6.1 改动清单（按推荐方案）

| 文件/模块 | 改动 | 说明 |
|---|---|---|
| `SmartRoughCut/` 新分步编排面板 | 重写/迁移 ~700 行 | 主体来自 SmartRoughCutPanel 的分步 UI + runStep 状态机；testid 契约不变 |
| `store/smartRoughCutOrchestratorStore.ts` 或新增步骤状态 store | 扩展/新增 ~150 行 | 把 smart-rough-cut-state.ts 的步骤状态机并入 zustand（决策点 2） |
| `layout/ShellRightPanel.tsx` | 1 行接线 | 指向新面板 |
| 旧 SmartRoughCutPanel / 一键编排面板家族 | 退役/删除（决策点 1） | WorkflowStepper/SuggestionList/SuggestionItem/OrchestrationReport 随一键面板去留 |
| editor-core / Rust / CI 配置 | **零改动** | 检测、命令、v2 构建器全部现成；无新增依赖 |

### 6.2 外部依赖 / 模型 / 网络访问特别说明（Whisper）

- **生产形态**：Whisper 是**用户自备的本地可执行文件 + 本地模型文件**（executablePath/modelPath 两个路径配置），经 tauri-bridge `runWhisper` invoke 调用；应用**不下载模型、不联网、不调用任何外部/付费 API**，符合本地优先约束；
- **e2e/CI 形态**：完全 mock——`fsExists` 对 `C:/Tools/whisper.exe`、`C:/Models/base.bin` 返回 true，`runWhisper` 返回固定 2-cue SRT；**零真实模型、零网络**；
- 场景/静音/对话检测同理：e2e 下分别为 invoke mock、浏览器内解码 mock 音源，无外部依赖；
- **结论：本方案不引入任何需要联网下载或外部服务的依赖，无开放性的外部依赖风险。**

### 6.3 风险提示

- 分步面板自 v4.27.0 起未被渲染，其依赖的检测库期间被其他用例持续验证（无腐化），面板本身持续通过 typecheck（lazy import 在编译图内），但**恢复后需完整跑一遍 3 例 + 全量回归**确认无次生 drift；
- 一键编排面板若删除，其 core（orchestrateSmartRoughCut）的单测 `smart-rough-cut-orchestrator.test.ts` 随之去留，需一并决策。

---

## 7. 需要用户决策的开放问题

1. **一键编排面板家族的命运**：现有 SmartRoughCutOrchestratorPanel（一键分析+建议列表+一键应用，含 WorkflowStepper/SuggestionList/OrchestrationReport）是 a) 整体退役删除，b) 保留为与新分步面板并行的独立入口，还是 c) 收纳为新面板里的"全自动"模式？（影响改动量与 store 归属）
2. **状态层归属**：分步状态机并入现有 `smartRoughCutOrchestratorStore`（扩展其 phase 模型），还是新建独立的步骤状态 store、编排 store 仅留给一键模式？
3. **`orchestrateSmartRoughCut` core（525 行 + 单测）去留**：若一键模式退役，该引擎是同步删除还是保留待用？
4. **旧 `smart-rough-cut.ts` 提案引擎（459 行，AI prompt 向）是否纳入本轮清理**：与本 3 例无关，倾向不动，但如需收敛死代码需另行授权。

（若以上均按最小风险默认——保留一键面板家族不动、仅新建分步编排面板并切换接线——则改动收敛为 6.1 表的前三行，3 例转绿不受任何开放问题阻塞。）
