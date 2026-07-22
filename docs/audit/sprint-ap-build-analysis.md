# Sprint AP 构建产物深度分析报告

**生成日期**: 2026-07-23
**分析范围**: apps/desktop Vite 构建配置 + packages/editor-core

---

## 1. TypeScript 编译性能

| 指标 | v4.62.0 基线 | Sprint AP 优化后 | 目标 |
|------|-------------|----------------|------|
| typecheck (首次) | 28.4s | 24.16s | <25s ✅ |
| typecheck (增量) | N/A | 23.22s | <25s ✅ |

### 优化因素
- **循环依赖消除**: 18→0 个循环依赖，减少了 TypeScript 的类型解析深度
- **composite/incremental**: editor-core 已启用 `composite: true`，`.tsbuildinfo` 缓存生效
- **skipLibCheck**: 所有 tsconfig 已启用，跳过第三方 `.d.ts` 检查

### 建议
- 当前性能已达标，无需额外优化
- 如需进一步提速，可考虑将 `apps/desktop` 也启用 `composite: true`

---

## 2. 架构健康度

### 循环依赖状态

| 检查工具 | 结果 |
|----------|------|
| madge --circular | ✅ 0 circular dependency |
| dependency-cruiser | ✅ 0 errors, 6 warnings (orphan) |

### 新增架构守护
- `.dependency-cruiser.cjs` — 配置文件，禁止循环依赖和跨层违规
- `package.json` 新增 `depcruise` 和 `depcruise:ci` 脚本

### 模块分层
```
model-types-primitives.ts  (叶节点，零依赖)
    ↑
model-types.ts             (组合层，从 primitives + feature 模块组装)
    ↑
feature modules            (effects, color-node-graph, etc.)
```

---

## 3. 代码去重成果

### editor-core 层
| 函数 | 重复数 | 去重方式 |
|------|--------|----------|
| normalizeOptionalHexColor | 2→1 | 提取到 math-utils.ts |
| normalizeQualityEnhancement | 2→1 | 统一从 clip-normalize.ts 导入 |

### desktop 层
| 函数 | 重复数 | 去重方式 |
|------|--------|----------|
| clampUnit | 3→0 | 使用 clamp01 from editor-core |
| clampSigned | 3→0 | 使用 clamp(v, -1, 1) from editor-core |
| clamp (local) | 1→0 | 导入 editor-core clamp |
| formatDuration (M:SS) | 2→0 | 使用 formatTimeShort from editor-core |

---

## 4. 测试覆盖率提升

| 模块 | 优化前 | 新增测试 | 测试总数 |
|------|--------|----------|----------|
| profiler.ts | 0 tests | 27 tests | 27 |
| performance-monitor.ts | 0 tests | 20 tests | 20 |
| color-collaboration.ts | 0 tests | 55 tests | 55 |
| ws-transport.ts | 0 tests | 54 tests | 54 |
| **总计** | — | **+156** | **8209** |

---

## 5. 构建产物分析

### Vite 配置要点
- 使用 `manualChunks` 分离 vendor、react-vendor、ui-vendor 等
- editor-core 作为独立包，通过 bundler 模式解析

### 优化建议（未实施，需进一步评估）
1. **vendor 包 (489KB)**: 包含 zustand、lucide-react、nanoid 等
   - lucide-react 图标库可考虑按需导入
   - zustand 体积小，无需优化
2. **app-utils (299KB)**: 包含工具函数和业务逻辑
   - 可考虑按功能域拆分
3. **editor-core (862KB)**: 核心编辑器逻辑
   - 已通过 tree-shaking 优化
   - 可考虑将 AI 模块（体积大）延迟加载

---

## 6. 交付物清单

| 交付物 | 状态 | 位置 |
|--------|------|------|
| model-types-primitives.ts | ✅ | packages/editor-core/src/ |
| .dependency-cruiser.cjs | ✅ | 项目根目录 |
| effect-types.ts | ✅ | packages/editor-core/src/ |
| queue-types.ts | ✅ | packages/editor-core/src/export/ |
| publish-types.ts | ✅ | packages/editor-core/src/export/ |
| lut-normalize.ts | ✅ | packages/editor-core/src/ |
| profiler.test.ts | ✅ | packages/editor-core/src/ |
| performance-monitor.test.ts | ✅ | packages/editor-core/src/ |
| color-collaboration.test.ts | ✅ | packages/editor-core/src/collaboration/ |
| ws-transport.test.ts | ✅ | packages/editor-core/src/collaboration/ |
| 本分析报告 | ✅ | docs/audit/sprint-ap-build-analysis.md |
