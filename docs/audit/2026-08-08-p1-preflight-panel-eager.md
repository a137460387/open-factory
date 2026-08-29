# P1 执行：PreflightChecklistPanel 去 lazy（audio-envelope 模式二根因修复）

- 日期：2026-08-08；分支 `fix/114-preflight-panel-eager`（基于 main 584942a4），
  commit `675ea898`，未 push。
- 根因证据见 `2026-08-08-sweep-typos-envelope-mode2-dubbing-reattribution.md` §任务二。

## 评估（收益/代价）

- 收益：消除首屏后 52px 布局跳变（真实用户与 e2e 同受益）；少一次异步 chunk 瀑布。
- 代价实测（check:bundle，修前/修后两次 build）：
  - 修前独立 chunk `PreflightChecklistPanel-*.js` = 4KB；修后消失；
  - 主 chunk index 528→531KB（+3KB，预算 600KB，OK）；JS 总量 5959→5958KB；
  - 组件依赖（editorStore/i18n/editor-core 聚合函数）均已在主包，无新增重依赖。
- 结论：过度拆分确认，代价可忽略，按 P1 执行。

## 修改

ShellFloatingDialogs.tsx：lazy 声明删除、同步 import、移出 Suspense 组；
同组 CharacterTimelinePanel/DubbingAdaptationPanel（条件渲染）保持 lazy，
Suspense 边界保留。1 文件 +6/−4。

## 验证

| 项 | 修前 | 修后 |
|---|---|---|
| audio-envelope 暖态串行 ×5 | 4 败/1 过 | **5/5 过** |
| typecheck / build | — | 0 / 0 |
| preflight 回归（timecode:4、export:215、export-warmup:4、preflight-checklist:4/55） | — | 全绿 |
| 首屏布局子集 8 文件（app-launch/timeline-basic/timeline-ruler/preview/export/export-warmup/timecode/preflight-checklist） | — | 17 过/9 败，9 败逐条 ∈ 基线 97，**零新增** |

子集选择依据：preflight 三 spec 直接覆盖被改组件的功能路径（含 #117 自动切步）；
app-launch/timeline-*/preview 对主行几何（52px 跳变影响区）最敏感；export 族覆盖
导出对话框与面板共存场景。

## 遗留

- 本提交未 push，是否开 PR 等用户指示。
- 97 基线其余簇、auto-generate:68 等仍待排期（见前序审计文档）。
