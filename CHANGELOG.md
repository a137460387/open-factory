# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [v4.79.0] - 2026-08-29

功能版本：情感高潮 top-K 建议。

### Added
- 情感高潮 top-K 建议组装接入（M3 扩展·第二梯队）：由内容分析情感曲线派生局部高光保留建议——editor-core 新增 `selectEmotionalClimaxIntervals` 组装层（源窗口过滤 + top-K 互斥选取 + 边界 clamp + 极短保护，top-K 内核零改动），desktop 新增第三源派生与多源合并（climax 组置信度降序），接入既有对比审阅与单条显式采纳链路，支持撤销恢复；采纳计数器新增 `emotional-climax` 来源枚举；e2e +2 例，发现数 541 → 543

### Maintenance
- roadmap 补勾两项 v4.75.0 已交付项（后台媒体作业优先级调度与显式限流 / 批量波形预生成与 codec 感知音频解码回退）
- ltx-video `downloadModel`/`deleteModel` 补 `isTauriRuntime` 检查——浏览器环境以明确错误拒绝（写操作不可静默成功），对齐同文件既有浏览器回退惯例
- 关闭 PR #104（wontfix，思路并入 #108 治理范围）

## [v4.78.2] - 2026-08-28

维护版本：Windows 正式包隐藏控制台窗口。

### Fixed
- Windows 正式包启动不再弹出控制台窗口（`windows_subsystem` 属性补齐）；正式包 Rust stdout 日志随之不再可见，属预期行为

## [v4.78.1] - 2026-08-28

热修版本：修复 v4.78.0 生产安装包启动黑屏（manualChunks 循环分块求值），并将生产产物冒烟纳入 CI 门禁。

### Fixed
- 生产包启动黑屏：循环分块下 @tanstack/react-virtual 的模块级代码在 React 初始化前求值（react-dom 的 scheduler 依赖被兜底路由进 vendor-utils，与 react-virtual → React 形成 vendor-react ↔ vendor-utils 双向分块循环），入口崩溃致 #root 空；连带塌缩 vendor 层修复后暴露的 editor-core 域分块 TDZ（域文件顶层求值访问跨块绑定）。经 v4.77.0 产物 hash 同构实证定性为 v4.73.0 分块拆分引入的遗留债，非近期功能回归

### Changed
- 生产产物冒烟入 CI：新增 prod-smoke job（vite build → preview 静态服务 + 无头 Chromium 断言 #root 挂载与零 pageerror），填补 e2e 仅覆盖 dev server（无生产分块）的流程盲区
- 生产分块结构收敛：vendor-react 收敛为 React 生态闭包（react / react-dom / scheduler 同块）、@tanstack 独立成单向分块、editor-core 家族合并为单块（循环回到块内由 Rollup 模块拓扑排序保证求值顺序）；budget.json 单块预算 600KB → 2000KB（正确性塌缩的结构性代价，总量与 vendor-react 预算不变仍受控）

### Tests
- e2e 发现数 541 持平（零用例变更；540 passed + 1 flaky 均池内已知项）；desktop 覆盖率（口径 B）73.2941% 持平（零 src 代码变更，CI artifact lcov 逐位复现）；全量单测 675 文件 12494 passed + 3 skipped

## [v4.78.0] - 2026-08-28

本版本主线为语义建议多源扩展首梯队（M3 扩展·首实施）：智能粗剪语义建议在叙事标记之外接入内容分析派生的「掐头/收尾收紧」双源，并以纯本地采纳计数器开始积累建议质量信号；同时交付情感高潮 top-K 互斥算法内核（入池待真实使用信号后裁组装）。

