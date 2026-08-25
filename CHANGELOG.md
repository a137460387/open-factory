# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
