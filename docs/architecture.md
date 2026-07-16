# Architecture

## Layers

- `packages/editor-core`: pure TypeScript models, timeline algorithms, command objects, project migration, relative path helpers, Relink scoring, cache keys, and FFmpeg export planning.
- `apps/desktop/src`: React UI, Zustand state, command manager singleton, media import, cache service, background media jobs, waveform worker, WebGL/2D preview renderer, project IO, Relink UI, proxy UI, export queue, and export dialog.
- `apps/desktop/src-tauri`: Tauri 2 Rust shell, plugin registration, file/cache commands, media probing, proxy generation, FFmpeg capability detection, FFmpeg process execution, progress events, cancellation, smoke mode, and close protection.

## Store Architecture (v4.26.0)

v4.26.0 完成了 Store 层重构，将 God Store 拆分为功能域 Store：

### UI 状态 Store

| Store | 职责 | 状态数 |
|-------|------|--------|
| `dialogStore.ts` | 对话框开关状态 | ~25 |
| `modalStore.ts` | 模态弹窗状态 | ~15 |
| `panelStore.ts` | 面板可见性与布局 | ~15 |
| `toolbarStore.ts` | 工具栏/菜单状态 | ~10 |

### 功能域 Store

| Store | 职责 | 状态数 |
|-------|------|--------|
| `aiFeatureStore.ts` | AI 相关功能状态 | ~15 |
| `exportFeatureStore.ts` | 导出相关状态 | ~10 |
| `timelineFeatureStore.ts` | 时间线增强功能 | ~10 |
| `mediaFeatureStore.ts` | 媒体管理功能 | ~10 |

### 核心 Store

| Store | 职责 |
|-------|------|
| `editorStore.ts` | 核心编辑器状态 (timeline/media/selection) |
| `editorUIStore.ts` | 编辑器 UI 状态 (re-export 入口，向后兼容) |
| `editorFeatureStore.ts` | 编辑器功能状态 (re-export 入口，向后兼容) |
| `commandManager.ts` | 命令管理器单例 |

所有旧 Store 保留为 re-export 入口，确保向后兼容。详见 [迁移指南](migration/v4.26.0-migration-guide.md)。

## Component Architecture (v4.26.0)

v4.26.0 完成了超大组件拆分：

### Timeline 模块 (`apps/desktop/src/components/Timeline/`)

| 文件 | 行数 | 职责 |
|------|------|------|
| `Timeline.tsx` | 817 | 主组件入口 |
| `useTimelineState.ts` | ~1,172 | State/memos/effects hook |
| `useTimelineHandlers.ts` | ~3,458 | Handler 函数 hook |
| `TimelineHeader.tsx` | ~446 | 工具栏 (React.memo) |
| `TimelineTracksContainer.tsx` | ~905 | 轨道容器 (React.memo) |
| `TimelineDialogsLayer.tsx` | ~423 | 对话框层 (React.memo) |
| `TimelineMenus.tsx` | ~993 | 菜单组件 |
| `TimelineOverlays.tsx` | ~893 | 覆盖层组件 |
| `TimelineDialogs.tsx` | ~1,124 | 对话框组件 |

### Inspector 模块 (`apps/desktop/src/components/Inspector/`)

| 文件 | 行数 | 职责 |
|------|------|------|
| `Inspector.tsx` | 310 | 主组件入口 |
| `useClipInspectorState.ts` | ~1,757 | State/handlers hook |
| `ClipInspectorBody.tsx` | ~3,236 | JSX 渲染体 (React.memo) |
| `InspectorFields.tsx` | ~407 | 可复用字段组件 |
| `InspectorEditors.tsx` | ~3,546 | 编辑器组件 |

### 模块化逻辑文件 (v4.26.0)

| 原始文件 | 模块目录 | 子模块数 | 最大模块行数 |
|---------|---------|---------|------------|
| `ffmpeg-builder.ts` (5,215行) | `export/ffmpeg-builder/` | 8 | 1,694 |
| `model.ts` (2,713行) | `model/` | 6 | 700 |
| `tauri-bridge.ts` (2,520行) | `lib/tauri-bridge/` | 7 | 688 |

每个模块目录保留 `index.ts` 作为 barrel re-export 入口，确保向后兼容。

## Project Schema

Current files use `schemaVersion: 2` and `project.media`.

```json
{
  "schemaVersion": 2,
  "project": {
    "id": "uuid",
    "name": "My Project",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "settings": { "fps": 30, "width": 1280, "height": 720 },
    "media": [],
    "timeline": { "tracks": [] }
  }
}
```

`migrateProjectFile` converts v0.1 files from `assets` to `media`. `serializeProjectFile` writes normalized forward-slash paths, `relativePath` when possible, and `originalAbsolutePath` for Relink context. Windows cross-drive paths return `relativePath: null`.

## Command System