### Added
- 掐头收紧建议（head-trim）：由内容分析首个内容点（对话轮起点/响度上升沿）派生，预留 0.3 秒起势余量保护起音与换气，极短片段保护不生成建议；接入既有对比审阅与单条显式采纳链路，支持撤销恢复
- 收尾收紧建议（tail-trim）：由内容分析尾部低能量段回溯派生，低能量阈值显式可配（默认与对话轮检测同口径 0.08）防误伤片尾淡出
- 语义建议多源合并与去重：climax 优先（置信度降序）→ 其余叙事建议时间升序 → 掐头 → 收尾的确定性排序；派生项与叙事项区间完全重合时自动剔除派生项，同区间重复视为缺陷
- 「启发式」来源标签与双源就绪门控：转写或内容分析任一就绪即呈现各自部分的建议
- 纯本地采纳记录器：每条建议采纳成功后记录 `{来源, 时间戳}` 事件（localStorage 封顶 500 条截旧），零遥测零上报，作为建议质量评估与后续拓展方向的长期信号积累
- top-K 互斥选择算法内核 `selectTopKMutuallyExclusive`（editor-core 纯函数，本期入池不接线）

### Tests
- e2e 发现数 538 → 541（多源扩展 +3 例：仅内容分析就绪时收紧类条目出现且叙事类缺席 / 掐头建议审阅采纳与时长缩短+撤销还原 / 收尾建议同款）；desktop 覆盖率（口径 B）73.2213% → 73.2941%；全量单测 675 文件 12494 passed + 3 skipped

## [v4.77.0] - 2026-08-27

本版本主线为语义建议审阅与应用（M3-3 A1）：智能粗剪的语义建议从只读列表升级为可对比审阅、单条显式采纳的完整闭环；并完成两项 P2 收官治理——纯音乐误报修复与 ASR 死链路退役。

### Added
- 语义建议对比审阅与单条采纳（M3-3 A1）：每条语义建议（开场/铺垫/高潮/回落/收尾）可打开审阅对话框，对比呈现采纳前原片段与采纳后保留区间（源素材条带 + 保留比例）；「采纳此建议」为单一显式入口，应用后即时反馈结果（含可撤销提示），失败（如建议恰好覆盖整个片段）时说明原因且不改动时间线；采纳走既有波纹裁剪命令，支持 Ctrl+Z / 工具栏撤销完整恢复
- 时间线绝对时间到源素材时间的建议区间换算（含变速与裁剪偏移），语义建议区间在任何播放速率下都能精确映射到源素材

### Fixed
- 对话轮检测纯音乐误报：能量检测无法区分语音与持续音乐，此前纯音乐素材会被误判出 30 秒级「对话轮」并污染场景标签与对话占比；现以最长对话时长判据（默认 15 秒，可配）剔除无停顿的连续高能量块，访谈/vlog/电影对白等真实对话形态零回归
- 清理 `lib/asr.ts` 空壳桩及其自证测试（全仓无实际消费者的死代码）

### Refactor
- 退役 AISubtitleWorkflow 断链 ASR 阶段：四断点实证该阶段自始无法工作（请求参数空占位/worker 消息无应答器/媒体路径缺失/就绪信号恒假），执行「保下游、去上游」切割——面板流程简化为润色→样式→导出三段，转写生成字幕仍由分步面板 Whisper 步与时间线右键「生成字幕」承接，相关 e2e 用例同步重写为壳层用例（9→7 例）

### Tests
- e2e 发现数 535 → 538（语义建议审阅 +3 例：审阅对话框断言 / 采纳裁剪与撤销恢复 / 整片段建议预判禁用）；desktop 覆盖率（口径 B）73.1881% → 73.2213%；全量单测 673 文件 12443 passed + 3 skipped

### Docs
- HANDOFF 观察池收官归档（销账台账/监控规则/基线口径修正）与 v4.76.0 发版历史回填

## [v4.76.0] - 2026-08-27

本版本主线为智能粗剪语义建议两阶段落地（P2 主线 M3-1/M3-2）：从叙事标记到只读建议列表的完整数据链路，应用整合（M3-3）留待决策。

### Added
- 智能粗剪语义建议生成层（M3-1）：`generateSemanticRoughCutSuggestions` 纯函数从语义理解产出 narrativeMarkers 派生建议列表——区间取 marker.time 至下一 marker.time（末项延伸至片段末端），climax 按 confidence 降序置顶、其余时间升序殿后，片段范围外标记剔除；经 `useSmartRoughCut.semanticSuggestions` 扩展位暴露，类型不落库不入持久化 schema
- 智能粗剪语义建议列表 UI（M3-2）：SemanticSuggestionList 只读组件（label + timeRange + reason + confidence，climax 项高亮标记）挂载分步面板 whisper 步后扩展位；结果项 hover playhead 联动预览（复用检测参数化阶段的 onMouseEnter 路径）；speechUnderstanding.ready 就绪门控（未就绪显示提示文案，类比提案对比面板惯例）；只读呈现不自动应用，应用整合属后续决策项
- 智能粗剪转写文本桥接：从时间线字幕轨收集 whisper 产物并组装时间对齐参数调用语义引擎 understandSpeech（keywords/topics/narrativeMarkers/summary + ready 信号），为语义建议提供数据前提

