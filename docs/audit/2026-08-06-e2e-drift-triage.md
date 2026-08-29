# E2E 存量 Drift 分类调研（151 个失败）

- 日期：2026-08-06
- 性质：**纯分类调研，本轮未修改任何 spec / 产品代码 / 配置文件，未提交、未 push、未重跑 CI**。
- 数据源：本地全量 e2e（workers=2，30 分钟）`396 通过 / 151 失败`，日志 `/tmp/e2e-diag/full-suite.log`（压缩表 `failures-condensed.txt`，每行 `spec||错误||等待定位`）。
- 背景：e2e 自 07-14（最后真正跑通）起停摆三周，失败为期间功能迭代积累的 drift；#114 渲染循环与两处已修 drift（advanced-text / adjustment-layer）不在本文范围。

## 0. 方法

- 从日志提取每个失败的错误签名与等待的 selector/testid，按共同签名聚类。
- 抽查代表对照当前代码与 git 历史定类（rich-text 重命名、ToolsMenu、ExportDialog、app-launch title）。
- 对"media-card 等待"大类做隔离重跑（workers=1 单文件）与全量对比，区分"真失败"与"负载敏感/flaky"。
- 归类为结论级判断；数量为失败条数（含同 spec 多条），四类合计 = 151。

## 1. 四类统计

| 类别 | 数量 | 说明 |
|---|---|---|
| 1 纯 UI/testid 漂移（行为等价，可批量 spec 更新，低风险） | **65** | selector 改名/结构微调，底层行为不变 |
| 2 真实功能回归/产品行为变更（需产品判断改产品 or 改 spec） | **43** | 断言的行为确实变了/入口被移 |
| 3 spec 本身过时/写法脆弱 | **5** | 断言废弃功能、脆性结构/文本选择器、spec bug |
| 4 环境/负载敏感/flaky（隔离可过、全量挂） | **38** | 主要是 10s actionTimeout 在 workers=2 全量负载下超时 |

## 2. 类别 1：纯 testid 漂移（65，低风险、可批量）

共同特征：`toBeVisible/click timeout` 等待的 testid 在当前代码已改名，但功能仍在。

- **Tools 菜单 sync/collab 重命名（15）**：`multi-device-sync`(10) 等 `toolbar-tools-sync-menu-item`，现为 `toolbar-tools-sync-compare-menu-item`（ToolsMenu.tsx:174）；`collaboration`(5) 等 `toolbar-tools-collaboration-menu-item`，现为 `toolbar-tools-collaboration-notes-menu-item`(:178)。**一批菜单重命名，15 条可一次性 spec 更新**。
- **rich-text `clip-text-input` → `rich-text-editor-content`（3）**：`clip-color-preview`、`text-animation`、`title-templates`。与已修 advanced-text 同一重命名（bd315fd6），**一行 diff ×3**。
- **ExportDialog 拆分后配置/队列 testid（14）**：`export-batch-paths`(3)、`export-max-concurrent-select`(2)、`export-history-entry`(2)、`export-pipeline-tab`、`export-preview-button`、`export-preflight-panel`、`export-recovery-report`、`export-upload-status`、`export-sequence-batch-row`、`codec-compare-preset-*`。同源于 bd315fd6 导出向导拆分，**可批量核对 ExportConfig/ExportProgress 现 testid 后更新**。
- **app-launch / i18n 外壳（4）**：title 现为 `open-factory`（index.html:6，spec 期望 `Open Factory` 带空格）；`inspector-panel`、`toolbar-project-name`、`toolbar-file-menu-button` 外壳 testid 变更。低风险。
- **AI/功能面板 testid（27）**：`ai-content-tags`、`ai-quality-assessment`、`assist-editing`、`content-generation(cg-tab-*)`、`auto-generate-panel/beat-sync-checkbox`、`cover-frame-option-*`、`dubbing-analyze-btn`、`frame-inspector-popover/frame-interpolation-*/frame-search-input`、`lut-editor-export-button`、`media-organizer-*`、`preflight-ack-*`、`export-pipeline-create-publish`、`qa-profile-*`、`release-publish-button`、`scene-detect-dialog`、`smart-rough-cut-*/smart-scene-button`、`sr-apply-btn`、`video-restoration-section`。为多个独立面板各自的小重命名，**按面板分批、每批一行级**。
- **preview-canvas（2）**：`preview-canvas` 属性/存在性断言漂移。