`CommandManager` is a module-level singleton in `apps/desktop/src/store/commandManager.ts`. Commands receive a `TimelineAccessor`; `execute()` and `undo()` call `useEditorStore.getState().replaceTimeline(...)` through that accessor. React components do not directly mutate timeline clips or tracks.

Media library updates, project path changes, cache state, and selection state are not timeline mutations and can go through store actions.

## Tauri Bridge

All frontend Tauri calls go through `apps/desktop/src/lib/tauri-bridge/` (v4.26.0: split into 7 sub-modules):

| 模块 | 职责 |
|------|------|
| `types.ts` | 所有 interface/type |
| `mock-types.ts` | TauriMocks 接口 |
| `fs.ts` | 文件系统操作 |
| `media.ts` | 媒体分析 |
| `export.ts` | 导出相关 |
| `window.ts` | 窗口/系统/协作 |
| `ai-db.ts` | AI API + 媒体索引 |

Barrel re-export 通过 `index.ts` 保持向后兼容。

- Tauri runtime: calls real `invoke`, `listen`, plugin dialog confirm, shell open, and `convertFileSrc`.
- Web/E2E runtime: calls `window.__TAURI_MOCKS__`.
- Missing mock: throws a clear error for debugging.

Playwright uses `VITE_E2E=true` to load `src/e2e/install-mocks.ts`, which mocks file dialogs, project files, media probing, cache, FFmpeg capabilities, export progress, Relink scanning, and cache clearing.

## Preview Flow

Preview rendering lives in `apps/desktop/src/lib/preview/renderer.ts`.

- Active clips are selected with `getActiveClipsAtTime`.
- Video source time is `playheadTime - clip.start + clip.trimStart`.
- Video elements are pooled by media id.
- The renderer waits for `seeked` before `drawImage`.
- Images and text use transform: translate, rotate, scale, opacity.
- Audio clips use pooled `HTMLAudioElement` instances and calibrate against playhead time once per second.
- WebGL compositing lives in `apps/desktop/src/lib/preview/webgl-compositor.ts` and is used when available.
- WebGL draws video, image, text, and missing-media overlays; the old 2D path remains the fallback.
- Audio preview uses Web Audio `GainNode` mixing for audio clips and videos with embedded audio. It applies clip volume, mute, fade-in, and fade-out. Visual proxy media can be used for video frames, while audio preview still uses the original source to avoid silent proxy files.

## FFmpeg Export Pipeline

`packages/editor-core/src/export/ffmpeg-builder/` converts the project timeline into `FfmpegExportPlan`. The module is split into 8 sub-modules (v4.26.0):

| 模块 | 职责 |
|------|------|
| `export-plan.ts` | 核心导出计划构建 |
| `project-converter.ts` | ExportProject 构建 |
| `settings-normalize.ts` | 设置规范化 |
| `visual-filters.ts` | 视觉滤镜 |
| `audio-filters.ts` | 音频滤镜 |
| `text-subtitle-filters.ts` | 文本与字幕滤镜 |
| `audio-visualization.ts` | 音频可视化滤镜 |
| `utils.ts` | 辅助函数 |

The default plan:

1. Creates a full-duration black base.
2. Adds each video/image clip as its own input.
3. Trims and PTS-shifts each clip to timeline time.
4. Overlays clips with `enable='between(t,start,end)'` in track order.
5. Applies text clips with `drawtext=textfile=__TEXTFILE_clip__`.
6. Adds audio clips with `atrim`, `asetpts`, `adelay`, `volume`, and `amix`.
7. Adds embedded video audio when media probing reports an audio stream.
8. Applies audio `muted`, `volume`, `fadeInDuration`, and `fadeOutDuration`.
9. Emits `fullArgs: string[]`; execution never uses `cmd /C`, `sh -c`, or shell strings.

Rust `run_export` does not build FFmpeg graphs. It receives the tested `fullArgs` array from editor-core, writes text artifacts to a temporary directory, escapes drawtext paths, replaces placeholders in `fullArgs`, spawns FFmpeg with `Command::new("ffmpeg").args(...)`, parses stderr `time=`, emits `export-progress`, and cleans temporary files on success, failure, or cancellation.

## Export Queue

The queue UI lives in `apps/desktop/src/export/ExportDialog.tsx`. State is stored in `export-queue-store.ts`, with task transitions delegated to pure helpers from `packages/editor-core/src/export/export-queue.ts`.

- Enqueue builds a complete `FfmpegExportPlan` up front using the selected export preset.
- Batch export accepts one output path per line and adds one queued task per path.
- The runner executes one task at a time.
- `export-progress` updates only the currently running task.
- Pending tasks cancel locally.
- Running task cancellation marks the task canceled and calls Rust `cancel_export`.
- Failed or canceled tasks can be retried by resetting their status to `pending`.
- Toolbar progress is derived from the current running queue task.

