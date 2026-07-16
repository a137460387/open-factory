# 下一阶段修复计划

**计划版本**: v4.26.0
**制定日期**: 2026-08-01
**基于审计**: 2026-07-15 全量代码审计（100 个问题）
**负责人**: 落小雨
**状态**: 📋 规划中

---

## 一、延期问题回顾

在 v4.25.4 修复版本中，以下问题因工作量大、风险高而延期至本版本：

| ID | 问题 | 原因 | 影响范围 |
|----|------|------|----------|
| H4 | editorUIStore 拆分 | 65+ 个对话框状态，需逐步迁移 | 全部 UI 对话框 |
| H5 | editorFeatureStore 拆分 | God Store 模式，功能域耦合 | AI/导出/时间线功能 |
| H6 | Timeline.tsx 拆分 (7626行) | 大量模板代码重构 | 时间线 UI |
| H7 | Inspector.tsx 拆分 (8082行) | 14 层嵌套，E2E 测试更新 | 检查器 UI |

---

## 二、Phase 2 架构审计参考方案

### 2.1 超大文件拆分方案（来自 Phase 2 报告）

#### ffmpeg-builder.ts (5215行) → 7 个模块

| 模块名 | 职责 | 预估行数 |
|--------|------|----------|
| `ffmpeg-builder/project-converter.ts` | ExportProject 构建 | ~350 |
| `ffmpeg-builder/export-plan.ts` | 核心导出计划 | ~700 |
| `ffmpeg-builder/settings-normalize.ts` | 设置规范化 | ~300 |
| `ffmpeg-builder/visual-filters.ts` | 视觉滤镜 | ~1500 |
| `ffmpeg-builder/audio-filters.ts` | 音频滤镜 | ~500 |
| `ffmpeg-builder/text-subtitle-filters.ts` | 文本与字幕滤镜 | ~500 |
| `ffmpeg-builder/audio-visualization.ts` | 音频可视化滤镜 | ~700 |
| `ffmpeg-builder/utils.ts` | 辅助函数 | ~250 |

#### model.ts (2713行) → 6 个模块

| 模块名 | 职责 | 预估行数 |
|--------|------|----------|
| `model/index.ts` | Barrel 文件 | ~310 |
| `model/defaults.ts` | 所有 DEFAULT_* 常量 | ~260 |
| `model/media-normalize.ts` | 媒体相关规范化 | ~150 |
| `model/clip-normalize.ts` | Clip 属性规范化 | ~700 |
| `model/track-timeline.ts` | Track/Timeline 规范化 | ~400 |
| `model/factories.ts` | 工厂函数 | ~300 |
| `model/annotations.ts` | 标注/协作/高级功能规范化 | ~600 |

#### tauri-bridge.ts (2520行) → 8 个模块

| 模块名 | 职责 | 预估行数 |
|--------|------|----------|
| `tauri-bridge/index.ts` | Barrel + 基础设施 | ~100 |
| `tauri-bridge/types.ts` | 所有 interface/type | ~700 |
| `tauri-bridge/mock-types.ts` | TauriMocks 接口 | ~170 |
| `tauri-bridge/fs.ts` | 文件系统操作 | ~200 |
| `tauri-bridge/media.ts` | 媒体分析 | ~270 |
| `tauri-bridge/export.ts` | 导出相关 | ~500 |
| `tauri-bridge/window.ts` | 窗口/系统/协作 | ~350 |
| `tauri-bridge/ai-db.ts` | AI API + 媒体索引 | ~430 |

### 2.2 Store 拆分方案

#### editorUIStore (65+ 状态) → 按功能域拆分

| 新 Store | 职责 | 状态数 |
|----------|------|--------|
| `dialogStore.ts` | 对话框开关状态 | ~25 |
| `panelStore.ts` | 面板可见性与布局 | ~15 |
| `toolbarStore.ts` | 工具栏/菜单状态 | ~10 |
| `modalStore.ts` | 模态弹窗状态 | ~15 |

#### editorFeatureStore (God Store) → 按功能域拆分