### Tests
- e2e 用例数自本版本起统一以**发现数**口径表述：发现数 537 / passed 537 零 flaky（新增语义建议 2 例：ready 门控→转写→列表渲染含 climax 高亮、hover playhead 断言；历史记录的 534 为 passed 数口径，实际发现数为 535，其中 1 例 flaky 重试通过不计入 passed）
- desktop 覆盖率（口径 B）73.02% → 73.04%（CI artifact lcov 实测）；semantic-suggestion.ts 行覆盖 100%
- 全量单测 672 文件 12415 passed + 3 skipped，无 unhandled rejection

### Docs
- 新增 RELEASING.md 发版工作流文档（lightweight tag 打 bump 提交 / release.yml 自动建 Release + gh release edit 校正 / merge 信息 release: 前缀三惯例固化）
- HANDOFF 交接文档两轮刷新（v4.75.0 发版与 P2 转折点基线归档、M3 两阶段归档与 e2e 口径双口径修正）

## [v4.75.0] - 2026-08-26

本版本主线为 Smart Rough-Cut 智能粗剪三阶段增强（P1-2），并合入后台媒体作业调度、波形预生成两项 roadmap 功能与协作安全加固。

### Added
- 智能粗剪提案对比（P1-2 M1b）：时间线右键「生成粗剪方案」打开三策略提案对比面板（高光优先 / 节奏同步 / 均衡），基于片段内容分析派生高光与节奏输入；应用提案走命令对象（撤销/重做完整），段间间隙波纹删除；未分析素材入口禁用并提示先做内容分析
- 智能粗剪检测参数可调（P1-2 M2）：场景检测阈值、静音检测阈值/最短时长/边距、对话检测灵敏度（低/中/高）均可在分步面板内调节，运行中禁用调参；默认值与原内置值一致，零行为回归
- 检测结果项 playhead 联动预览（P1-2 M2）：鼠标悬停场景切点/静音区段时播放头跳转到对应时间点
- 后台媒体作业优先级调度与显式限流控制（roadmap 项）
- 批量波形预生成与 codec 感知音频解码回退（roadmap 项）

### Fixed
- 协作安全加固：协作主机强制鉴权 token，远程项目载荷增加结构校验
- i18n 边界修复：英文系统用户切换英文时英文语言包未加载的自愈问题
- 依赖安全升级：h2 升级至 0.4.16（RUSTSEC-2026-0258）、fast-uri 升级（GHSA-7p8r-x3mc-p8w7）、移除 brace-expansion override，cargo/bun audit 归零
- e2e 稳定性：启动更新检查 CORS flaky 消除、e2e 超时提至 60 分钟、AI 类 spec 时序加固、2 个 unhandled rejection 基线消除

### Refactor
- 智能粗剪分步面板结构化重构（P1-2 M1）：830 行单文件拆分为 hook（useSmartRoughCut）+ 纯函数工具 + 纯渲染层，行为等价，e2e 契约零变更
- 退役智能粗剪一键编排器死代码（面板家族 + core 875 行 + 测试 350 行）

### Tests
- 覆盖率攻坚专项结项：desktop 覆盖率 47.68% → 73.04%（口径 B，五期推进）
- 全量单测 669 文件 12383 passed；e2e 534 用例，本版本三阶段连续三轮 CI 全绿零 flaky

### Docs
- HANDOFF 交接文档三轮刷新；媒体作业调度 / 波形预生成 / macOS-Linux 原生对话框自动化设计文档入库

## [v4.74.1] - 2026-08-21