## 3. 类别 2：真实行为/产品变更（43，需先问产品）

- **Tools 菜单 team/color-grading 入口被移（7）**：`team-management`(6)、`collaboration:107`(1) 等的 `toolbar-tools-team-management-menu-item`/`toolbar-tools-color-grading-menu-item` 在 ToolsMenu.tsx **已不存在**（非改名）。需问产品：入口移到哪里/是否下线 → 决定改 spec 还是恢复入口。
- **plugin-marketplace 整体重构（11）**：`plugin-market-panel/category/sort/refresh`、`plugin-card-*`、`plugin-install-*`、`installed-plugin-*` 全族失效，且含 `getByRole(/效果.*1/)` 计数断言。属单文件功能重构，**需先核对现市场 UI 再整体重写该 spec**（1/2 边界，偏 2）。
- **导出计划/字幕/数值断言变化（16）**：`ai-tts` 之外的 `toBe/toEqual/toContain/toBeTruthy` 失败，集中在 export plan 参数（`clip-transition` wipeleft、`panorama` v360、`png-sequence` image2、`reframe`、`multicam`、`gif`、`motion-graphics`、`video-stitch`）与字幕导出（`subtitles`×3 ASS/WebVTT sidecar）。多为 ffmpeg-builder/字幕管线演进导致输出变化 → **需工程+产品确认新输出是否正确，正确则更新断言（偏 3），错误则是真 bug**。
- **时间线编辑行为（9）**：`timeline-basic:32` delete 键、`timeline-advanced-tools` ripple/delete（含隔离复现仍失败，确认真回归）、`timeline-multiselect`、`timeline-efficient-editing`、`timeline-clip-/marker-` 计数。删除/ripple 语义疑似变化 → **需产品确认交互**。

## 4. 类别 3：spec 过时/脆弱（5）

- `color-grading-audio`(3)：用 `locator('summary').filter(调色)` 依赖 `<details>/<summary>` 结构，结构已移除 → 换稳定 testid。
- `auto-generate:36`(1)：`selectOption` 传参错误（"expected string, got object"）→ spec bug。
- `startup-update`(1)：断言硬编码文案 `v0.6.1 可用，点击更新` → 版本串变化即挂，脆性文本。

## 5. 类别 4：负载敏感/flaky（38，先确认稳定性）

- **media-card / add-to-timeline 等待（37）**：全量 workers=2 下 `Timeout 10000ms` 等待 `[data-testid^="media-card-"]`；**隔离 workers=1 重跑同批（timeline-basic/app-launch/audio-separation）全部通过**，且 `timeline-basic:43` 全量挂、隔离过 → 判定为 dev-server 在并发全量下变慢导致的超时，非功能 drift。
- `ai-tts` 性能断言(1)：主线程阻塞计时类，负载敏感。
- 处置建议：**不逐个改 spec**，先降并发/提高 dev-server 冷启动与 transform 速度，或对该类等待统一放宽 timeout 后复跑确认；其中混有个别真回归（如 `proxy-auto` 过滤 `four-k-hevc.mov`、`timeline-basic:32`）需剔除到类别 2/3 单独处理。

## 6. 可合并批量处理清单（下一轮排期用）

| 批次 | 条数 | 类别 | 说明 |
|---|---|---|---|
| B1 rich-text testid | 3 | 1 | 同 advanced-text 一行级 |
| B2 Tools 菜单 sync/collab | 15 | 1 | 一次菜单重命名 |
| B3 ExportDialog testid | 14 | 1 | 同源 bd315fd6 |
| B4 AI/面板小重命名 | ~27 | 1 | 按面板分批 |
| B5 media-card 负载 | 37 | 4 | 先调并发/timeout 复跑，剔除真回归 |
| B6 plugin-marketplace | 11 | 2 | 单文件整体重写 |
| 需产品 | 43 | 2 | team/colorgrading 入口、导出/字幕数值、时间线编辑 |

## 7. 明确标注

- **可批量走 spec 更新（低风险）**：类别 1 全部（65），尤其 B1-B4。
- **需先问产品再动**：类别 2（43）。
- **需先确认稳定性**：类别 4（38），用降并发/放宽 timeout 复跑区分真/假。
- 本文数量为结论级归类，个别成员可能在下一轮深挖后跨类移动（已注明边界项）。
