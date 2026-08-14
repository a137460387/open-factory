# workers=1 / workers=2 通过数倒挂诊断

- 日期：2026-08-07
- 分支：`fix/114-dev-perf-overlay-render-loop`（本轮另含任务二 commit `d603f049`，见文末）
- 性质：任务一为**只读诊断**；未改 playwright.config.ts / CI；未处理移除类簇。

## 0. 数据

| 运行 | 并发 | 通过 | 失败 | 时长 | commit |
|---|---|---|---|---|---|
| 上一轮 | workers=2 | 398 | 149 | ~30m | task-1 前 |
| 本轮复跑 | **workers=2** | **397** | **150** | 37.6m | task-2 后 |
| 本轮 | workers=1 | 381 | 166 | 52.8m | task-1 后 |

- **workers=2 可复现**：两次 398/149 ≈ 397/150（差 1 个），数字本身稳定。
- **workers=1 更差**：166 失败，比 workers=2 多约 16 个。

## 1. 差集清单（本轮同期对比，w1 vs w2，commit 几乎一致）

- 只在 **workers=1** 失败、workers=2 通过：**30 个**
- 只在 **workers=2** 失败、workers=1 通过：**14 个**
- 两者都失败：**136 个**（确定性失败 = 真实 drift/回归）
- 净差 30 − 14 = 16，正好等于 166 − 150。

**只在 workers=1 失败的 30 个**：adjustment-layer:4、ai-chat-editor:4/47、ai-rough-cut:3/28、ai-video-summary:4、audio-channel-routing:4、audio-envelope:4、batch-watermark:4、clip-effects-export:236、collaboration-notes:4、contextual-translation:4、current-frame-export:4、director-mode:4、edit-history-panel:4、export-retry-strategy:4、gif-export:22、lut-library:4、media-job-monitor:4、progressive-export:4、project-documentation:3、storyboard:4/22、style-transfer:4、subtitle-style-quickbar:4、subtitle-translation:4、thumbnail-generator:4、timeline-scripting:4、timeline-zoom:4、undo-tree:4。

**只在 workers=2 失败的 14 个**：ai-semantic-search:4、color-node-editor:4、data-subtitles:32、media-library-views:4、media-versions:4、nested-sequence-export:14、performance:4、playback-controls:17、preview:4、professional-color-grading:101、share-package:4、spatial-audio-export:4、sync-compare:4、track-controls:4。

> 关键：**flaky 是双向的**——workers=2 也有 14 个独占失败。不是"workers=1 单向破坏"，而是存在一个约 **44 个（30+14）时序敏感测试池**，其通过与否随运行条件翻转。

## 2. 隔离复测结果（workers=1 单独跑单个 spec）

| spec | 单独跑结果 | 结论 |
|---|---|---|
| adjustment-layer.spec.ts | 单独跑 2/2 **通过** | flaky；分组/全量跑挂，失败为 `media-card add-to-timeline` 10s 超时 |
| timeline-zoom.spec.ts | 单独跑 **失败** | 失败同为 `media-card add-to-timeline` 10s 超时（media 导入慢时单跑也会挂） |
| auto-generate.spec.ts | 单跑 :17/:36/:68 失败 | media/面板时序敏感；注意全量挂的是 :49，**失败的具体用例会漂移** |
| smart-distribution.spec.ts | 单跑 :58/:74/:89 失败 | 同上 |

把"只在 w1 失败"的 29 个 spec 文件合在一起单独跑（不带其余 ~500 个）：53 过 / 13 败，且**失败的用例和全量跑时不是同一批**（auto-generate 全量挂 :49、单跑挂 :17/:36/:68；clip-effects-export 全量挂 :236、单跑挂 :48/:174；gif-export 全量挂 :22、单跑挂 :4）。→ **失败集合在不同运行之间漂移**，是 flaky 的直接证据。

## 3. 跨 spec 状态污染排查（任务一步骤3）

- `apps/desktop/playwright.config.ts`：**无 globalSetup、无 storageState**。
- `e2e/fixtures.ts`：仅注入 page-object，无共享存储/上下文。
- 全部 spec 与配置中**无 beforeAll、无 storageState**（grep 验证）。
- 每个测试独立 browser context → 独立 localStorage。

**结论：不存在传统的跨 spec 存储/状态污染。** 失败不是"A spec 遗留状态被 B spec 踩到"。

## 4. 根因判定

**主因：media 导入 / 虚拟化媒体网格渲染的时序 flaky。**
- 绝大多数浮动失败（含 adjustment-layer、timeline-zoom 等）的报错都是同一个：`locator.click: Timeout 10000ms — waiting for [data-testid^="media-card-"] … add-to-timeline-`。
- 媒体网格是虚拟化渲染（`VirtualMediaCardGrid`，需先完成容器尺寸测量才渲染卡片），导入还含 probe/proxy 异步步骤（install-mocks.ts:891/1194/1210）。media-card 要在 **10s actionTimeout** 内出现，依赖"导入处理 + 布局测量 + 渲染"及时完成。
- 该链路对系统负载/执行时序敏感：条件不利时超时，条件有利时通过 → 通过与否随运行翻转。

**为什么 workers=1 失败更多**：workers=1 顺序执行、整场墙钟更长（52.8m vs 37.6m），单 worker/单 dev-server 承担全部 547 个测试，时序敏感的 media 导入在更长、更连续的负载下更容易超时；workers=2 交错分摊，落在超时外的更少。失败序号在 workers=1 中四分位分布较均匀（25/48/44/49），**并非集中在尾部**，故"长程退化到末尾才挂"不成立，更像是全程持续的时序压力差异。

**诚实的边界**：我只有**一次** workers=1 全量样本（166），而 workers=2 有两次（149、150）。workers=1 是否"系统性"更差，严格说还需第二次 workers=1 复跑确认。当前证据支持"workers=1 倾向产生更多 media 导入超时"，但 16 个的差距落在 ~44 个 flaky 池的翻转范围内，不能排除其中一部分是纯随机波动。

## 5. 若要彻底定位，还需要的信息
1. **第二次 workers=1 全量**，确认 166 是否可复现（区分系统性 vs 随机）。
2. **media 导入计时插桩**：统计 media-card 从点击 import 到出现的耗时分布（不同并发/不同运行位置），确认是否逼近 10s。
3. dev-server 长程内存/响应监测（判断单 dev-server 连续服务 500+ 测试是否变慢）。

## 6. 结论与建议（不替你决策）
- 通过数倒挂**不是**跨 spec 状态污染，也**不是** workers=1 单向破坏，而是 **media 导入/网格渲染时序 flaky** 在不同并发下翻转的净效果。
- 在做任何"簇基线对比"前，应先处理这个 flaky 源（簇 B）：给 media-card 等待更稳健的策略（提高该等待的超时、或改为等待更确定的就绪信号、或对 media 导入做确定性 mock 加速），否则任何簇的通过率对比都会被这 ~44 个浮动用例污染。
- 136 个"两者都失败"才是确定性 drift/回归（即此前各簇的真实问题），应作为后续修复基线。

## 附：任务二（本轮已完成，独立 commit）
- `d603f049` test(desktop): 导出对话框步骤导航按钮新增 `data-testid`（`export-step-config/preview/export/complete`）。**仅加属性，无行为变更**；已用探针验证 4 个 testid 渲染、点击 `export-step-export` 可达队列；typecheck 通过。导航类 spec 编写按约定留到下一轮。