### Fixed
- 文本导出 drawtext 表达式残缺（transform 偏移为 0 时尾部裸 "+" 导致 ffmpeg 解析失败）
- 字幕背景透明度反转（ASS alpha 语义修正，opacity=1 现在正确渲染为不透明）
- 统一 ASS 颜色格式实现（&HAABBGGRR），非法色值回退白色

## [v4.74.0] - 2026-08-21

### Added
- 剪辑组感知的专业时间线操作守卫（editor-core 纯函数 clip-group-relations）：
  - Rolling Trim：相邻两片段共享边界联动调整，总时长不变；跨界组边界被拒绝并提示
  - Close Gap：一键闭合轨道间隙；横跨间隙的剪辑组被保护（拒绝并提示组名）
- Alt+G 快捷键：闭合 playhead 所在（或其后首个）间隙；无间隙时静默无操作；守卫拒绝时 toast 告知原因而非静默跳轨
- 快捷键面板（中/英）新增「闭合间隙 / Close Gap」条目
- timeline-advanced.spec.ts：12 个 E2E 用例覆盖 ripple/rolling trim/组守卫/Alt+G/锁轨

### Fixed
- RollingTrimCommand / CloseGapCommand / FillGapCommand 补齐锁轨断言：
  锁定轨道上的边界拖拽、间隙闭合与填充现在被命令层拒绝（错误消息统一，
  桌面端 toast 直出）；此前 CloseGap/FillGap 在锁轨上照常执行

### Changed
- RippleDeleteCommand / CloseGapCommand / RollingTrimCommand 构造函数新增可选
  clipGroups 参数（默认空数组，现有调用完全兼容）；桌面端接线传入项目剪辑组

### Known Issues
- 组内 trim 不联动（设计决策）：剪辑组仅绑定移动/删除/边界守卫，成员入出点
  独立可修剪——与 DaVinci Resolve clip group 行为一致，避免与相邻非组片段
  产生 overlap 冲突
- UI 点击组成员会自动扩展选区为整组：ripple delete 的实际语义是整组删除；
  命令层单成员删除（组收缩/解散）面向脚本与协作重放路径
- ripple delete 左移量为被删区间总时长，被删片段前后的既有间隙保留（v4.73
  既有行为，本版测试已锁定该基线）

## [v4.73.0] - 2026-07-29

### Added
- LTX-Video AI 视频生成功能：文字描述/图片 → 本地 AI 生成视频
- 视频生成面板：实时进度条、阶段显示、GPU 信息、生成预览
- 12 个视频生成预设（Quick Draft 到 Social Storyboard 等）+ 自定义预设
- 模型自动下载管理器：进度追踪、SHA256 校验、HuggingFace 集成
- GPU 检测与自动精度推荐（CUDA/MPS/CPU 三级回退）
- 时间线集成：生成视频自动添加到时间线、缩略图预览、右键菜单位置
- Toast 通知系统：生成完成/失败通知、进程恢复、进度持久化
- 侧边栏工具栏「Generate Video」入口

## [v4.72.0] - 2026-07-28

### Added
- E2E 测试补强：app-launch/timeline-basic/playback-controls 三个 spec 共 12 个可执行测试
- 性能预算精细化：budget.json 支持 per-vendor-chunk 独立上限（react/codemirror/zustand/tiptap）
- bundle 分析报告：check-bundle-size 脚本输出 chunk 级别详情和 vendor 汇总
- CHANGELOG 自动化：conventional-changelog 脚本支持

### Changed
- strictNullChecks 全局启用，0 类型错误
- CI vendor chunk 预算卡点增强

## [v4.71.0] - 2026-07-24

### Changed
- **any 类型清理**: 从 232 降至 151（清理 81 个 `any`），超额完成 50+ 目标
  - TimelineDialogsLayer: 26→0（全部替换为具体类型）
  - ai-style-engine 模块: 8→0（引入 TimelineLike/ProjectLike 接口）
  - useEditorShellFloatingDialogsCallbacks: 35→0
  - useEditorShellInlineCallbacks: 13→0
  - useEditorShellEffects: 5→0
  - SpeakerMulticamPanel: 2→0
  - useEditorStoreSelectors: 1→0
