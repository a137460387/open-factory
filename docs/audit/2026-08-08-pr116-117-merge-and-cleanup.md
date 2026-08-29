# issue #114 合并轮终报：#116/#117 合并 + 本地分支清理

- 日期：2026-08-08
- 合并结果：
  - #116 → squash `e6f80598`（上一轮）
  - #117 → merge commit `584942a4`（本轮；head 侧追加解决冲突的合并 commit `dc423aed`）
- 豁免依据：frontend（bun audit high 漏洞）与 e2e（2×20min 超时）为 main 预存失败，
  用户两轮明确批准豁免；必需项 rust 在两个 PR 的最终 head 上均 pass。

## 冲突解决（5 文件，机械取 pr3 侧）

- 完整清单（不截断核实，UU=5）：export-scheduler.ts、export-scheduler.test.ts、
  export.spec.ts、export-warmup.spec.ts、DevPerfOverlay.tsx。
- 方向：在 114-pr3-fixes 上 merge origin/main；先验证 stage2==pr3、stage3==main
  后 checkout --ours 取 pr3 侧；5 文件逐个 diff 与 pr3 原版一致；合并树与 pr3
  原版树零差异；过程中 `git add -A` 误 stage 8 份未跟踪审计文档，提交前已 unstage，
  合并 commit 仅含解决内容。
- push dc423aed 后首次 gh pr merge 被分支保护拒绝（新 head 的 rust 尚 pending）；
  轮询至 rust pass（5m15s）后 --merge 成功，未用 --admin。

## 合并后验证

- origin/main 树 == 114-pr3-fixes 树（0 行 diff）；6 个修复提交均为 main 祖先
  （e003602a/b0e20650/6350100a/5e041292/a0a17f89/f699b80d）→ 独立可 revert 形态保留。
- main 上 typecheck exit 0；冲突标记全量扫描 0。
- 单测 51/51：export-scheduler 35 + usePerfMonitor 8 + DevPerfOverlay 单测 6
  （含 e2e 穿透/dev 可交互）+ 集成 2。
- targeted e2e：export-warmup 全过；export.spec 4 败 = 基线已知签名
  （:105 export-batch-paths 移除簇；:3/79/133 步骤导航类），无新增。

## 本地分支清理（删 4 留其余既有分支）

| 分支 | 验证方式 | 结果 |
|---|---|---|
| 114-pr1-chore | 9/9 非 merge 提交 patch-id ∈ main | 已删 |
| 114-pr2-core | diff(pr2,main) == diff(pr2,pr3)（main 恰多 pr3 增量） | 已删 |
| 114-pr3-fixes | 树 diff 0 | 已删 |
| fix/114-dev-perf-overlay-render-loop | 树 diff 0 | 已删 |

远程 origin/114-pr2-core、origin/114-pr3-fixes 保留（已合并 PR 的 head，未要求删除）。
最终本地当前分支 = main；其余本地分支均为仓库既有、与本任务无关，未动。

## 已知遗留（非本轮范围）

- main 上 3a731fcc 标题仍为"14 处入口"（reword 未随 #112 进入 main），纯文案。
- frontend audit / e2e 超时为仓库级预存问题，待另行处理。
- 97 个 e2e drift 失败的后续簇（移除类决策、值断言、面板长尾、audio-envelope
  模式二、dubbing:4 audio-mixer 遮挡）仍待用户排期。
