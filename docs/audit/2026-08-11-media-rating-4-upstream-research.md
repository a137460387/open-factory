# media-rating:4 上游调研 —— @tanstack/react-virtual 已知 issue 比对（选项 D）

日期：2026-08-11（纯调研轮，零代码/依赖改动）
背景：media-rating:4 底层机制已确诊——`VirtualMediaCardGrid` 在**离散同步事件（点击）内挂载**时，虚拟列表内部测量正确（`range={0,0}`）、`onChange` 以 `sync=false` 派发了一次**普通 `rerender()`**（useReducer 空 bump），但该派发从未提交，组件自身后续所有 dispatch（含 setTimeout 延迟派发）也失效；仅外部级联重渲染（window resize / 快捷过滤点击）能救回。

## 一、精确版本核实（package.json + bun.lock + npm registry 三方一致）

| 包 | 声明 | lockfile 实际解析 | 说明 |
|---|---|---|---|
| `@tanstack/react-virtual` | `^3.14.5` | **3.14.5**（2026-06-30 发布） | wrapper |
| `@tanstack/virtual-core` | （传递依赖） | **3.17.3**（2026-06-30 发布） | **官方配对，非解析错误**：npm registry 上 react-virtual@3.14.5 即声明 `virtual-core: 3.17.3`。TanStack Virtual 的 wrapper(3.14.x) 与 core(3.17.x) 本就不同版本号，core 因 #1168 mount/measure-storm 重写升上 3.17.x |
| `react` / `react-dom` | `^19.1.0` | **19.2.7** | React 19 |

当前最新：react-virtual **3.14.9** + virtual-core **3.17.7**（2026-07-28 发布）。落后 4 个补丁版本。

## 二、调研结果：未找到精确匹配的已知 issue（不牵强附会）

### 2.1 最相关簇：flushSync-in-lifecycle（#628 / #711 / #1094 / #1098 / #1100）——**同调用路径、同症状家族，但不同代码路径**

- #628、#711（closed）：`flushSync was called from inside a lifecycle method` 最早报告。
- #1094（closed 2026-03-10）：React 19 下官方 infinite-scroll 示例即可复现该警告。
- **#1098**（closed 2025-12-31，`deferFlushSync` 选项）PR 描述直接点名成因："`flushSync(rerender)` is called inside the `onChange` callback, which can be triggered during `useLayoutEffect` via `instance._willUpdate()`"——与本项目 `VirtualMediaCardGrid` 的调用链逐字同构。
- **#1100**（closed 2026-01-02，`useFlushSync` 选项）：我们版本 3.14.5 **已包含** `useFlushSync`（源码确认）；`deferFlushSync` 从未进入任何 release notes（0 命中），我们版本亦无。

**匹配度判定：部分/家族级，非精确。** 关键分歧：
| 维度 | 上游簇 | 本项目 |
|---|---|---|
| 触发路径 | 滚动中 `sync=true` → `flushSync(rerender)` | 挂载期 `sync=false`（`isScrolling=false`）→ **普通 `rerender()`** |
| React 行为 | 明确警告"cannot flush when already rendering"，flushSync 被拒 | **无任何警告/错误**（console/pageerror 干净） |
| 官方修复覆盖 | `deferFlushSync`/`useFlushSync` 只作用于 flushSync 分支 | 我们的分支（普通派发）**不被任何已发布选项覆盖** |
| 延迟派发 | `deferFlushSync` = queueMicrotask 延迟 | 上一轮已实测 `setTimeout(rerender,0)` 等价手段——**无效** |

最后一行是关键反证：上游修复思路（延迟到微任务）我们已等价验证过，救不回。说明本项目机制与该簇**不同源**。

### 2.2 其他候选逐一排除

