# Changelog

## [0.7.0] - 2026-07-28

### M8 Sprint BG - Experience Polish & Release Preparation

#### Timeline Integration
- Auto-import generated videos to timeline after completion
- Video thumbnail extraction via ffmpeg cover frame capture
- "Show in Explorer" context menu for generated video files
- `useVideoImport` hook encapsulating import logic

#### Preset System
- 3 built-in presets: Quick 480p, Standard 720p, High Quality 1080p
- User custom presets with IndexedDB persistence
- `PresetSelector` component integrated into VideoGenerationPanel
- Preset switching auto-fills all generation parameters

#### Error Recovery & State Persistence
- Sidecar crash recovery: auto-cleanup of partial output files
- Task progress persistence to IndexedDB (survives app restart)
- Orphaned task detection on startup with toast notification
- Enhanced error classification for crash scenarios

#### Infrastructure
- IndexedDB schema upgraded to v3 (generation-history, presets, task-progress stores)
- All Rust tests passing (cargo test)
- TypeScript strict mode clean

## [0.6.0] - 2026-07-27

### M7 Sprint BF - Model Management & GPU Detection

#### Model Downloader
- HuggingFace API integration for remote model discovery
- Resume-capable download with progress tracking
- 5 Tauri commands: download_model, list_local_models, delete_model, get_remote_model_info, list_remote_models

#### GPU Detection
- nvidia-smi based GPU detection with Vulkan fallback
- Automatic precision recommendation (fp16/fp32)
- GPU info panel in the UI

#### End-to-End Integration
- Full pipeline: prompt → Tauri command → sidecar → inference → progress → result → preview
- 4 error classifications: model_not_found, gpu_unavailable, sidecar_crash, inference_timeout
- `getErrorHint()` for user-friendly error messages
- 273 Rust tests passing

## [0.5.0] - 2026-07-26

### M6 Sprint BE - LTX-Video Sidecar Module

#### Backend
- Rust sidecar module for LTX-Video model inference
- Python inference script with JSON stdin/stdout protocol
- Task lifecycle management (start, progress, complete, cancel)
- Output file management in app data directory

#### Frontend
- VideoGenerationPanel with prompt input, parameter controls, progress display
- Generation history with IndexedDB persistence
- ModelManager component for local model management
- GpuInfoPanel for GPU status display

#### Commands
- `generate_video` - Start video generation task
- `get_generation_status` - Query task status
- `cancel_generation` - Cancel running task
