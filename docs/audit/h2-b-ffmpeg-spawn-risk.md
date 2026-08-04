# H2 方案 B 收尾 — FFmpeg spawn 点风险分级待办

> 生成时间：2026-08-03，v4.73.0 审计修复系列收尾文档。
> 取代 `.pending-patches/H2-B-deferred-spawn-points.md`（该笔记已被 .gitignore 忽略且数字有误）。

## 1. 背景

### H2 方案 B 的范围

H2 审计项的目标是防止 FFmpeg 子进程失控撑满系统资源。方案分两层：

- **方案 A（TS 侧限流）**：两个共享信号量池 `backgroundMediaPool`（上限 4）和 `uiFeedbackPool`（固定 3），位于 `apps/desktop/src/media/media-concurrency.ts`。
- **方案 B（Rust 侧兜底）**：全局信号量 `ffmpeg_semaphore.rs`，阈值 6，用 `try_acquire_owned()` 非阻塞获取，拿不到 permit 立即返回明确错误。作为 TS 侧限流的最后一道防线——如果某个新增入口忘记接池而失控，Rust 侧会拒绝 spawn。

方案 B 原始范围只覆盖了 `proxy.rs` + `media.rs` 的 spawn 点（对应 TS 侧双池管理的调用链）。调研过程中发现全仓库的 ffmpeg/ffprobe spawn 点远不止这两个文件，当时明确决定本次不处理其余文件，只做记录。

### 本次调研起因

H2 方案 B 全部批次完成后，需要把调研时发现的未覆盖 spawn 点从本地未提交的 `.pending-patches/` 笔记转化为一份正式的、可排期的待办文档。在转化过程中，对原始笔记的数字和防护描述做了精确复核，发现原始笔记存在数字错误和防护机制描述不准确的问题，一并纠正。

---

## 2. 精确的 spawn 点总数统计

### 统计方法

对 `apps/desktop/src-tauri/src/` 全目录搜索所有 `Command::new()` 调用，逐一甄别是否为 ffmpeg/ffprobe spawn（排除 nvidia-smi、wmic、python、用户自定义 post-export script、测试 helper 等）。统计口径为**源码中 `Command::new` 调用包含 ffmpeg_binary()/ffprobe_binary() 或等价字符串的位置数**。

### 全仓库精确统计

| 文件 | spawn 数 | 行号 | H2-B 状态 |
|------|---------|------|-----------|
| `commands/proxy.rs` | 1 | 58 | ✅ 已覆盖 |
| `commands/media.rs` | 12 | 304,426,459,668,688,704,1080,1191,1258,1585,1668,2222 | ✅ 已覆盖 |
| `commands/ffmpeg.rs` | 12 | 484,650,1955,2072,2111,2186,2387,2423,3059,3108,3193,3987 | ❌ 未覆盖 |
| `commands/render_preview_cache.rs` | 1 | 99 | ❌ 未覆盖 |
| `commands/hw_decode.rs` | 3 | 261,272,363 | ❌ 未覆盖 |
| `commands/transcode.rs` | 2 | 186,507 | ❌ 未覆盖 |
| `commands/scene.rs` | 2 | 72,435 | ❌ 未覆盖 |
| `commands/noise_reduction.rs` | 2 | 149,202 | ❌ 未覆盖 |
| `commands/ai.rs` | 1 | 385 | ❌ 未覆盖 |
| `commands/gif.rs` | 1 | 124 | ❌ 未覆盖 |
| `commands/privacy.rs` | 1 | 58 | ❌ 未覆盖 |
| `commands/recording.rs` | 1 | 95 | ❌ 未覆盖 |
| `commands/whisper.rs` | 1 | 129 | ❌ 未覆盖 |
| `lib.rs` | 1 | 279 | ❌ 未覆盖 |
| **总计** | **41** | **14 个文件** | |

### 已覆盖 / 未覆盖汇总

| 指标 | 数量 | 说明 |
|------|------|------|
| 全仓库总计 | **41** | 14 个文件 |
| H2-B 已覆盖 | **13** | proxy.rs(1) + media.rs(12)，其中 media.rs 的 12 处 = 9 处直接 acquire + 3 处由调用者覆盖（analyze_loudness_path / generate_spectrogram_png / analyze_ebur128_stats） |
| 未覆盖 | **28** | 分布在 12 个文件里 |

### 与原始笔记的数字对比

原始笔记（`.pending-patches/H2-B-deferred-spawn-points.md`）的三个核心数字全部有误：

| | 笔记写的 | 精确复核 | 差异原因 |
|---|---------|---------|---------|
| 全仓库总计 | 39 | **41** | 笔记遗漏了 `render_preview_cache.rs`(+1)；且对 media.rs 的 12 处理解有误(-1)，两错误部分抵消 |
| 已覆盖 | 10 | **13** | media.rs 实际 12 处全部被 H2-B 处理（9 直接 acquire + 3 由调用者覆盖），不是只有 9 处；加 proxy.rs 1 处 = 13 |
| 未覆盖 | 29 | **28** | 笔记遗漏 render_preview_cache.rs(+1)，但少算了 media.rs 的 3 处"不 acquire 由调用者覆盖"(-4)，净差 -1 |

