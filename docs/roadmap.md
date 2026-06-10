# Roadmap

## v0.1 MVP

- Local media import.
- Media bin, preview canvas, inspector, toolbar, and multi-track timeline.
- Move, trim, split, delete, undo, redo, playhead, playback, zoom, and snapping.
- Text overlay preview.
- `.cutproj.json` save/open.
- Baseline FFmpeg export and close protection.

## v0.2 Current

- Multi-track FFmpeg export with per-clip overlay composition.
- Text export through `drawtext=textfile` with temporary UTF-8 files.
- FFmpeg capabilities detection and export warnings.
- `schemaVersion: 2`, `project.media`, v0.1 assets migration, `relativePath`, and `originalAbsolutePath`.
- Single and batch Relink for missing media.
- Thumbnail cache and waveform cache with safe hashed filenames.
- Vite-compatible waveform worker.
- Playwright E2E web/mock architecture covering import, adding clips, save/open, missing media, Relink, export, waveform, and cache clearing.
- Embedded video audio export with volume, mute, fade-in/out, and `amix`.
- Export task queue with pending/running/canceled/error/success states.
- Decoded waveform extraction with stereo/multi-channel peak merging and large-file fallback.
- Proxy media generation for large/high-resolution videos, cached under `proxies/{hash}.mp4`.
- Native Tauri smoke test for release window startup and FFmpeg availability.
- Background media job queue for automatic proxy/waveform generation.
- Export presets, batch queueing, and retry for failed/canceled export tasks.
- Web Audio preview mixing for audio clips and embedded video audio.
- WebGL preview compositor with 2D fallback.
- Windows native dialog smoke harness for real file picker coverage.

## v0.3 Next

- Priority scheduling and throttling for background media jobs.
- Batch waveform pre-generation and more codec-aware audio decoding fallbacks.
- More advanced timeline tools: ripple edit, gap close, and grouped clips.
- WASM/GPU export acceleration and advanced preview effects.
- Native dialog automation for macOS/Linux hosts where unattended dialog control is available.

## v0.4

- Plugin system.
- Script system.
- Template/title preset system.
- MCP/headless automation mode.
- Export presets and batch export workflows.
