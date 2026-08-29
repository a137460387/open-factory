# media-rating.spec:4 专项诊断 —— 虚拟化媒体网格"挂载期更新丢失"（转交决策）

日期：2026-08-11（PR #132 合并后，main = d4987ad3）
范围锁定：仅 `apps/desktop/e2e/media-rating.spec.ts:4`。未触碰 15 例产品决策类、data-subtitles:32。未改 playwright.config.ts / CI workflow。

## 结论速览

- **不是四类已确认事故模式的任何一种**，也非 mock/fixture 配置或测试工具缺陷。
- 机制：`VirtualMediaCardGrid`（@tanstack/react-virtual 虚拟化网格）在**塌缩媒体面板 + 分支切换挂载**的场景下，挂载期虚拟列表的测量结果所触发的重渲染**派发丢失**，网格停在 0 卡片；虚拟列表内部状态其实正确，任何一次来自父级的重渲染即可恢复。属**重渲染屏障家族的新变体**（虚拟化列表挂载期更新丢失），建议视为第五类机制候选。
- 已排除 StrictMode、React 报错、以及 flushSync/setTimeout 派发/enabled 延迟激活/点击延迟共五条修复路径——均无效。
- **无可靠且不带产品设计判断的根本修复**，按提示词转交决策，给出选项及代价。

## 复现签名

`media-rating.spec.ts:4`：导入 3 素材 → 给第一张打 5 星 → 点击 `smart-album-rating-five` → 断言 `[data-testid^="media-card-"]` 数量 1，实际 **0**（`toHaveCount` 5s 超时，14 次轮询全 0）。
证据：`docs/evidence/2026-08-11-media-rating-4-repro.log`。

## 诊断过程与探针实证（探针用后即删）

探针通过给 `@tanstack/virtual-core`/`react-virtual` 与 `MediaBin.tsx` 打临时日志补丁（均已还原）抓取内部时序：

1. **数据与容器都正常**：五星相册激活时 `sortedVisibleMedia` 有 1 条（徽标"五星精选 (1)"正确），网格滚动容器实测 256×240（`min-h-[240px]`），非 0、非 display:none。
2. **虚拟列表内部全对**：`observeElementRect` 即时测得 `{256,240}` → `calculateRange` 得 `measurements=1, outerSize=240` → `range={startIndex:0,endIndex:0}` → `onChange` 调 `rerender()`。**状态与区间都算对了。**
3. **但重渲染从未发生**：`rerender()` 之后组件再无渲染（组件体内日志无第二次输出）。DOM 停在首帧 `virtualItems=0` 的空网格。
4. **派发彻底失效**：把 `rerender` 改成 `flushSync(rerender)`、`setTimeout(rerender,0)` 都**不触发**重渲染；把虚拟列表 `enabled` 延迟到挂载后激活也无效；把 smart-album 点击 `setTimeout` 延迟一个 tick（让挂载移出离散事件同步 flush）也无效。
5. **恢复只能靠"外部重渲染"**：`window resize`（面板变大 240→337）或点击"仅五星"快捷过滤（触发 MediaBin 父级重渲染）后卡片立即出现。说明虚拟列表状态一直是对的，缺的只是一次能把 `getVirtualItems()` 结果画出来的重渲染。
6. **无 React/页面错误**：console/pageerror 干净（仅字体/WebGL/本地资源等无关告警）；关闭 StrictMode 后行为完全一致（排除 StrictMode 双挂载）。
7. **塌缩布局是触发条件**：祖先链实测——媒体面板 ASIDE 高 346px，内容滚动区（`min-h-0 flex-1 overflow-y-auto`）仅 **87px**（scrollTop=274），网格被 `min-h-[240px]` 撑到 240px 溢出在 87px 可视窗内。初始加载（面板未塌缩、网格 964px）时同一组件渲染正常。

## 机制归类

- 不属于：重渲染屏障（i18n:6 的具体形态）/任务池饿死（cover-frames:4）/程序化设置被异步覆盖（auto-generate:68）/拆分丢失 UI 接线（export.spec:3/:81）。
- 归纳为：**虚拟化列表挂载期更新丢失**——虚拟列表在挂载的 layout effect 内同步完成测量并派发重渲染，但该派发未被提交；组件自身后续任何 dispatch 均不生效，只有父级级联重渲染能刷新。与"重渲染屏障"同族但触发条件、载体（tanstack virtual + 塌缩布局 + 分支切换挂载）均不同，建议记为**第五类机制候选**。
- 精确定位到 React 调度层面"派发为何被丢弃"尚未完全收敛（已排除 StrictMode、错误边界、同步/延迟派发方式），故不做臆断。

## 已尝试且失败的修复路径（均在还原后验证无效）

| 路径 | 做法 | 结果 |
|---|---|---|
| flushSync | `onChange` 内改 `flushSync(rerender)` | 无效，仍 0 卡片 |
| 延迟派发 | `setTimeout(rerender,0)` | 无效 |
| 延迟激活 | 虚拟列表 `enabled` 挂载后才置 true | 无效 |
| 延迟点击 | smart-album `onSelect` 延迟一个 tick | 无效 |
| （未采纳）forceUpdate/超时堆砌/重试 | 提示词明令禁止 | 不尝试 |

## 为何不强行修：候选方案都混入产品/架构判断

- **A 反虚拟化智能相册视图**：智能相册分支改用非虚拟 `map` 渲染。代价：智能相册条目多时失去虚拟化收益；且"回到全部"后默认视图同样坏（见下），只改智能相册分支**不是完整修复**。
- **B 保证挂载后一次父级重渲染**：让 MediaBin 在分支切换后补一次重渲染。代价：接近提示词禁止的"强制重渲染"掩盖式修复，治标不治本。
- **C initialRect 预置尺寸**：给虚拟列表预置初始 rect 让首帧即出卡。代价：预估偏小会少渲染留白、偏大等同关闭虚拟化，均不可靠。
- **D 库级处理**：升级/更换 @tanstack/react-virtual（现 ^3.14.5）。代价：依赖变更需论证必要性，且未确认上游已修此类问题，结果不确定。
- **E 重构分支渲染**：把 VirtualMediaCardGrid 移出三元分支、常驻挂载只换 `media` prop，避免分支切换挂载。代价：牵动 MediaFolderTree/RootMediaDropZone/两种 media 过滤的结构性重构，回归面大。

关键观察（支持"非局部分支问题"）：一旦触发，**切回"全部素材"默认分支也仍 0 卡片**——坏的虚拟列表状态随组件复用持续，直到一次真正的外部重渲染。说明问题在 `VirtualMediaCardGrid`/虚拟列表层，而非智能相册分支本身。

## 处置

- 本轮**不产生修复 commit**，转交决策（选项 A–E 及代价如上）。
- media-rating:4 维持红，归入"待决策"而非"待专项诊断"（诊断已闭环）。
- 全部临时补丁/探针已还原删除，tracked 工作区干净，node_modules 无残留改动。