---

## 3. 关键发现

### 发现 1：原始笔记对 ffmpeg.rs 的防护描述有误

**原始笔记描述**：
> `commands/ffmpeg.rs | 12 | C1 的 export_children HashMap + Mutex | 管"哪些 export task 在跑"，不是"同时 spawn 多少 ffmpeg"`

**实际核实结论**：`EXPORT_CHILDREN`（`ffmpeg.rs:16`，`static EXPORT_CHILDREN: OnceLock<Mutex<HashMap<String, Child>>>`）纯粹是**按 task_id 取消的注册表**，完全没有任何并发数量限制功能。全部读写点（`ffmpeg.rs:42/694/1928/1971/2006/2015`）都是按 key 插入/删除/kill 语义，没有任何一处对 `children.len()` 做上限检查。HashMap 无容量上限，插入前无 if-guard。

同模式的 `MOTION_TRACKING_CHILDREN`（`ffmpeg.rs:17`）和 `QUALITY_EVALUATION_CHILDREN`（`ffmpeg.rs:18`）同理，都是取消注册表。

ffmpeg.rs 的真实并发防护来自 **TS 侧 export queue 的 `maxConcurrent=2`**（可调 1-4，`apps/desktop/src/export/export-queue-store.ts:77`），不是 Rust 侧。原始笔记的描述容易误导成"有限流机制"，实际上这个机制管的是取消不是限流。

### 发现 2：ffmpeg.rs 存在绕过 TS 队列的裸并发缺口

`runExportPreviewSamples` 完全绕过 export queue 和任何池：

- Rust 侧 `run_export_preview_samples_parallel`（`ffmpeg.rs:933-953`）对每个 sample **各起一个 OS 线程** `std::thread::spawn`，每个线程独立 spawn 一个 ffmpeg
- 样本数固定 3 个（`validate_export_preview_sample_count` 强制，`ffmpeg.rs:929-1034`），所以一次调用最多 3 个 ffmpeg 并发
- TS 侧也无池（直接 invoke `run_export_preview_samples`）
- 另外有 4 处直接 `await runExport()` 绕过队列：`media/BatchWatermarkDialog.tsx:115`、`projectBatch/BatchProjectProcessingDialog.tsx:373,387`、`thumbnail/ThumbnailGeneratorDialog.tsx:598`、`lib/exportVideo.ts:52`

**这是和 H2 最初想解决的同一类风险**——Rust 侧主动发起多线程并发 spawn 且无任何限流。

### 发现 3：原始笔记遗漏了 render_preview_cache.rs

`commands/render_preview_cache.rs` 的 `render_preview_cache` command（line 99 `Command::new(&ffmpeg)`，变量来自 line 68 `super::binaries::ffmpeg_binary()`）是一处真实的 ffmpeg spawn，原始笔记完全没有记录这个文件。这导致全仓库总数从笔记的 39 修正为 41，未覆盖从 29 修正为 28。

### 发现 4：hw_decode.rs 默认编译进去

原始笔记把 `hw_decode.rs` 列在"完全没有防护的文件"里。实际核实：

- `Cargo.toml` 里 `default = ["hw-decode"]`，所以 `#![cfg(feature = "hw-decode")]` 门控的代码在普通 `cargo build` 时**总会被编译进去**
- 但它内部有 `DECODER_MANAGER` 全局 `Mutex`（`hw_decode.rs:136`）串行化所有解码请求——同一时间只有 1 个 ffmpeg 在跑。这个防护原始笔记没记录
- 每次 `decode_frame` 都 spawn 一个完整的 ffmpeg 进程来解码单帧，开销很大但不会并发

---

## 4. 风险分级

### 分级标准

| 等级 | 判据 |
|------|------|
| **高** | 无任何并发防护 + 可能被批量/并发/高频自动触发 |
| **中** | 主路径有防护但存在绕过缺口，或无防护但触发频率中低 |
| **低** | 有充分防护（Rust 串行/Mutex/UI 强制单发/手动触发），单次操作最多 1 个 ffmpeg |
| **极低** | 一次性执行 |

### 分级结果