Export presets are defined in `apps/desktop/src/export/export-presets.ts`. `buildExportProjectFromProject` accepts settings overrides for width, height, fps, sample rate, and codec fields.

## FFmpeg Capabilities

`get_ffmpeg_capabilities` checks:

- availability and version
- `libx264`
- AAC encoder
- `drawtext`
- `libfreetype`

If drawtext/libfreetype is unavailable, the builder skips text clips and returns warnings that the UI displays.

## Relink

Relink logic is split between pure scoring and UI:

- `scoreRelinkCandidate` compares name, extension, size, duration, and dimensions.
- Single Relink lets the user choose a replacement file.
- Relink all scans a selected directory up to three levels deep and picks best-scoring candidates.
- Reconnected media keeps the original id so existing timeline clips remain valid.

## Cache

Cache keys are generated in `packages/editor-core/src/cache/cache-key.ts` from normalized `path + size + mtime + formatVersion`. Raw keys are hashed before becoming filenames, so Windows paths, colons, slashes, and non-ASCII characters never become literal file names.

Cache paths:

- `thumbnails/{hash}.webp`
- `waveforms/{hash}.json`
- `media-index/{hash}.json`
- `proxies/{hash}.mp4`

The frontend cache service reads/writes through Tauri cache commands. Thumbnail and waveform cache failures are non-fatal. The waveform worker is loaded with:

```ts
new Worker(new URL('../workers/waveform.worker.ts', import.meta.url), { type: 'module' });
```

The worker does not access DOM, Zustand, React, or Tauri APIs.

Waveform generation first tries Web Audio `decodeAudioData`, then uses the Vite worker or byte sampling fallback. The core `extractDecodedWaveform` helper merges mono/stereo/multi-channel peaks into normalized point buckets.

## Proxy Media

Proxy planning is pure editor-core code in `packages/editor-core/src/proxy/proxy-planner.ts`.

- Non-video media is ignored.
- Existing ready proxies are reused.
- Large source files or high-resolution videos get a cache path under `proxies/{hash}.mp4`.
- Tauri `generate_proxy` runs FFmpeg with argument arrays and writes an H.264 proxy without audio.
- Preview resolves media through `getPreviewMediaPath(asset)`, so ready proxies are used only for editing/preview; export planning still uses original `asset.path`.

## Background Media Jobs

`apps/desktop/src/media/media-job-store.ts` tracks `proxy` and `waveform` jobs with `pending`, `running`, `success`, and `error` states. `useBackgroundMediaJobs` enqueues work whenever the media library changes.

- Proxy jobs are created for videos that pass `shouldGenerateProxy`.
- Waveform jobs are created for audio assets and videos that have embedded audio.
- The runner executes jobs sequentially to avoid overwhelming disk and FFmpeg.
- Proxy jobs update media status to `pending`, `ready`, or `error`.
- Waveform jobs warm the waveform cache for future timeline display.

## Native Smoke Test

Rust setup checks `OPEN_FACTORY_SMOKE=1`. In smoke mode it verifies that the main window exists, runs `ffmpeg -version`, writes a JSON report to `OPEN_FACTORY_SMOKE_REPORT`, and exits with code 0 only when both checks pass.

The script `apps/desktop/scripts/tauri-smoke.mjs` launches the release executable and validates that report. Real OS file dialogs are not clicked in unattended smoke mode because they would block automation; dialog behavior remains covered by Tauri commands and Playwright mocks.

`OPEN_FACTORY_PREVIEW_SMOKE=1` launches the release executable with a synthetic local MP4 fixture, imports it through the same media path as normal users, adds it to the timeline through a command object, and requires render-time pixel readback to prove a non-transparent, non-background video pixel. The readback is captured at the end of `PreviewRenderer.render` so WebGL contexts that were created before smoke mode do not depend on late drawing-buffer preservation.

`OPEN_FACTORY_DIALOG_SMOKE=1` opens a real native file picker with the title `Open Factory Dialog Smoke`. The Windows harness in `apps/desktop/scripts/dialog-smoke.mjs` enumerates native windows, closes the `#32770` file picker, and validates that the dialog returned canceled. This complements Playwright mocks with host-level dialog coverage.

`apps/desktop/scripts/golden-smoke.mjs` creates a synthetic local video+audio fixture, builds an export through `packages/editor-core/src/export/ffmpeg-builder.ts`, runs the real FFmpeg binary, validates the exported center pixel, writes a JSON report, and refreshes the README preview frame.

## Local Privacy

open-factory has no login, telemetry, media upload, or remote rendering. Media files remain on the local filesystem and are accessed through Tauri permissions and `convertFileSrc`.

本地优先架构；字幕翻译为可选联网功能，需用户主动启用并同意服务条款。 When enabled, subtitle translation sends subtitle text only to the selected third-party translation provider; media files remain local.
