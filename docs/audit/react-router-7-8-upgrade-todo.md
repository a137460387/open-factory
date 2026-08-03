# 待办:react-router 7 → 8 升级评估

- 状态:待排期(后续 sprint),不属当前审计修复任务
- 创建:2026-08-03
- 来源:GHSA-qwww-vcr4-c8h2 — React Router: RSC Mode CSRF Bypass Allows
  Action Execution Before 400 Response,High (CVSS 7.1, CWE-352)
- 受影响版本:react-router >=7.12.0 <8.3.0;修复版本 8.3.0
- 现状:`apps/creator-dashboard/package.json` 直接依赖
  `react-router-dom@^7.18.1`(传递依赖 `react-router@7.18.1`,见 bun.lock)
- 当前判定(2026-08-03):该漏洞仅影响使用 unstable RSC API 的应用;
  creator-dashboard-web 无 RSC API 调用,故不构成实际风险。ci.yml 两处
  bun audit 步骤以 `--ignore=GHSA-qwww-vcr4-c8h2` 豁免,并保留注释可追溯。
- 升级评估需覆盖:breaking change 排查 + 回归测试

## 升级完成后的收尾动作

1. 升级 react-router-dom 至 >=8.3.0(更新 package.json / bun.lock)
2. 移除 ci.yml 中两处 `--ignore=GHSA-qwww-vcr4-c8h2`
   (frontend job 与 security-scan job)
3. 确认 `bun audit --audit-level=high` 通过
