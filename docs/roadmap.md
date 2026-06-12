# Roadmap

## v0.1 MVP - Done

- [x] Local media import.
- [x] Media bin, preview canvas, inspector, toolbar, and multi-track timeline.
- [x] Move, trim, split, delete, undo, redo, playhead, playback, zoom, and snapping.
- [x] Text overlay preview.
- [x] `.cutproj.json` save/open.
- [x] Baseline FFmpeg export and close protection.

## v0.2 Foundation - Done

- [x] Multi-track FFmpeg export with per-clip overlay composition.
- [x] Text export through `drawtext=textfile` with temporary UTF-8 files.
- [x] FFmpeg capabilities detection and export warnings.
- [x] `schemaVersion: 2`, `project.media`, v0.1 assets migration, `relativePath`, and `originalAbsolutePath`.
- [x] Single and batch Relink for missing media.
- [x] Thumbnail cache and waveform cache with safe hashed filenames.
- [x] Vite-compatible waveform worker.
- [x] Playwright E2E web/mock architecture covering import, adding clips, save/open, missing media, Relink, export, waveform, and cache clearing.
- [x] Embedded video audio export with volume, mute, fade-in/out, and `amix`.
- [x] Export task queue with pending/running/canceled/error/success states.
- [x] Decoded waveform extraction with stereo/multi-channel peak merging and large-file fallback.
- [x] Proxy media generation for large/high-resolution videos, cached under `proxies/{hash}.mp4`.
- [x] Native Tauri smoke test for release window startup and FFmpeg availability.
- [x] Background media job queue for automatic proxy/waveform generation.
- [x] Export presets, batch queueing, and retry for failed/canceled export tasks.
- [x] Web Audio preview mixing for audio clips and embedded video audio.
- [x] WebGL preview compositor with 2D fallback.
- [x] Windows native dialog smoke harness for real file picker coverage.

## v0.3 Editing And Export Expansion - Done

- [x] GPU hardware encoding detection and export selection.
- [x] Chroma key, shape masks, stabilization, PNG sequence export, and current-frame export.
- [x] Timeline render cache and preview A/B compare mode.
- [x] Whisper subtitle generation from local executable/model paths.
- [x] Title template presets and `drawtext` export coverage.
- [x] GIF, animated WebP, and APNG export presets and FFmpeg plans.
- [x] Project archive workflow with relative media rewriting.
- [x] Frame interpolation export through `minterpolate` when FFmpeg supports it.

## v0.4 Professional Tooling - Done

- [x] Automatic color match and non-default color curve export.
- [x] LUT browser with local `.cube` preview, favorites, and `lut3d` export.
- [x] Timeline export format for external interchange.
- [x] Custom keyboard shortcut persistence.
- [x] Multicam sequence creation, angle cuts, and export flattening.
- [x] Audio denoise export through `arnndn` when FFmpeg supports it.
- [x] Subtitle translation through user-configured optional providers.
- [x] Local JavaScript plugin system with Worker isolation and `onExportBefore` hooks.

## v0.5 Reliability And Automation - Done

- [x] Parallel export queue behavior in the mocked E2E flow.
- [x] Built-in camera Log to Rec.709 LUT artifacts.
- [x] Smart reframe export for vertical and alternate aspect ratios.
- [x] Automatic proxy generation settings for large/high-resolution media.
- [x] Silence detection and auto-cut workflow.
- [x] Scene detection and split-at-scene coverage in golden smoke.
- [x] Golden smoke suite with 16 real FFmpeg fixtures.
- [x] Release desktop packaging through Tauri MSI and NSIS bundles.

## v0.6.0 Current Capability Baseline

- Local-first desktop editor with no login, telemetry, media upload, or remote rendering.
- Tauri 2 release build, Windows installer output, native startup smoke, preview smoke, dialog smoke, cancel smoke, and golden FFmpeg smoke coverage.
- Core editor package remains pure TypeScript and covered above the 80% threshold.
- Command-object timeline mutation model with undo/redo coverage.
- Multi-format export pipeline using FFmpeg argument arrays, temporary text artifacts, queue status, cancellation, and retry.
- WebGL/2D preview, Web Audio mixing, waveform/thumbnail/proxy cache, render cache, and background media jobs.
- Local-only media project workflows: schema migration, autosave recovery, missing media tolerance, Relink, batch Relink, and project archive.
- Advanced editing surfaces: nested sequences, multicam, scene detection, silence removal, keyframes, transitions, speed changes, masks, chroma key, stabilization, frame interpolation, and smart reframe.
- Color and audio tools: LUTs, Log conversion, color match, color curves, scopes, A/B compare, mixer pan/EQ/compressor, clip volume/fades, denoise, and VU metering.
- Subtitle workflow: SRT import, burn-in/soft-sub export, local Whisper generation, and optional user-configured translation.
- Local plugin loading from the app data plugin directory with Worker isolation.
- `check:release` script for the full release gate: typecheck, unit coverage, production build, Playwright E2E, Tauri build, and golden smoke.

## Next

- Ripple edit, gap close, rolling trim, grouped clips, and related professional timeline shortcuts.
- Smart rough-cut panel that coordinates scene detection, silence removal, local Whisper subtitles, and an edit report.
- Priority scheduling and explicit throttling controls for background media jobs.
- Batch waveform pre-generation controls and more codec-aware audio decoding fallbacks.
- Main bundle code splitting for heavy panels and settings pages.
- macOS/Linux native dialog automation where unattended host control is available.
- WASM/GPU export acceleration and advanced preview effects.
- Headless automation mode once the desktop editing surface is stable enough to expose safely.
