# Sprint AM 优化方案建议

**审计日期**: 2026-07-22
**基于版本**: v4.61.0
**目标**: 为下一阶段 Sprint 提供优化方向

---

## 1. 技术债优先级清单

### 1.1 高优先级（必须修复）

| # | 技术债 | 影响范围 | 修复成本 | 收益 |
|---|--------|----------|----------|------|
| 1 | **vitest 安全漏洞 (Critical)** | 所有 workspace | 低 (升级) | 安全合规 |
| 2 | **vite 安全漏洞 (High)** | desktop, web apps | 低 (升级) | 安全合规 |
| 3 | **super-resolution 测试失败** | CI 绿灯 | 低 | 测试稳定性 |
| 4 | **typecheck 性能退化 (+119%)** | 开发效率 | 中 | 开发体验 |

### 1.2 中优先级（下一 Sprint）

| # | 技术债 | 影响范围 | 修复成本 | 收益 |
|---|--------|----------|----------|------|
| 5 | **clamp 去重未完成 (119 处)** | 代码一致性 | 高 (3-5 天) | 可维护性 |
| 6 | **sync 模块覆盖率不足 (69.93%)** | 质量保障 | 中 (2 天) | 测试覆盖 |
| 7 | **performance 模块低覆盖 (43.29%)** | 性能监控 | 中 (2 天) | 测试覆盖 |
| 8 | **collaboration 模块低覆盖 (62.1%)** | 协作功能 | 中 (2 天) | 测试覆盖 |
| 9 | **Next.js 安全漏洞 (High)** | plugin-market | 低 (升级) | 安全合规 |
| 10 | **sharp 安全漏洞 (High)** | ai-generator | 中 (API 变更) | 安全合规 |
| 11 | **model-types.ts 循环依赖枢纽** | editor-core | 中 (2 天) | 架构健康 |
| 12 | **sdk/plugin-cli 空壳包** | monorepo 整洁 | 低 (0.5 天) | 维护清晰 |

### 1.3 低优先级（可延后）

| # | 技术债 | 影响范围 | 修复成本 | 收益 |
|---|--------|----------|----------|------|
| 11 | **headless 低覆盖 (24.35%)** | CLI 功能 | 中 | 测试覆盖 |
| 12 | **cli/core 低覆盖 (26.81%)** | CLI 功能 | 中 | 测试覆盖 |
| 13 | **lerp 去重 (2 处残留)** | 代码一致性 | 低 | 可维护性 |
| 14 | **desktop formatTime 残留** | 代码一致性 | 低 | 可维护性 |

---

## 2. 修复方案详细设计

### 2.1 安全漏洞修复（高优）

**紧急修复** (1-2 天):
```bash
# 升级 vitest 修复 critical 漏洞
bun update vitest@latest

# 升级 vite 修复 high 漏洞
bun update vite@latest

# 验证
bun audit
bun run test
bun run typecheck
```

**Next.js 修复** (需评估):
```bash
# 检查 plugin-market-web 兼容性
cd apps/plugin-market-web
bun update next@latest
bun run build
```

**sharp 修复** (需评估):
```bash
# 检查 ai-generator 兼容性
cd packages/ai-generator
bun update sharp@latest
# 检查 API 变更
```

### 2.2 性能退化修复（高优）

**typecheck 优化方案**:
1. 启用增量编译：`tsc -b --incremental`
2. 检查 tsconfig.json 的 `composite` 配置
3. 考虑使用 `tsc --noEmit` 替代 `tsc -b`（如果不需要构建产物）

**测试性能优化方案**:
1. 将 `super-resolution.test.ts` 拆分为更小的测试块
2. 使用 `--reporter=dot` 减少输出开销
3. 考虑并行测试（vitest 默认已启用）

### 2.3 clamp 去重深化（中优）

**Phase 1: color-grading 模块** (1 天)
```
目标文件:
- color-grading/types.ts (3 处 clamp 变体)
- color-grading/hsl-qualifier.ts
- color-grading/window-mask.ts

方案: 统一使用 utils/math.ts 的 clamp/clamp01
```

**Phase 2: export 模块** (1 天)
```
目标文件:
- export/export-queue.ts
- export/ffmpeg-builder/visual-filters.ts
- export/frame-interpolation.ts
- export/progressive.ts
- export/publish-pipeline.ts
- export/render-farm.ts
- export/resource-dashboard.ts
- export/scheduling.ts

方案: 创建 export/utils.ts 集中定义专用 clamp
```

**Phase 3: audio 模块** (1 天)
```
目标文件:
- audio/ducking.ts
- audio/noise-reduction.ts
- audio/vu-meter.ts

方案: 统一使用 utils/math.ts 或 audio/utils.ts
```

