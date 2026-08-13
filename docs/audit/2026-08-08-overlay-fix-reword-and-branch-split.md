# overlay 遮挡修复 + 历史 reword + 三分支拆分 + stash 清理

- 日期：2026-08-08
- 分支：`fix/114-dev-perf-overlay-render-loop`，HEAD = `10845b13`
- 新本地分支（均无上游、未 push）：
  - `114-pr1-chore` = fe6048cd
  - `114-pr2-core` = c45cb7c0
  - `114-pr3-fixes` = 10845b13
- 证据：`/d/tmp/postfix-6specs-w2.log`（6 过 2 败）、dubbing 隔离单跑 2/2、
  `/d/tmp/vitest` 相关单测 16/16、tc-pr1/2/3.log（均 exit 0）

## 1. 任务二：rebase reword（3a731fcc → ad1c0cfc）

- 标题"14 处入口"→"16 处入口"，正文不动；filter-branch 链式重写 25 个提交。
- 零漂移三重验证：
  1. 树一致：`git diff a45289ab <new>` = 0 行；
  2. 25 个提交逐个 patch-id 对比全等；
  3. message 逐提交对比仅 ad1c0cfc 标题一行差异。
- `refs/original` 备份 ref 已清理。

## 2. 任务一：overlay 修复（36ac73ba）

### 2.1 方案取舍（A/B 排查后选点击穿透）

- 方案 A（移动位置）排查否决：四个角落均有 spec 依赖的点击入口——
  右上 = `toolbar-export-button`（openExportDialog 入口，数十个导出 spec）+ 录制；
  左上 = 文件/编辑/工具菜单按钮（lut/media-organizer/release/timeline-compare 四 spec 入口）；
  左下 = 轨道头部 M/S/L 与 preflight 生成按钮。移动只是移动受害者。
- 方案 B（碰撞感知）否决：运行时碰撞检测复杂脆弱，且"最小可交互区域"仍会拦截。
- 选定：e2e（VITE_E2E=true）下 overlay 整体 `pointer-events: none`（纯显示 HUD）；
  人工 dev 保留原有交互；生产不渲染本组件。理由：overlay 在 e2e 的价值是"被看见"
  （FPS/渲染计数证据），没有任何 spec 与它交互；一行级改动从根上消除全部拦截、
  不产生新受害者，是实现最简单、副作用最小的做法。

### 2.2 七例已知拦截逐个验证

| 用例 | 历史拦截源 | 修复后 | 归类 |
|---|---|---|---|
| preflight-checklist:55 | overlay 本体 | workers=2 批量通过 | 解决 |
| lut-editor:4 | 匿名 div（overlay 本体签名） | 批量通过 | 解决 |
| media-organizer:4 | 同上 | 批量通过 | 解决 |
| release-workflow:4 | 同上 | 批量通过 | 解决 |
| timeline-compare:4 | 同上 | 批量通过 | 解决 |
| dubbing-adaptation:47 | overlay Reset 按钮（坐实） | 隔离单跑通过 | 解决（批量失败为首波冷载 goto 超时环境伪影） |
| dubbing-adaptation:4 | **audio-mixer 产品面板**（非 overlay） | 隔离单跑通过 | **非同根因，不归因于本修复**，另记 |

### 2.3 环境观察（如实记录）

- 不带 --workers 跑 6 spec 时配置默认 8 workers，8 冷页并发首载全数 goto 30s 超时
  （历史基线均显式 --workers=2/1，从未用该配置）；workers=2 下仅 dubbing 两例首波
  goto 超时、隔离重跑即过 → 负载伪影，与修复无关。

### 2.4 测试

- 新增单测 1（e2e 穿透 / dev 可交互）；DevPerfOverlay + integration + usePerfMonitor 16/16；typecheck 通过。

## 3. 任务四：stash 清理（10845b13 含 gitignore）

- `apps/desktop/e2e-probes-stash/` 整体删除（13 文件 + test-results）。
- 新建 `apps/desktop/.gitignore`：忽略 `e2e-probes-stash/`。
- 引用核查：仅两份审计文档有历史性路径记载（无脚本/配置依赖），已加注删除说明。

## 4. 任务三：三分支拆分

| 分支 | tip | 范围（非 merge） | typecheck |
|---|---|---|---|
| 114-pr1-chore | fe6048cd | 6dd9e9fa、ad1c0cfc(16 处)、a6285b0e→9cca14ce'、2b0f162b→f1a32a19'、11bdca33→7d92b272'、e09342f3→69312367'、635b5872→e33b8089'、f18e1ac9→a57e8641'、fe6048cd→c73cc29d'（9 + 3 merge） | exit 0 |
| 114-pr2-core | c45cb7c0 | e8af4182(63a56ee7')、85fa4ae8、dd717682、f3cb6d54、07ff539b、dcdfda3a、b069b021、02aa78e2、c45cb7c0（9） | exit 0 |
| 114-pr3-fixes | 10845b13 | a6beaed2(cf52b616')、933b2dc2(6a64ca2b')、9afd183f(02ce908a')、6c338512(a45289ab')、36ac73ba(overlay)、10845b13(gitignore)（6） | exit 0 |

- 互不重复、并集 = 完整分支（嵌套 tip 构造，天然满足）。
- gitignore chore 因提交顺序约束落在 PR-3 顶部；开 PR 时如需可 cherry-pick 回 PR-1
  （一行 chore，顺序无关），或随 PR-3 亦无害。

## 5. 与提示词假设的差异（如实）

1. PR-3 范围为 6 个提交而非 5（多 gitignore chore），已按"按实际最终提交序列执行"处理。
2. dubbing-adaptation:4 非 overlay 根因（提示词已预留该可能），未计入"已解决"。
3. 默认 workers=8 的批量 goto 超时为环境负载伪影，非修复回归（隔离复跑即过）。