- **巨型文件拆分**: ExportDialog.tsx 3807→3700 行，提取 export-utils.tsx
- **测试完整性**: 8775 测试全部通过，rbac 27/audit-log 18/desktop 6 均达标
- **i18n 懒加载**: 已有 8 个测试覆盖，英文 locale 动态加载正常
- **版本号升至 v4.71.0**

### Fixed
- 清理 background agent 创建的 broken split 文件（clip-commands/keyframe-commands/media-commands/track-commands 等）
- 恢复 timeline-commands.ts 为原始 7181 行版本

### Known Issues
- TimelineTracksContainer.tsx 仍有 83 个 `any`（后台 agent 处理中）
- 测试文件中有 61 个 `any`（测试 mock，可接受）
- `noUncheckedIndexedAccess` 启用后产生 2708 个错误，需独立 sprint 处理

## [v4.70.0] - 2026-07-24

### Changed
- **i18n 懒加载**: `en-overrides.ts` (5144行) 改为动态 import，首屏仅加载中文；新增 `setLanguageAsync` API
- **测试完整性审计**: 8775测试全部通过（新增4个i18n懒加载测试），rbac 27用例、audit-log 18用例、desktop集成3文件均达标
- **版本号升至 v4.70.0**

### Fixed
- 修复5个测试文件因i18n懒加载导致的英文切换失败（改用 `setLanguageAsync`）

### Known Issues
- 巨型文件拆分（timeline-commands/ExportDialog/ClipInspectorBody）因类型错误需逐文件谨慎执行
- any 类型清理因引入类型错误需逐文件验证
- `noUncheckedIndexedAccess` 启用后产生2708个错误，需独立sprint处理

## [v4.25.4] - 2026-07-15

### Changed
- 代码风格统一：Prettier 格式化全项目代码
- 文档完善：更新 README、CONTRIBUTING、DEVELOPMENT 文档
- 测试覆盖提升：补充核心模块单元测试
- 依赖更新：清理冗余依赖，统一版本管理
- 性能优化：优化内存使用和资源释放逻辑

## [v4.25.3] - 2026-07-15

### Changed
- 添加应用内语言切换功能，支持中文和英文切换

## [v4.25.2] - 2026-07-14

### Changed
- 统一错误处理机制，引入 `logError` 工具函数
- Rust 依赖瘦身：移除 `once_cell` 改用标准库 `LazyLock`，统一 zip 库版本为 v4
- 前端依赖整理：Radix UI 组件库迁移与清理
- 更新架构与路线图文档

### Fixed
- 补充 AI 核心模块单元测试，提高测试覆盖率
- 补充调色核心模块单元测试，提高测试覆盖率

## [v4.25.1] - 2026-07-14

### Fixed
- 修复 `ai.rs` 中的内存泄漏问题，优化 AI 模型资源释放逻辑
- 优化 DB 连接池逻辑，修复连接泄漏和超时回收问题
- 恢复 AI 降噪与多机位 E2E 测试，提升测试稳定性
- 新增 `ai-emotion-analyzer` 单元测试，提高测试覆盖率

## [v4.25.0] - 2026-07-14

### Added
- Smart media library with metadata extraction, list view with codec/frame rate/bit rate columns, and enhanced sorting options
- AI auto subtitle generation workflow panel (ASR → Polish → Style → Export)
- AI noise reduction for audio (local and cloud providers)
- Hardware accelerated encoding with GPU encoder selection
- Multi-camera editing MVP with sync and angle switching
- AI smart montage with beat-aware clip arrangement
- Performance optimization: timeline virtualization and caching for large projects (1000+ clips)

### Fixed
- E2E test reliability: restored 13 previously failing/skipped tests (performance, smart-media-library, smart-subtitles)
- Rust compilation: replaced unmaintained rnnoise-rs with nnnoiseless, fixed escaped references in ffmpeg.rs
- CI pipeline: restored buildHardwareEncoderArgs signature, added list_hardware_encoders command
- MediaBin list view: added data-testid attributes for codec and frame rate cells
- ASRStage component: consistent test ID naming convention with other workflow stages

### Changed
- Timeline heatmap now uses deferred values for smoother scrolling
- Track virtualization limits rendered tracks to visible area
- Sort dropdown in media library now includes frame rate and codec options

