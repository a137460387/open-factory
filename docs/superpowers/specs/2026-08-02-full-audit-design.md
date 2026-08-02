# v4.73.0 全量审计 — 设计方案

**日期**: 2026-08-02
**审计范围**: open-factory v4.73.0 全量
**执行模式**: 7 并行代理 × 深度审计

---

## 审计维度

| # | 维度 | 代理 | 核心任务 |
|---|------|------|----------|
| 1 | 隐私安全 | Agent-Security | cargo/npm audit、IPC 调用链、全量网络请求搜索、沙箱审查、文件路径白名单 |
| 2 | 架构健康 | Agent-Architecture | depcruise 循环依赖、knip 死代码、超大文件、any/as 统计、包边界检查 |
| 3 | 性能稳定 | Agent-Performance | 导出队列状态、后台任务并发、UI 阻塞风险、Web Workers、内存泄漏模式 |
| 4 | 测试质量 | Agent-Testing | vitest coverage 最新数据、覆盖率缺口、E2E/smoke 健康度 |
| 5 | AGENTS.md 规则合规 | Agent-Compliance | 53 条规则逐条验证 |
| 6 | 依赖链健康 | Agent-Dependencies | bun.lock 解析、过时包、版本冲突、Rust CVE |
| 7 | API 契约一致性 | Agent-API | Tauri lib.rs vs tauri-bridge.ts 对齐、前后端类型一致性 |

## 输出物

- 分维度报告: `docs/audit/v4.73.0-{dimension}-audit.md` × 7
- 汇总报告: `docs/audit/v4.73.0-full-audit-report.md`
- 风险等级: CRITICAL / HIGH / MEDIUM / LOW / INFO

## 执行策略

7 个代理并行派发，无依赖关系。每个代理独立读取源码、运行工具、人工抽检关键路径。
完成后汇总发现，评定风险等级。