| 新 Store | 职责 | 状态数 |
|----------|------|--------|
| `aiFeatureStore.ts` | AI 相关功能状态 | ~15 |
| `exportFeatureStore.ts` | 导出相关状态 | ~10 |
| `timelineFeatureStore.ts` | 时间线增强功能 | ~10 |
| `mediaFeatureStore.ts` | 媒体管理功能 | ~10 |
| `collaborationFeatureStore.ts` | 协作功能 | ~10 |

---

## 三、执行计划

### Sprint 1: Store 拆分 (2026-08-01 ~ 2026-08-14)

**目标**: 完成 editorUIStore 和 editorFeatureStore 的拆分

| 任务 | 负责人 | 工作量 | 风险 | 依赖 |
|------|--------|--------|------|------|
| H4.1: 创建 dialogStore.ts | 落小雨 | 2天 | 低 | 无 | ✅ 已完成 |
| H4.2: 创建 panelStore.ts | 落小雨 | 1天 | 低 | 无 | ✅ 已完成 |
| H4.3: 创建 toolbarStore.ts | 落小雨 | 1天 | 低 | 无 | ✅ 已完成 |
| H4.4: 创建 modalStore.ts | 落小雨 | 1天 | 低 | 无 | ✅ 已完成 |
| H4.5: 迁移 UI 组件引用 | 落小雨 | 3天 | 中 | H4.1-H4.4 | ⏳ 待后续 |
| H4.6: 更新 E2E 测试 | 落小雨 | 1天 | 低 | H4.5 | ⏳ 待后续 |
| H5.1: 创建 aiFeatureStore.ts | 落小雨 | 2天 | 低 | 无 | ✅ 已完成 |
| H5.2: 创建 exportFeatureStore.ts | 落小雨 | 1天 | 低 | 无 | ✅ 已完成 |
| H5.3: 创建 timelineFeatureStore.ts | 落小雨 | 1天 | 低 | 无 | ✅ 已完成 |
| H5.4: 迁移功能组件引用 | 落小雨 | 2天 | 中 | H5.1-H5.3 | ⏳ 待后续 |
| H5.5: 更新 E2E 测试 | 落小雨 | 1天 | 低 | H5.4 | ⏳ 待后续 |

**风险控制**:
- 每个 Store 拆分后立即运行 `bun run typecheck` 和 `bun run test`
- 使用 barrel re-export 保持向后兼容
- 保留旧 Store 的 re-export 直到所有引用迁移完成

**验收标准**:
- [x] 新 Store 文件已创建（H4: 4个, H5: 4个）
- [x] 旧 Store 保留为 re-export 入口（向后兼容）
- [x] tsc 0 错误
- [x] 单元测试全部通过（5219 个）
- [ ] 所有旧 Store 引用已迁移（H4.5/H5.4 待后续）
- [ ] E2E 测试全部通过
- [ ] 无循环依赖

---

### Sprint 2: 超大组件拆分 (2026-08-15 ~ 2026-08-28)

**目标**: 完成 Timeline.tsx 和 Inspector.tsx 的拆分

| 任务 | 负责人 | 工作量 | 风险 | 依赖 |
|------|--------|--------|------|------|
| H6.1: 提取 TimelineHeader 组件 | 落小雨 | 1天 | 低 | 无 |
| H6.2: 提取 TimelineTrack 组件 | 落小雨 | 2天 | 中 | 无 |
| H6.3: 提取 TimelineClip 组件 | 落小雨 | 2天 | 中 | 无 |
| H6.4: 提取 TimelineRuler 组件 | 落小雨 | 1天 | 低 | 无 |
| H6.5: 提取 TimelinePlayhead 组件 | 落小雨 | 1天 | 低 | 无 |
| H6.6: 提取 TimelineContextMenu 组件 | 落小雨 | 1天 | 低 | 无 |
| H6.7: 重构 Timeline.tsx 主组件 | 落小雨 | 2天 | 高 | H6.1-H6.6 |
| H6.8: 更新 E2E 测试 | 落小雨 | 1天 | 低 | H6.7 |
| H7.1: 提取 InspectorPanel 组件 | 落小雨 | 1天 | 低 | 无 |
| H7.2: 提取 PropertySection 组件 | 落小雨 | 2天 | 中 | 无 |
| H7.3: 提取 KeyframeEditor 组件 | 落小雨 | 2天 | 中 | 无 |
| H7.4: 重构 Inspector.tsx 主组件 | 落小雨 | 2天 | 高 | H7.1-H7.3 |
| H7.5: 更新 E2E 测试 | 落小雨 | 1天 | 低 | H7.4 |

