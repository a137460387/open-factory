# 阶段二：低覆盖率文件清单（#9）

> 数据来源：docs/evidence/coverage-low-2026-08-13.txt（bun run test --coverage 生成）
> 基线：326 个文件低于阈值（editor-core 80% / 其余 70%）
> 聚焦范围：useEditorShell* 编排层 0% 覆盖率文件

---

## useEditorShell* 编排层 0% 覆盖文件清单

共 12 个文件，合计约 4,198 行，全部位于 apps/desktop/src/hooks/。

| 文件 | 行数 | 覆盖率 | 职责 |
|------|------|--------|------|
| useEditorShellOrchestrator.ts | 394 | 0%/0%/0% | 编排层入口：组合所有 shell hooks，统一导出给 EditorShell 组件使用 |
| useEditorShellCallbacks.ts | 902 | 0%/0%/0% | 回调工厂集合：创建所有用户交互回调（playback、timeline、project、export 等），最大的单文件 |
| useEditorShellStoreSubscriptions.ts | 353 | 0%/0%/0% | Store 订阅同步：将 Zustand store 状态变化同步到 shell 本地状态 |
| useEditorShellInlineCallbacks.ts | 418 | 0%/0%/0% | 内联回调：timeline clip 操作、媒体导入、导出触发等即时回调 |
| useEditorShellOperationRecording.ts | 400 | 0%/0%/0% | 操作录制：macro 录制/回放状态管理、操作历史追踪 |
| useEditorShellDerivedState.ts | 326 | 0%/0%/0% | 派生状态：基于 store 原始数据计算派生值（选中 clip、当前时间等） |
| useEditorShellFloatingDialogsCallbacks.ts | 289 | 0%/0%/0% | 浮动对话框回调：操作回放速度、媒体版本对比、频谱图等弹窗回调 |
| useEditorShellInteractions.ts | 276 | 0%/0%/0% | 交互管理：键盘快捷键、拖拽、缩放等用户交互处理 |
| useEditorShellSettings.ts | 260 | 0%/0%/0% | 设置管理：应用设置读写、硬件加速、自动保存等配置 hook |
| useEditorShellProfiler.ts | 221 | 0%/0%/0% | 性能分析：录制/报告性能数据、耗时追踪 |
| useEditorShellEffects.ts | 193 | 0%/0%/0% | 副作用：自动保存定时器、窗口关闭守卫、项目恢复等 useEffect |
| useEditorShellPanelCallbacks.ts | 166 | 0%/0%/0% | 面板回调：右侧面板（Inspector、MediaBin、Export 等）的开关/内容回调 |

---

## 优先级排序

排序依据：被依赖广度（import 链上游优先） > 变更频率（git log 活跃度） > 代码行数 > 历史 bug 密度

### P0（最高优先级）—— 编排层核心

| 优先级 | 文件 | 行数 | 理由 |
|--------|------|------|------|
| **P0-1** | useEditorShellOrchestrator.ts | 394 | 编排层唯一入口，所有其他 shell hooks 通过它组合。覆盖它等于间接覆盖整个编排层的集成路径。最高 fan-in（被 EditorShell 直接引用）。 |
| **P0-2** | useEditorShellCallbacks.ts | 902 | 最大单文件（902 行），所有用户交互回调的工厂函数。变更频率最高（每次新增功能都会动）。历史 bug 热点。 |

### P1（高优先级）—— Store 桥接与派生状态

| 优先级 | 文件 | 行数 | 理由 |
|--------|------|------|------|
| **P1-1** | useEditorShellStoreSubscriptions.ts | 353 | Zustand → shell 状态同步桥接，数据流关键节点。状态同步逻辑出错会导致 UI 不一致。 |
| **P1-2** | useEditorShellDerivedState.ts | 326 | 派生状态计算（useMemo 密集型），纯逻辑函数，测试成本低但收益高。 |
| **P1-3** | useEditorShellEffects.ts | 193 | 自动保存、窗口守卫、项目恢复等关键副作用。这些逻辑出错直接影响用户数据安全。 |

### P2（中优先级）—— 功能模块

| 优先级 | 文件 | 行数 | 理由 |
|--------|------|------|------|
| **P2-1** | useEditorShellInlineCallbacks.ts | 418 | Timeline 交互回调，覆盖常见的 clip 操作路径。 |
| **P2-2** | useEditorShellInteractions.ts | 276 | 键盘/鼠标交互，UI 行为测试。 |
| **P2-3** | useEditorShellSettings.ts | 260 | 设置读写逻辑，可独立测试。 |

### P3（低优先级）—— 辅助模块

| 优先级 | 文件 | 行数 | 理由 |
|--------|------|------|------|
| **P3-1** | useEditorShellOperationRecording.ts | 400 | Macro 录制功能，当前功能未完全启用。 |
| **P3-2** | useEditorShellProfiler.ts | 221 | 性能分析工具，开发辅助功能。 |
| **P3-3** | useEditorShellPanelCallbacks.ts | 166 | 面板回调，逻辑简单，行数最少。 |
| **P3-4** | useEditorShellFloatingDialogsCallbacks.ts | 289 | 浮动弹窗回调，相对独立。 |

---

## 补充说明

- 另外 8 个 useEditorShell*Callbacks 文件（ContentAnalysis、Media、Misc、Playback、Project、Proxy、Timeline、ViewSettings）已有测试文件覆盖，未列入本清单。
- 全量 326 个低覆盖率文件中，apps/desktop 占 200 个，其中 0% 覆盖的约 46 个。本清单聚焦编排层核心 12 个。
- 建议从 P0-1（Orchestrator）开始，以集成测试方式覆盖编排层的主路径，可带动下游 hooks 获得间接覆盖。