**Phase 4: desktop 模块** (2 天)
```
目标文件:
- ColorNodeEditorDialog.tsx
- AudioMixer.tsx
- Inspector/ColorEditors.tsx
- Inspector/CurveEditors.tsx
- Inspector/KeyframeCurveEditor.tsx

方案: 从 editor-core 导入，或创建 desktop/utils/math.ts
```

### 2.4 测试覆盖率提升（中优）

**sync 模块** (2 天):
```
目标: 69.93% → 80%+
重点: multi-device-sync.ts (54.33% → 75%+)
方法: 补充边界条件测试、错误处理测试
```

**performance 模块** (2 天):
```
目标: 43.29% → 70%+
重点: profiler.ts, performance-monitor.ts
方法: 补充性能指标采集测试
```

**collaboration 模块** (2 天):
```
目标: 62.1% → 75%+
重点: ws-transport.ts, color-collaboration.ts
方法: 补充 WebSocket 连接测试
```

---

## 3. 架构演进建议

### 3.1 下一阶段解耦方向

#### 方向 A: editor-core 进一步拆分

**现状**: editor-core 仍有 862KB 主包，包含大量功能模块

**建议拆分**:
```
editor-core (862KB)
├── editor-core-timeline (250KB) - 时间线核心
├── editor-core-color (150KB) - 调色模块
├── editor-core-audio (100KB) - 音频模块
├── editor-core-subtitles (80KB) - 字幕模块
├── editor-core-media (150KB) - 媒体管理
└── editor-core-core (132KB) - 最小核心
```

**收益**: 更细粒度的代码分割，按需加载
**成本**: 3-5 天，需要重新设计导出结构

#### 方向 B: desktop 巨型组件继续拆分

**现状**: 最大组件仍有 3807 行 (ExportDialog)

**建议拆分**:
- ExportDialog → 6 个子组件（已完成 6 个，继续拆分剩余）
- Timeline → 按功能区域拆分
- PreviewCanvas → 按功能模块拆分

**收益**: 更好的可维护性
**成本**: 2-3 天/组件

#### 方向 C: 引入架构约束工具

**建议工具**:
1. **dependency-cruiser** - 依赖规则检查
2. **madge** - 循环依赖检测（已有）
3. **eslint-plugin-import** - 导入规则

**配置示例** (dependency-cruiser):
```json
{
  "forbidden": [{
    "name": "no-circular",
    "severity": "error",
    "from": {},
    "to": { "circular": true }
  }, {
    "name": "no-orphans",
    "severity": "warn",
    "from": {},
    "to": { "orphan": true }
  }]
}
```

**收益**: 自动化架构守护
**成本**: 1 天配置 + 持续维护

### 3.2 性能预算指标建议

| 指标 | 目标 | 当前值 | 状态 |
|------|------|--------|------|
| **主包体积** | <1 MB | 862 KB | ✅ |
| **首屏 JS** | <500 KB | 433 KB (index) | ✅ |
| **vendor chunk** | <600 KB | 489 KB | ✅ |
| **i18n chunk** | <400 KB | 352 KB | ✅ |
| **typecheck** | <30s | 28.4s | ✅ |
| **test 全量** | <120s | 172.7s (含覆盖率) | ⚠️ |
| **build** | <60s | — | 待测 |

**建议**:
1. typecheck 28.4s 已在 30s 目标内 ✅
2. 将 test 目标设为 <120s（当前 172.7s 含覆盖率插桩开销）
3. 在 CI 中集成这些指标检查

---

## 4. Sprint AN 建议规划

### 4.1 推荐 Sprint 范围

**Sprint AN: 安全修复与架构优化**

| 任务 | 优先级 | 预估 | 负责 |
|------|--------|------|------|
| 升级 vitest/vite/next/sharp | 高 | 2 天 | — |
| 修复 super-resolution 测试超时 | 高 | 0.5 天 | — |
| clamp 去重 Phase 1-2 | 中 | 2 天 | — |
| sync/performance 覆盖率提升 | 中 | 2 天 | — |
| model-types.ts 类型解耦 | 中 | 2 天 | — |
| sdk/plugin-cli 状态确认 | 低 | 0.5 天 | — |
| dependency-cruiser 集成 | 低 | 1 天 | — |

**总预估**: 10 天

### 4.2 成功标准

- [ ] bun audit 漏洞数降至 0
- [ ] typecheck 耗时 <30s ✅ (当前 28.4s)
- [ ] test 耗时 <120s (含覆盖率)
- [ ] clamp 去重完成率 >60%
- [ ] sync 模块覆盖率 >80%
- [ ] 所有测试通过（0 failed）
- [ ] model-types.ts 循环依赖数降至 <5

---

**报告生成时间**: 2026-07-22
**审计工具**: manual analysis
