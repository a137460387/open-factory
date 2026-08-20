# 批量波形预生成 + codec 感知音频解码回退——调研与设计方案

日期：2026-08-19
状态：调研 + 设计方案（本轮不产生生产代码改动）
关联：roadmap「Next (v4.26+)」未勾选项「Batch waveform pre-generation controls and more codec-aware audio decoding fallbacks」

---

## 1. 现状调研

### 1.1 波形生成链路（apps/desktop/src/media/waveform.ts，179 行）

`getWaveform` → 缓存命中即返回，否则 `runUiFeedbackTask`（UI 池 limit 3）→ `getWaveformUnthrottled`，按**文件大小**分三层：

| 路径 | 触发条件 | 实现 | 准确性 |
|------|---------|------|--------|
| 原生 FFmpeg | >50MB（NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES） | Rust `analyze_waveform`（FFmpeg `-vn -ac 1 -ar 8k -f f32le` 流式解码，media.rs:1071） | **准确**（全 codec） |
| WebAudio | ≤50MB（默认） | `AudioContext.decodeAudioData` | 准确（浏览器支持 codec） |
| worker 字节峰值 | WebAudio 失败 且 ≥50MB | `extractWithWorker`（waveform.worker.ts，`bytes[i]-128`） | **不准确**（把压缩字节当 PCM） |
| 原始字节峰值 | WebAudio 失败 且 <50MB | `extractPeaks`（`bytes[i]-128`） | **不准确** |

### 1.2 关键发现

1. **回退链是「大小驱动」，不是「codec 驱动」**：WebAudio `decodeAudioData` 失败（浏览器不支持某 codec，如 FLAC/ALAC/Opus/DTS）后，回退到「字节峰值」——对压缩音频是**假波形**。
2. **准确的 FFmpeg 解码只在 >50MB 才走**：<50MB 的浏览器不支持 codec 文件会静默得到假波形，无提示。
3. **MediaAsset 已有 `audioCodec?: string` 元数据**（editor-core model-types.ts:108），但波形生成**未用它做任何决策**。
4. **批量预生成不存在**：grep「batchWaveform / pre-generate / 预生成」0 处。当前波形是「按需」+「导入时自动 enqueue」。
5. **导入自动 enqueue**：`buildJobsForAsset`（media-job-store.ts）对所有 audio / hasAudio 的 video 无条件 `createJob(asset, 'waveform')`——有自动批量生成，但**无显式控制**（无开关、无手动触发、无独立进度入口）。

---

## 2. 缺口分析（对应 roadmap 目标）

| roadmap 目标 | 现状缺口 |
|---|---|
| codec-aware audio decoding fallbacks | 回退链大小驱动、非 codec 驱动；<50MB 的浏览器不支持 codec 得到假波形；audioCodec 元数据闲置 |
| batch waveform pre-generation controls | 无显式批量触发、无自动生成开关、无独立进度 UI |

---

## 3. 设计方案

### 3.1 codec 感知解码回退

**目标**：WebAudio 失败后回退到**准确的 FFmpeg 解码**，而非不准确的字节峰值。

**方案（推荐 C：预判 + 失败回退）**：
1. **预判**：`audioCodec` 命中「浏览器不支持白名单」（flac/alac/opus/vorbis/dts/ac3/mp2 等）→ 直接走 `analyzeWaveform`（FFmpeg），跳过 WebAudio。
2. **失败回退**：WebAudio `decodeAudioData` 抛错 → 回退到 `analyzeWaveform`（FFmpeg），而非 worker 字节峰值。
3. **最终兜底**：FFmpeg 也失败（ffmpeg 不可用 / 文件损坏）→ 才降级到 worker 字节峰值 + toast 提示「波形为近似值」。

改动点：
- `waveform.ts` 的 `getWaveformUnthrottled` 重排回退链。
- 复用现有 `analyzeWaveform`（tauri-bridge）——Rust 命令已存在、无大小限制，无需新增 Rust。
- 阈值 `NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES` 语义从「大文件分流」变为「仅作预判参考」，codec 命中时不再受 50MB 门槛约束。

### 3.2 批量波形预生成控制

**目标**：用户能显式触发批量预生成、控制是否自动生成、看到批量进度。

1. **设置项**（并入现有 `mediaJobSettingsStore` 或 `proxySettingsStore`）：
   - `autoGenerateWaveform: boolean`（导入时自动生成波形，默认 true）——关闭后 `buildJobsForAsset` 不再自动 enqueue waveform。
2. **批量触发**：
   - MediaBin 增加「生成波形」操作（选中素材 / 全部素材）→ 复用 `enqueueProxyJobsForMedia` 类似的 enqueue 逻辑，为缺失波形的素材批量 enqueue waveform job。
   - 走现有 media-job 队列：TaskMonitorSettingsPanel 可见进度、可取消、优先级（已由 PR #152 提供）。
3. **缺失检测**：`readWaveformFromCache` 判空（或 `waveformStatus` 标记），只对无缓存的素材入队，避免重复生成。

---

## 4. 需要用户决策的开放问题

1. **codec 白名单范围**：哪些 codec 直接走 FFmpeg？（推荐：flac/alac/opus/vorbis/dts/ac3/mp2——浏览器 WebAudio 普遍不支持的有损/无损格式）
2. **回退策略**：方案 C（预判 + 失败回退，推荐）还是只做「失败回退」（不预判，简单但每次多一次 WebAudio 失败开销）？
3. **autoGenerateWaveform 默认值**：默认 true（保持现状）还是默认 false（改为纯手动，适合大量素材场景）？
4. **批量触发 UI 落点**：MediaBin 右键/工具栏「生成波形」，还是并入 TaskMonitor 面板？（推荐 MediaBin 操作 + TaskMonitor 进度展示）
5. **worker 字节峰值的去留**：保留为「FFmpeg 也失败」的最终兜底（推荐），还是直接移除（失败即报错）？

（若按最小风险默认——方案 C + 白名单 + autoGenerate 默认 true + MediaBin 操作 + 保留兜底——改动收敛为：waveform.ts 回退链重排 + buildJobsForAsset 加开关 + MediaBin 批量按钮 + i18n + 测试，约 300-400 行，无新增依赖，Rust 零改动。）