**风险控制**:
- 每个组件提取后立即运行完整测试套件
- 使用 React.memo 优化重渲染
- 保持 props 接口最小化
- 使用 data-testid 保持 E2E 测试可追踪性

**验收标准**:
- [ ] Timeline.tsx < 1000 行
- [ ] Inspector.tsx < 1000 行
- [ ] tsc 0 错误
- [ ] 单元测试全部通过
- [ ] E2E 测试全部通过
- [ ] 性能无回归（渲染时间无显著增加）

---

### Sprint 3: 超大文件拆分 (2026-08-29 ~ 2026-09-11)

**目标**: 完成 ffmpeg-builder.ts、model.ts、tauri-bridge.ts 的拆分

| 任务 | 负责人 | 工作量 | 风险 | 依赖 |
|------|--------|--------|------|------|
| FFmpeg.1: 拆分 project-converter.ts | 落小雨 | 1天 | 低 | 无 |
| FFmpeg.2: 拆分 export-plan.ts | 落小雨 | 2天 | 中 | 无 |
| FFmpeg.3: 拆分 settings-normalize.ts | 落小雨 | 1天 | 低 | 无 |
| FFmpeg.4: 拆分 visual-filters.ts | 落小雨 | 2天 | 中 | 无 |
| FFmpeg.5: 拆分 audio-filters.ts | 落小雨 | 1天 | 低 | 无 |
| FFmpeg.6: 拆分 text-subtitle-filters.ts | 落小雨 | 1天 | 低 | 无 |
| FFmpeg.7: 拆分 audio-visualization.ts | 落小雨 | 1天 | 低 | 无 |
| FFmpeg.8: 拆分 utils.ts | 落小雨 | 0.5天 | 低 | 无 |
| Model.1: 拆分 model 模块 | 落小雨 | 2天 | 低 | 无 |
| Bridge.1: 拆分 tauri-bridge 模块 | 落小雨 | 2天 | 低 | 无 |
| 拆分.1: 更新所有导入 | 落小雨 | 2天 | 中 | 上述全部 |
| 拆分.2: 更新测试 | 落小雨 | 1天 | 低 | 拆分.1 |

**风险控制**:
- 使用 barrel re-export 模式，保持 `index.ts` 作为唯一公共入口
- 拆分后立即运行 `bun run test` 验证
- 保持函数签名不变，仅移动位置

**验收标准**:
- [ ] ffmpeg-builder.ts 拆分为 7 个模块，每个 < 1500 行
- [ ] model.ts 拆分为 6 个模块，每个 < 700 行
- [ ] tauri-bridge.ts 拆分为 8 个模块，每个 < 700 行
- [ ] tsc 0 错误
- [ ] 单元测试全部通过（247 个 ffmpeg-builder 测试 + 其他）
- [ ] 无循环依赖

---

### Sprint 4: 收尾与验证 (2026-09-12 ~ 2026-09-18)

**目标**: 全面验证、文档更新、性能测试

| 任务 | 负责人 | 工作量 | 风险 | 依赖 |
|------|--------|--------|------|------|
| 验收.1: 全量单元测试 | 落小雨 | 0.5天 | 低 | 全部 |
| 验收.2: 全量 E2E 测试 | 落小雨 | 0.5天 | 低 | 全部 |
| 验收.3: 性能基准测试 | 落小雨 | 1天 | 低 | 全部 |
| 验收.4: 更新架构文档 | 落小雨 | 1天 | 低 | 全部 |
| 验收.5: 更新 CONTRIBUTING.md | 落小雨 | 0.5天 | 低 | 全部 |
| 验收.6: 创建迁移指南 | 落小雨 | 0.5天 | 低 | 全部 |

