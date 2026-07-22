# Sprint AM 深度健康报告

**审计日期**: 2026-07-22
**项目版本**: v4.61.0
**审计范围**: 安全、依赖、架构、测试覆盖率

---

## 1. 安全漏洞状态

### 1.1 漏洞概览

| 级别 | 数量 | 状态 |
|------|------|------|
| **Critical** | 1 | ⚠️ 需修复 |
| **High** | 10 | ⚠️ 需修复 |
| **Moderate** | 10 | ℹ️ 评估中 |
| **Low** | 2 | ℹ️ 可接受 |
| **总计** | **23** | — |

### 1.2 Critical 漏洞

| 包名 | 漏洞 | 影响范围 |
|------|------|----------|
| **vitest** <3.2.6 | Vitest UI server 任意文件读取和执行 | 所有使用 vitest 的 workspace |

**修复方案**: `bun update vitest@latest`

### 1.3 High 漏洞

| 包名 | 漏洞 | 影响范围 |
|------|------|----------|
| **vite** ≤6.4.2 | Windows 路径遍历绕过 `server.fs.deny` | desktop, creator-dashboard-web |
| **vite** ≤6.4.2 | 优化依赖 .map 路径遍历 | desktop, creator-dashboard-web |
| **sharp** <0.35.0 | libvips 继承漏洞 (CVE-2026-33327 等) | ai-generator |
| **brace-expansion** ≥2.0.0 <2.1.2 | DoS 指数时间展开 | typedoc, vitest |
| **Next.js** 多个版本 | SSRF、DoS、缓存投毒、中间件绕过 | plugin-market-web |

**修复方案**:
- vite: `bun update vite@latest`
- sharp: `bun update sharp@latest` (需检查 API 兼容性)
- Next.js: `bun update next@latest` (需检查插件市场兼容性)

### 1.4 Moderate 漏洞

| 包名 | 漏洞 |
|------|------|
| **launch-editor** | Windows UNC 路径 NTLMv2 hash 泄露 |
| **postcss** <8.5.10 | XSS via unescaped </style> |
| **Next.js** | Image Optimizer DoS、RSC 缓存投毒等 |

### 1.5 与 v4.59.0 对比

| 指标 | v4.61.0 | v4.59.0 | 变化 |
|------|---------|---------|------|
| 漏洞总数 | 23 | 0 | ⚠️ +23 |
| Critical | 1 | 0 | +1 |
| High | 10 | 0 | +10 |

**分析**: v4.59.0 审计时报告零漏洞，当前漏洞主要来自新增的 web 应用（plugin-market-web, creator-dashboard-web）引入了 Next.js 和更新的 vite。

**新增漏洞来源**:
- Next.js 漏洞: plugin-market-web 引入
- vite 漏洞: desktop + creator-dashboard-web
- sharp 漏洞: ai-generator
- vitest 漏洞: 所有使用 vitest 的 workspace

---

## 2. 依赖健康度分析

### 2.1 核心依赖版本

| 依赖 | 当前版本 | 最新稳定版 | 状态 |
|------|----------|-----------|------|
| react | ≥18.0.0 | 19.x | ℹ️ 可选升级 |
| vite | ≤6.4.2 | 6.4.x+ | ⚠️ 需升级 |
| fastify | ^5.0.0 | 5.x | ✅ 最新 |
| typescript | — | 5.x | ✅ |
| vitest | <3.2.6 | 3.2.6+ | ⚠️ 需升级 |

### 2.2 Packages 依赖分布

| Package | 运行时依赖数 | 状态 |
|---------|-------------|------|
| editor-core | 1 (earcut) | ✅ 极简 |
| api-client | 0 | ✅ 零依赖 |
| api-gateway | 7 | ✅ 合理 |
| sdk | 0 | ✅ 零依赖 |
| collaboration-server | — | 待查 |
| ai-generator | — | 含 sharp |

### 2.3 未使用依赖风险

v4.59.0 审计已移除 8 个未使用依赖。当前状态：
- api-gateway 从 13 依赖精简至 7 个 ✅
- 无明显新增未使用依赖

---

## 3. 架构耦合度评估

### 3.1 循环依赖状态

| 类型 | 数量 | 状态 |
|------|------|------|
| import type 循环 | 18 | ✅ 运行时无害 |
| 运行时循环 | 0 | ✅ |

**详细循环链**:
- `model-types.ts` 是核心枢纽，参与 **10/18** 个循环
- 涉及: ai-emotion-tone, ai-preflight-checklist, color-node-graph, content-analysis, motion-graphics
- 其他循环: effects↔motion-blur, model↔annotations↔data-subtitle, export/publish-pipeline↔release-workflow

