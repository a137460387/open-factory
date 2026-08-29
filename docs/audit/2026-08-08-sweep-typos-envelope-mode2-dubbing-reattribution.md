# 收尾扫尾轮：标题笔误评估 + audio-envelope 模式二根因 + dubbing:4 归因更正

- 日期：2026-08-08；分支 main（584942a4），工作区干净，未 push 任何内容。
- 探针：`apps/desktop/e2e-probes-stash/zz-envelope2/3/4/5-probe.spec.ts`（gitignore 目录），
  证据 JSONL：`D:/tmp/envelope2..5-probe-results.jsonl`。

## 任务一：3a731fcc 标题笔误——跳过

3a731fcc 以独立 commit 形式存在于 main 历史（经 #112），"14 处入口"笔误在已推送
commit message 中。CHANGELOG.md 为 Keep-a-Changelog 用户向文件，内部 Rust permit
计数不属于其收录范围；无模块文档枚举该数字。**唯一修正方式是改写已推送 main
历史（rebase/force-push），被明确禁止** → 跳过。事实更正已记录于本地审计文档与
合并前 reword 提交（ad1c0cfc，未入 main）。

## 任务二：audio-envelope 模式二根因（产品侧，只诊断未修）

### 证据链

1. 复现：暖 dev server + workers=1 串行 repeat-5，**原始 spec 4/5 失败** value=0
   （对照：第二轮 5/5 是冷态 fresh server；暖态串行是稳定复现条件）。
2. 探针 v2（页面内 rAF rect 时间线）：失败实例 envelope 先渲染于 y=709，
   ~200ms 后整块上移到 y=657（52px）；失败=在 709 取 box、拖拽时实际已 657，
   光标落于实际底边之外 → y clamp 到 height → value 0。通过实例=跳变先于可见发生。
3. 探针 v4（全页 testid 时间线）：跳变同刻 `editor-main-layout/left-panel/
   right-panel` 高度 398→346（−52px），其下全部上移；顶栏/媒体网格不变。
4. 高度核算：稳态 56+346+6+260=668，缺的 52px = 底部多出的栏。
5. 探针 v5：`preflight-panel` 出现时刻与 envelope 上移**同 tick**（1232/1227 vs
   1232/1228）。

### 根因

`PreflightChecklistPanel` **始终渲染却被 React.lazy 包裹**（ShellFloatingDialogs
第一个 Suspense 组）：其 chunk 在首屏后 ~1.2s 到达，52px 底部栏后置挂载，把主行
整体顶高 52px 再回落 → 首屏后布局跳变。真实用户同样会看到这次跳变（产品侧缺陷，
非 e2e 专属）。audio-envelope spec 在跳变前取 bbox 即失败。

### 过程更正（如实）

本轮曾按"spec 侧未等稳态"的早期归因给 spec 加"连续两次 bbox 一致"稳定信号并验证：
**无效**（跳变发生在伪稳定窗口之后，4/5 仍败），对照实验确认失败与改动无关后已
回滚该 spec 改动、删除临时分支 fix/114-audio-envelope-spec-stability，未留任何代码。

### 方案草案（交用户决定，未动代码）

- P1（产品侧根因，推荐评估）：PreflightChecklistPanel 体积小且始终可见，去掉 lazy
  直接 import（ShellFloatingDialogs.tsx 约 3 行），消除首屏后跳变，e2e 与真实用户
  同时受益；代价是首屏 bundle 略增（该面板依赖的 editor-core 聚合函数多在主包）。
  工作量 S。
- P2（spec 侧确定性信号）：audio-envelope.spec 取 bbox 前
  `await expect(page.getByTestId('preflight-panel')).toBeVisible()`——等跳变参与者
  到场，非 sleep；只修 spec 不修用户可见跳变。工作量 S。
- P3（通用稳定窗口轮询）：不推荐，启发式窗口接近 sleep 掩盖。

## 任务三：dubbing-adaptation:4 归因更正——已被 #117 解决，无需动作

- 本轮负载复现（repeat-6/workers-2）12/12 通过；上轮隔离 2/2 通过。
- 复核 round-1 证据：audio-mixer 拦截行实际归属 **auto-generate.spec.ts:68**
  （已知多态漂移项，非本轮范围）；dubbing:4 在全量日志中的拦截源是匿名 div 链
  = DevPerfOverlay（#117 修复前）。上轮"audio-mixer 产品面板遮挡 dubbing"的
  记载系归因错误，本文更正。
- 结论：dubbing:4 属 overlay 系统性拦截的第 7 个受害者，已随 #117 的
  pointer-events 修复解决；当前 main 无残留问题。auto-generate:68 的 audio-mixer
  遮挡为其自身漂移的一部分，仍待另行排期。