---

## 四、风险评估与缓解

### 4.1 高风险项

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 组件拆分导致 E2E 测试失败 | 中 | 高 | 保持 data-testid 不变，逐个组件验证 |
| Store 拆分导致状态丢失 | 低 | 高 | 使用 barrel re-export 保持兼容 |
| 循环依赖引入 | 低 | 中 | 每次拆分后运行依赖检查 |
| 性能回归 | 低 | 中 | 拆分前后对比渲染时间 |

### 4.2 回滚策略

每个 Sprint 完成后创建 git tag，如果发现问题可快速回滚：

```bash
git tag -a v4.26.0-sprint1 -m "Sprint 1: Store 拆分完成"
git tag -a v4.26.0-sprint2 -m "Sprint 2: 组件拆分完成"
git tag -a v4.26.0-sprint3 -m "Sprint 3: 文件拆分完成"
```

---

## 五、技术债同步处理

在拆分过程中，同步处理以下技术债：

| ID | 问题 | 处理时机 | 工作量 |
|----|------|----------|--------|
| T3 | 核心 Store 层缺乏测试 | Sprint 1 | +1天 |
| T6 | any 类型使用 (7处) | Sprint 2 | +0.5天 |
| T7 | 空 catch 块 (约20处) | Sprint 3 | +0.5天 |
| 重复代码 | math-utils.ts 提取 | Sprint 3 | +0.5天 |

---

## 六、依赖更新监控

### 6.1 需要监控的依赖

| 依赖 | 当前版本 | 问题 | 监控频率 |
|------|----------|------|----------|
| glib | 0.18.5 | soundness advisory | 每周 |
| atty | 0.2.14 | 未维护 + unaligned read | 每周 |
| quick-xml | 0.39.4 | DoS 漏洞 | 每周 |
| React | 18.x | 规划升级到 19 | 每月 |
| Tailwind CSS | 3.x | 规划升级到 4 | 每月 |

### 6.2 自动化监控

已配置 CI/CD 流水线：
- 每次提交：`bun audit` + `cargo audit`
- 每周一：全量审计 + stale 检查
- 依赖更新 PR 自动触发安全扫描

---

## 七、验收标准总览

### 7.1 功能验收

- [ ] 所有旧 Store/组件引用已迁移
- [ ] 无功能回归
- [ ] 用户体验无变化

### 7.2 质量验收

- [ ] tsc 0 错误
- [ ] 单元测试全部通过（4600+ 个）
- [ ] E2E 测试全部通过（270+ 个）
- [ ] 代码覆盖率 ≥ 80%
- [ ] 无新增 lint 错误

### 7.3 性能验收

- [ ] 渲染时间无显著增加（< 5%）
- [ ] 包大小无显著增加
- [ ] 内存使用无显著增加

### 7.4 架构验收

- [ ] 无循环依赖
- [ ] 每个文件 < 1500 行
- [ ] 每个 Store < 200 行
- [ ] 每个组件 < 500 行

---

## 八、时间表总览

```
2026-08-01 ─────────────────────────────────────────────────────> 2026-09-18
    │ Sprint 1        │ Sprint 2        │ Sprint 3        │ Sprint 4
    │ Store 拆分       │ 组件拆分         │ 文件拆分         │ 收尾验证
    │ (2周)            │ (2周)            │ (2周)            │ (1周)
    ▼                  ▼                  ▼                  ▼
  v4.26.0-sprint1   v4.26.0-sprint2   v4.26.0-sprint3   v4.26.0
```

---

## 九、相关文档

- [Phase 2 架构审计报告](2026-07-15-phase2-architecture-audit.md)
- [修复计划](2026-07-15-fix-plan.md)
- [验证报告](2026-07-15-verification-report.md)
- [已知问题](known-issues.md)

---

**文档维护人**: 落小雨
**最后更新**: 2026-08-01
**下次审查**: 2026-08-15 (Sprint 1 结束后)