**根因**: 类型定义（model-types.ts）与业务逻辑耦合严重。建议将纯类型定义与业务类型分离。

### 3.2 Packages 耦合分析

#### api-client / api-gateway / sdk 三角关系

```
api-client ←→ api-gateway: 无直接依赖 ✅
api-client ←→ sdk: 无直接依赖 ✅
api-gateway ←→ sdk: 无直接依赖 ✅
```

**结论**: 三者完全解耦，仅通过类型定义共享接口。

**注意**: sdk 和 plugin-cli 为**空壳包**（无运行时依赖），需确认是否已废弃或未完成。

#### 版本协议问题

| 链路 | 协议 | 风险 |
|------|------|------|
| plugin-sdk → editor-core | `0.6.0` (固定) | ⚠️ 版本漂移 |
| plugin-market → plugin-sdk | `0.6.0` (固定) | ⚠️ 版本漂移 |
| cli → editor-core | `workspace:*` | ✅ |

#### desktop → editor-core 依赖

| 指标 | 值 |
|------|-----|
| 导入语句数 | 569 |
| 依赖方式 | `@open-factory/editor-core` |
| 耦合度评估 | ⚠️ 高度耦合 |

**分析**: desktop 对 editor-core 有 569 处导入，这是预期的——desktop 是 editor-core 的主要消费方。但导入数量较多，建议：
1. 检查是否有不必要的直接导入（应通过 barrel 文件）
2. 评估是否需要进一步拆分 editor-core 的导出

### 3.3 架构健康度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 循环依赖 | 9/10 | 仅有无害的 import type 循环 |
| 包间耦合 | 8/10 | 核心包解耦良好 |
| 依赖管理 | 7/10 | 存在安全漏洞需修复 |
| **综合** | **8/10** | 架构健康，需关注安全 |

---

## 4. 测试覆盖率盲区

### 4.1 总体覆盖率

| 指标 | v4.61.0 | 阈值 | 状态 |
|------|---------|------|------|
| 测试文件 | 479 | — | ✅ |
| 测试用例 | 7994 | — | ✅ |
| 通过率 | 99.99% | 100% | ⚠️ 1 failed |

### 4.2 低覆盖率模块清单 (<70%)

| 模块 | 覆盖率 | 优先级 | 说明 |
|------|--------|--------|------|
| **headless** | 24.35% | 中 | CLI 无头模式 |
| **cli/core** | 26.81% | 中 | CLI 核心逻辑 |
| **performance** | 43.29% | 高 | 性能监控模块 |
| **ai-worker** | 9.49% | 中 | AI Worker 线程 |
| **stdin** | 9.33% | 低 | CLI stdin 输入 |
| **collaboration** | 62.1% | 高 | 协作模块 |
| **quality** | 67.51% | 高 | 质量评估模块 |
| **sync** | 69.93% | 高 | 同步模块 |
| **annotations** | 50.37% | 中 | 标注模块 |
| **template-io** | 53.06% | 中 | 模板 I/O |
| **ai-generation** | 56.47% | 高 | AI 生成模块 |
| **ai-inference** | 60.38% | 高 | AI 推理模块 |

### 4.3 sync 模块详细分析

| 子模块 | 覆盖率 | 状态 |
|--------|--------|------|
| `project-sync.ts` | 90.28% | ✅ |
| `multi-device-sync.ts` | 54.33% | ⚠️ |
| `index.ts` | 0% | ⚠️ 仅导出 |

**分析**: sync 模块整体 69.93%，主要短板在 `multi-device-sync.ts`（54.33%）。`project-sync.ts` 覆盖良好。

### 4.4 零覆盖率文件

| 文件 | 说明 |
|------|------|
| `types/webgpu.d.ts` | 类型定义，无需测试 |
| `types/plugin-types.ts` | 类型定义，无需测试 |
| 各 `index.ts` | 桶文件，无需测试 |

---

## 5. 健康度总结

### ✅ 健康指标

1. **架构解耦良好** - 核心包之间零循环依赖
2. **依赖精简** - editor-core 仅 1 个运行时依赖
3. **测试覆盖广泛** - 7994 个测试用例

### ⚠️ 需关注

1. **安全漏洞 23 个** - 含 1 个 critical（vitest）
2. **性能退化** - typecheck +119%, test +62%
3. **覆盖率盲区** - 12 个模块低于 70%

### 🔴 紧急事项

1. 升级 vitest 修复 critical 漏洞
2. 升级 vite 修复 high 漏洞
3. 修复 super-resolution.test.ts 失败用例

---

**报告生成时间**: 2026-07-22
**审计工具**: bun audit, vitest --coverage, manual analysis