| Issue | 状态 | 机制 | 与本项目差异 |
|---|---|---|---|
| #871 / #955 / #957 | closed（2025-03） | `maybeNotify` memo 依赖缺 scrollRect → **notify 不被调用** | 本项目 **notify 已调用**（onChange 日志确凿），失败点在更下游的 dispatch 提交；且该修复早已在 3.17.3 内 |
| #1241 `useVirtualizerSnapshot`（useSyncExternalStore） | **open，未发布** | 重构"contentless reducer bump"重渲染机制 | 上游**承认现行 rerender 机制脆弱**的最直接证据，但动机是 React Compiler 兼容，且无发布版本 |
| #743 | closed | React 19 + **React Compiler** 将 `getVirtualItems()` 提升/记忆化致恒返 0 | 本项目**未启用 React Compiler**；且我们是"有 items 但不重渲染"，非"返回 0" |
| #1077 | open | JSX 内联 `getTotalSize()` 引用恒不变致高度 stale | 不同机制（我们 range/items 已算对） |
| #1076 | open | onChange 引发 **Maximum update depth**（无限循环） | 症状相反（我们是更新丢失，非更新风暴） |
| #363 | closed（2022） | count 0→N 不触发更新（3.0 beta 时代） | 年代与场景均不同 |

### 2.3 升级能否修复：源码级验证——**不能改变我们的路径**

- react-virtual **3.14.5 vs 3.14.9 的 onChange/rerender 区块逐字一致**（下载 3.14.9 tarball diff 确认，仅行号偏移）；3.14.6–3.14.9 changelog 仅依赖升级 + `directDomUpdates` 模式修复（#1237，我们未使用该模式）。
- virtual-core 3.17.4→3.17.7 四个补丁全部关于：多 lane 性能、gap 失效、iOS 手势/延迟滚动、end-anchor 补偿、resizeItem 同步通知（#1239）——**无一触碰挂载期 observeElementRect → maybeNotify → notify 路径**。
- 结论：升级到 3.14.9/3.17.7 **不会改变**本项目出问题的代码路径，预期无法修复。

## 三、升级风险评估（仅评估，未执行）

- **兼容性**：react-virtual peer deps `react ^16.8||^17||^18||^19` —— 与 React 19.2.7 兼容；项目内仅 2 处 `useVirtualizer` 用法（MediaBin.tsx、RecommendationList.tsx），升级影响面小。
- **风险**：低（补丁版本跨度小、无 breaking change 记录）。
- **收益预期**：**低**——见 §2.3，修复不经过我们路径。不值得为"修 media-rating:4"而升级；若升级应出于其他理由单独立项。

## 四、结论

1. **没有找到与本项目机制精确匹配的已知上游 issue**，也没有任何已发布版本修复该路径。不为得出"是已知问题"而牵强附会：最接近的 flushSync-in-lifecycle 簇在触发路径（sync=true/flushSync vs 我们的 sync=false/普通派发）、有无 React 警告、官方修复覆盖面三点上均对不上，且其修复思路（延迟派发）已被上一轮等价实验证伪。
2. 上游**侧面承认**现行"contentless reducer bump"重渲染机制脆弱（#1241 拟改 useSyncExternalStore），但该重构未发布、动机也非本场景。
3. 该机制大概率是 **React 19 调度 × 虚拟列表挂载时机 × 本项目分支切换渲染结构** 的三方交互，纯库侧无现成答案。

## 五、下一步建议（不执行，待指示）

1. **不建议**为修此 bug 升级 react-virtual/virtual-core（源码级验证升级不改路径）。
2. 转向**应用侧方案**（对应上一轮选项 E 谱系）：让 `VirtualMediaCardGrid` 不在分支切换的同步提交内"首次挂载即测量"，或改为常驻挂载只换 `media` prop——下一轮设计时评估。
3. 持续跟踪上游 **#1241**（useSyncExternalStore 重构）发布动态；若发布，重新评估是否天然覆盖本场景。
4. media-rating:4 维持红、维持"待决策"分类不变。