## [v3.10.0] - 2026-06-23

### Added
- Timeline performance monitoring and alerting
- Multimedia format conversion center
- Subtitle sentiment color annotation
- Project export history smart categorization
- Timeline virtual environment simulation testing tool

### Changed
- Test coverage boosted to 96.1%

## [v3.9.0] - 2026-06-23

### Added
- Export batch processing script interface
- Project archive encrypted export

## [v3.8.0] - 2026-06-23

### Added
- Subtitle auto-sync offset detection
- Media proxy batch verification and repair
- Export error diagnosis knowledge base
- Sequence side-by-side comparison

## [v3.7.0] - 2026-06-23

### Added
- Media library batch tag suggestion with learning upgrade
- Project template community sharing

## [v3.6.0] - 2026-06-23

### Added
- Subtitle auto line-break optimization
- Media import conflict resolution wizard

## [v3.5.0] - 2026-06-22

### Added
- E2E test suite and touch optimization toggle UI integration
- Export preview real-time estimation
- Touch multi-point gestures
- Media library smart grouping
- Collaboration permission management

## [v3.4.0] - 2026-06-22

### Added
- i18n strings for template, multicam, preset-diff, and annotation-sync features
- Project template smart pre-fill
- Multi-cam audio sync enhancement
- Export preset diff comparison
- Timeline annotation cloud sync

### Fixed
- Motion-graphic fixture fontconfig compatibility (explicit fontfile + FONTCONFIG_FILE fallback)

## [v3.3.0] - 2026-06-22

### Added
- Subtitle style quick switch bar
- Export failure smart retry strategy
- Media replacement batch pre-check
- Timeline multi-level zoom memory

### Testing
- Added P0-1, P0-2, P1-3, P1-4 E2E tests

## [v3.2.0] - 2026-06-22

### Added
- Batch crop ratio conversion
- Timeline quick action panel
- Export file naming rules
- Media library duplicate content merge

## [v3.1.0] - 2026-06-21

### Added
- Export preset smart recommendation
- Timeline thumbnail pre-rendering
- Audio fade in/out curve editing
- Media library tag cloud

### Fixed
- Gesture zoom handler reads scale/detail from Safari-compatible events

## [v3.0.1] - 2026-06-21

### Fixed
- Timeline.tsx module-level hook call causing render crash

## [v3.0.0] - 2026-06-21

### Added
- Subtitle spell checking
- Export queue notification center
- Media import pre-check: file header sniffing, three-state determination, batch pre-check, force import
- Timeline zoom and navigation gesture optimization

### Fixed
- Corrected `read_file_header_bytes` position in `generate_handler`

[v4.25.1]: https://github.com/a137460387/open-factory/compare/v4.25.0...v4.25.1
[v4.25.0]: https://github.com/a137460387/open-factory/compare/v3.10.0...v4.25.0
[v3.10.0]: https://github.com/a137460387/open-factory/compare/v3.9.0...v3.10.0
[v3.9.0]: https://github.com/a137460387/open-factory/compare/v3.8.0...v3.9.0
[v3.8.0]: https://github.com/a137460387/open-factory/compare/v3.7.0...v3.8.0
[v3.7.0]: https://github.com/a137460387/open-factory/compare/v3.6.0...v3.7.0
[v3.6.0]: https://github.com/a137460387/open-factory/compare/v3.5.0...v3.6.0
[v3.5.0]: https://github.com/a137460387/open-factory/compare/v3.4.0...v3.5.0
[v3.4.0]: https://github.com/a137460387/open-factory/compare/v3.3.0...v3.4.0
[v3.3.0]: https://github.com/a137460387/open-factory/compare/v3.2.0...v3.3.0
[v3.2.0]: https://github.com/a137460387/open-factory/compare/v3.1.0...v3.2.0
[v3.1.0]: https://github.com/a137460387/open-factory/compare/v3.0.1...v3.1.0
[v3.0.1]: https://github.com/a137460387/open-factory/compare/v3.0.0...v3.0.1
[v3.0.0]: https://github.com/a137460387/open-factory/releases/tag/v3.0.0
