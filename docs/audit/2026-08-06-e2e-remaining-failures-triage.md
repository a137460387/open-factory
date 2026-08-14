# E2E 剩余失败根因聚类（重跑 + 深挖）

- 日期：2026-08-06
- 性质：**只读诊断。未改任何 spec/产品代码/playwright.config/CI；未提交、未 push；未创建/切换分支（全程在 `fix/114-dev-perf-overlay-render-loop`）**。
- 数据源：本轮本地全量重跑（workers=2，31.1m）`392 通过 / 155 失败`，日志 `/tmp/e2e-diag/full-suite-r2.log`，压缩表 `fail-r2.txt`（`spec||错误||等待定位`）。与上轮 396/151 的 ±4 波动即负载敏感性的直接证据。
- 范围：#114 渲染循环与两处已修 drift（advanced-text、adjustment-layer，提交至 fe1173a4）不在本文。

## 0. 总览

- 本次失败总数：**155**。
- 可被下述簇覆盖：**~147**；无法归簇的独立失败：**~8**（见 §3）。
- 已知下一轮可转绿（纯 testid、低风险簇 A-rename/C/D/E/I/J/K）：**~69**。
- 需产品/工程决策（A-team、F、G、H）：**~43**。
- 负载/基础设施敏感、需先定并发策略（B）：**~35**。

根因高度集中：155 个失败可归到 **~10 个根因**，其中 5 个是 07-23/07-24 一批 agent 自动"拆分/重构"提交横跨多模块改 testid 所致（见 §4 系统性风险）。

## 1. 逐簇详情

### 簇 A：Tools 菜单入口 testid 不匹配（22）
- 文件：`multi-device-sync`(10)、`team-management`(6)、`collaboration`(6)。
- 根因：spec 等待 `toolbar-tools-sync-menu-item`/`-team-management-`/`-collaboration-`/`-color-grading-menu-item`，但 `ToolsMenu.tsx` 现为 `toolbar-tools-sync-compare-menu-item`(:174)、`toolbar-tools-collaboration-notes-menu-item`(:178)；`git log -S` 证实 spec 的 testid **从未** 存在于 src（spec 于 26cbf7e2 v4.41.0 等停摆期加入，写的是"意图 testid"）。team/color-grading 入口在 ToolsMenu 已不存在。
- 修复：sync+collab(15)=spec 改名（低风险）；team+color-grading(7)=需产品确认入口去向。
- 预估转绿：15（rename）+7 待定。

### 簇 B：media-card/add-to-timeline 负载敏感（35）
- 文件：audio-separation、color-node-editor、edit-history、effect-preset-library、export*、plugins、preset-market、timeline*、track-controls、zoom-memory 等 30+ 个 spec 的首个媒体交互。
- 根因：**非代码 drift**。全量 workers=2 下 dev-server transform 变慢，10s actionTimeout 撞墙；隔离 workers=1 同批全过（上轮证据：timeline-basic:43 全量挂/隔离过；3 文件批隔离全过）。±4 的轮间波动同源。
- 修复：基础设施/并发策略（降 workers、放宽 timeout、提速 dev-server）——属配置改动，本轮越界不做；混有个别真回归（timeline-basic:32 delete、proxy-auto）需剔除到 H/G。
- 预估转绿：~33（若并发策略落地），2-3 个真回归另计。

### 簇 C：ExportDialog 拆分后 testid（14）
- 文件：color-management-export(3)、export(3)、export-preview-sampling、codec-compare-export、nested-sequence-export、export-quality、export-recovery、export-upload、export-pipeline、post-export-script。
- 根因：**bd315fd6**（07-24 拆分 ExportDialog）把配置/队列控件移入 ExportConfig/ExportProgress，testid `export-batch-paths`/`export-max-concurrent-select`/`export-history-entry`/`export-preflight-panel`/`export-pipeline-tab`/`export-preview-button`/`export-recovery-report`/`export-upload-status`/`export-sequence-batch-row`/`codec-compare-preset-*` 改名/移位。
- 修复：核对现 ExportConfig/ExportProgress testid 后批量 spec 更新（低-中风险）。预估转绿 14。

### 簇 D：rich-text `clip-text-input` 重命名（3）
- 文件：clip-color-preview、text-animation、title-templates。
- 根因：bd315fd6 抽 RichTextEditor，编辑面 testid `clip-text-input`→`rich-text-editor-content`（同 advanced-text，已验证等价）。
- 修复：一行 ×3，近零风险。预估转绿 3。

### 簇 E：组件拆分导致 Inspector/PreviewCanvas 面板 testid 漂移（27）
- 文件：ai-content-tags、ai-quality-assessment、assist-editing、content-generation、auto-generate、cover-frames、dubbing-adaptation、frame-inspector/interpolation/search、lut-editor、macro-recording、media-organizer、preflight-checklist、publish-pipeline、quality-assessment、release-workflow、scene-detection、smart-rough-cut、super-resolution、video-restoration-export 等。
- 根因：07-24 组件拆分提交 **fce9810e/1584beaf（ClipInspectorBody）、0a05285d（PreviewCanvas）、bd315fd6** 把各 AI/功能面板 testid 移动/重命名（assist-preset-*、auto-generate-panel、beat-sync-checkbox、qa-profile-*、sr-apply-btn、smart-rough-cut-*、scene-detect-dialog、lut-editor-export-button、video-restoration/quality-enhancement-section、dubbing-analyze-btn、cover-frame-option-*、frame-*-、media-organizer-*、preflight-ack-*、release-publish-button）。
- 修复：按面板分批 spec testid 更新（低风险、批量大）。预估转绿 ~27。

