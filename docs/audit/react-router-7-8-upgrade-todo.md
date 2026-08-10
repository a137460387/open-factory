# 待办:react-router 7 → 8 升级评估

- 状态:**安全动因已消除**(2026-08-10);8.x 升级降为可选的现代化事项,待排期
- 创建:2026-08-03
- 来源:GHSA-qwww-vcr4-c8h2 — React Router: RSC Mode CSRF Bypass Allows
  Action Execution Before 400 Response,High (CVSS 7.1, CWE-352)
- 受影响版本:react-router >=7.12.0 <7.18.2(08-03 评估时通告范围写作
  <8.3.0;其后官方在 v7 线发布了回溯修复 7.18.2,实测升级后 bun audit
  该通告消除)
- 现状:`apps/creator-dashboard/package.json` 直接依赖
  `react-router-dom@^7.18.2`(传递依赖 `react-router@7.18.2`,见 bun.lock)
- 历史判定(2026-08-03):该漏洞仅影响使用 unstable RSC API 的应用;
  creator-dashboard-web 无 RSC API 调用,故当时以 --ignore 豁免。
- 2026-08-10:react-router-dom 升级 7.18.1 → 7.18.2(patch 级,v7 内),
  ci.yml 两处 `--ignore=GHSA-qwww-vcr4-c8h2` 随之移除。

## 若未来执行 8.x 升级(可选)

1. 升级 react-router-dom 至 8.x(breaking change 排查 + 回归测试)
2. 确认 `bun audit --audit-level=high` 仍通过