| 文件 | spawn | 现有真实防护 | 并发触发可能性 | 风险 | 核心理由 |
|------|-------|------------|--------------|------|---------|
| **ffmpeg.rs** | 12 | TS export queue `maxConcurrent=2`（主路径）；EXPORT_CHILDREN 仅管取消；**runExportPreviewSamples 3 线程裸并发缺口** | 主路径：用户显式导出；绕过路径：preview samples + 4 处直接 runExport | **中** | 主路径有 TS 队列，但绕过路径无 Rust 侧兜底；export_children 不是限流器 |
| **ai.rs** | 1 | for 循环串行抽帧 | 3 个面板入口（AIVideoSummary/AIColorGrading/MediaAIAnalysis）可能并发调用 | **中低** | 单次调用内部串行，但多面板并发入口无任何拦截 |
| **hw_decode.rs** | 3 | DECODER_MANAGER 全局 Mutex 串行化 | seek/预览可能高频，但 Mutex 保证不并发 | **低** | Mutex 保证同一时间只有 1 个 ffmpeg；但每次 spawn 完整进程开销大 |
| **transcode.rs** | 2 | Rust `for` 循环串行处理 batch | 用户手动触发转码对话框 | **低** | 单次 batch 内部串行 |
| **scene.rs** | 2 | 无 | 用户手动触发（场景/glitch 检测） | **低** | 单发，每次 1 个 ffmpeg |
| **noise_reduction.rs** | 2 | decode→encode 串行执行 | 用户手动触发音频降噪 | **低** | 单次操作最多 1 个 ffmpeg 在跑 |
| **render_preview_cache.rs** | 1 | 无；`.status()` 同步等待 | 用户操作触发预览渲染缓存 | **低** | 单发，每次 1 个 ffmpeg |
| **gif.rs** | 1 | 无 | 用户手动触发 GIF 导出 | **低** | 单发 |
| **privacy.rs** | 1 | 无 | 用户手动触发隐私检测 | **低** | 单发 |
| **recording.rs** | 1 | **UI 强制单路**（`startEditorRecording` early-return + RecordMenu 互斥） | 不支持多路 | **低** | UI 层已挡死 |
| **whisper.rs** | 1 | 无 | 用户手动触发语音识别 | **低** | 单发（仅 1 处 ffmpeg 抽音频） |
| **lib.rs** | 1 | 无 | 启动时只跑一次 | **极低** | 一次性 |

### 总结

- **无高风险文件**：没有"无防护 + 可能被批量自动触发"的组合
- **1 个中风险**：ffmpeg.rs，主因是 runExportPreviewSamples 的裸并发缺口和 4 处绕过队列的 runExport
- **1 个中低风险**：ai.rs，多面板并发入口
- **其余 10 个文件均为低/极低**：各有串行/Mutex/UI 单发/手动触发等防护

---

## 5. 建议的后续优先级

### P1：ffmpeg.rs — runExportPreviewSamples 裸并发缺口

**问题**：`run_export_preview_samples_parallel`（`ffmpeg.rs:933-953`）对 3 个 sample 各起一个 OS 线程并发 spawn ffmpeg，完全绕过 TS export queue 和任何限流池。这是目前全仓库唯一一个 Rust 侧主动发起多线程并发 spawn 且无任何限流的路径。

**建议**：在 `run_export_preview_sample_blocking` 或 `run_materialized_export_plan` 入口处接入 `try_acquire_ffmpeg_permit()`，使 3 个并发线程各自 acquire 一个 permit。由于信号量阈值 6 ≥ 3，正常情况下不会拒绝；但如果同时有其他 export task 在跑（maxConcurrent=2 的队列导出），会起到兜底限制作用。

### P2：ai.rs — extractAiFrames 多面板入口

**问题**：`extract_ai_frames_blocking`（`ai.rs:377-414`）对 `request.times` 做 for 循环串行抽帧，每次 spawn 1 个 ffmpeg。单次调用内部不会并发，但有 3 个 UI 入口可能同时调用：`AIVideoSummaryPanel`、`AIColorGradingPanel`、`MediaAIAnalysisDialog`。如果用户同时操作多个面板，会并发触发多个 extractAiFrames。

**建议**：TS 侧给 3 个面板入口加 `backgroundMediaPool.run()` 限流，或 Rust 侧在 `extract_ai_frames` command 入口 acquire permit。

### P3 及以下：其余低风险文件

以下文件各有充分防护（串行/Mutex/UI 单发/手动触发），不紧急，可按需排期：

- **hw_decode.rs**（3 处）：已有 Mutex 串行化，实际不会并发。但每次 spawn 完整进程开销大，长期可考虑进程池复用（非信号量问题）
- **transcode.rs**（2 处）：Rust for 循环串行 + 用户手动触发
- **scene.rs**（2 处）：单发手动触发
- **noise_reduction.rs**（2 处）：decode→encode 串行
- **render_preview_cache.rs**（1 处）：单发，`.status()` 同步等待
- **gif.rs**（1 处）：单发手动触发
- **privacy.rs**（1 处）：单发手动触发
- **recording.rs**（1 处）：UI 强制单路
- **whisper.rs**（1 处）：单发手动触发
- **lib.rs**（1 处）：启动一次性检查，可不动

---

## 附：proxy.rs spawn 写法说明

`proxy.rs:58` 的 spawn 使用 `Command::new(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" })` 直接硬编码字符串，不走 `binaries::ffmpeg_binary()` 函数。这是已有代码，H2-B 已在此处接入信号量。其他文件统一通过 `binaries::ffmpeg_binary()` / `binaries::ffprobe_binary()` 获取可执行文件路径。