### 簇 F：plugin-marketplace 整体重构（11）
- 文件：plugin-marketplace(11)、plugins(部分)。
- 根因：市场 UI 重构，`plugin-market-panel/category/sort/refresh`、`plugin-card-*`、`plugin-install-*`、`installed-plugin-*` 全族失效，含 `getByRole(/效果.*1/)` 计数断言；同期 9b680b94 引入插件沙箱。
- 修复：核对现市场 UI 后整体重写该 spec（中风险、需 review）。预估转绿 11。

### 簇 G：导出计划/字幕数值断言变化（16）
- 文件：subtitles(3)、clip-transition-export、panorama/png-sequence/reframe/multicam/gif/motion-graphics/video-stitch-export、audio-envelope、audio-viz-export、data-subtitles、ai-tts 等。
- 根因：ffmpeg-builder/字幕管线演进使输出参数/sidecar 变化（`toBe/toEqual/toContain/toBeTruthy` 于 plan 字段）。
- 修复：工程确认新输出正确→更新断言（偏 spec）；若输出错误则是真 bug。需工程+产品。预估转绿 16（决策后）。

### 簇 H：时间线编辑行为变化（9）
- 文件：timeline-basic(:32)、timeline-advanced-tools(3)、timeline-multiselect、timeline-efficient-editing、timeline-compare、keyboard-shortcuts、timeline-ruler。
- 根因：删除/ripple/undo 语义变化；`timeline-basic:32` 隔离复现仍失败=真回归。关联 2bfe4209（timeline 命令/撤销重构）与 Timeline/PreviewCanvas 拆分。
- 修复：需产品确认交互语义。预估转绿 9（决策后）。

### 簇 I：app-launch/i18n 外壳（4）
- 文件：app-launch(3)、i18n(1)。
- 根因：title 现 `open-factory`（index.html:6，spec 期望 `Open Factory` 带空格）；`inspector-panel` 改名（Inspector.tsx 现 inspector-empty-state 等）；`toolbar-file-menu-button` 改名；`toolbar-project-name` 存在(:452) 但可见性条件变化。
- 修复：spec 更新（低风险）。预估转绿 4。

### 簇 J：color-grading `<summary>` 结构选择器（3）
- 文件：color-grading-audio(3)。根因：`locator('summary').filter(调色)` 依赖已移除的 details/summary 结构。修复：换稳定 testid（低）。预估转绿 3。

### 簇 K：spec 自身 bug/脆弱（3）
- auto-generate:36 `selectOption` 传参错（spec bug）；startup-update 硬编码 `v0.6.1 可用` 文案；ai-tts 主线程计时（负载敏感）。修复：spec 修（低）。预估转绿 3。

## 2. 优先级排序建议（按 预估转绿/风险，仅依据不决策）

| 序 | 簇 | 转绿 | 风险 | 依据 |
|---|---|---|---|---|
| 1 | D | 3 | 极低 | 一行级、已验证等价 |
| 2 | A-rename | 15 | 低 | 单菜单重命名、批量 |
| 3 | C | 14 | 低-中 | 同源 bd315fd6、批量 |
| 4 | E | 27 | 低-中 | 量最大、按面板分批 |
| 5 | I+J+K | 10 | 低 | 外壳/结构/spec-bug |
| 6 | B | ~33 | 中 | 量最大但属配置/并发策略，越界需授权 |
| 7 | F | 11 | 中 | 单文件重写需 review |
| 8 | G+H+A-team | 41 | 高 | 需产品/工程决策 |

先做 1-5（~69 转绿、低风险），再定 B 的并发策略，最后产品决策 8。

## 3. 无法归簇的独立失败（~8）

collaboration:26（media-card-0 直接索引）、edit-history-panel、zoom-memory、tutorial、multicam、motion-graphics、data-subtitles、macro-recording 中未并入上述簇者。逐个独立排查，不硬凑。

## 4. 系统性/流程性风险（与具体簇无关，单独列出）

1. **agent 自动提交缺 e2e 门禁**：07-23/07-24 一批跨域自动重构（bd315fd6、fce9810e、1584beaf、0a05285d、a5966624、2bfe4209、9b680b94）全部落在 e2e 停摆窗口（07-14→08-02 install 失败），**没有任何 e2e 验证**即合入，直接造成簇 A/C/E/F/H。
2. **停摆期新增 spec 从未跑过**：部分 spec（A、F）写的是"意图 testid"（git -S 证实从未存在），即 spec 与实现脱节入库。
3. 建议：恢复 e2e 作为 agent 自动提交的合入门禁；新增 30s app-launch 冒烟 spec 前置；跨域自动重构须附 testid 兼容核对。
