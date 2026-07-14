# Product Plan

## Positioning

Open Factory is a **professional-grade, local-first desktop video editor** designed for content creators, filmmakers, and video professionals who demand privacy, performance, and creative control. Unlike cloud-based editors, Open Factory keeps all media and project data on the user's local device, with zero telemetry, zero login requirements, and zero cloud uploads.

## Core Value Propositions

1. **Privacy-First Architecture** — All processing happens locally. No data leaves the user's device.
2. **Professional Editing Capabilities** — Multi-track timeline, advanced color grading, professional audio mixing, and AI-powered tools.
3. **Interoperability** — Seamless exchange with Final Cut Pro, Avid, Pro Tools via FCPXML, EDL, AAF/OMF.
4. **AI-Powered Workflows** — Intelligent remix, automatic subtitles, smart recommendations, and content analysis.
5. **Extensibility** — Plugin system with Worker isolation for custom workflows.

## User Scenarios

### Professional Creator
- Imports footage from multiple cameras
- Uses multi-cam editing for angle switching
- Applies professional color grading with node-based engine
- Mixes audio with 20+ built-in effects
- Exports with GPU-accelerated encoding

### Content Creator
- Imports local recordings
- Uses AI smart remix for automatic highlight generation
- Generates subtitles automatically with AI
- Applies quick color correction with LUTs
- Exports to multiple platforms with smart reframe

### Video Editor
- Collaborates on projects with real-time sync
- Uses FCPXML to exchange projects with Final Cut Pro users
- Applies advanced keyframe animations
- Uses proxy workflow for smooth editing of 4K+ footage
- Exports with quality assessment (VMAF)

### Developer/Technical User
- Extends functionality with custom plugins
- Automates workflows with scripting
- Integrates with external tools via command-line interface
- Uses headless mode for batch processing

## Feature Matrix

### Editing Engine
- ✅ Multi-track timeline with unlimited tracks
- ✅ Advanced clip operations: ripple delete, slip, slide, nested sequences
- ✅ Command-object based undo/redo with full history
- ✅ Keyframe animation with bezier/linear/step interpolation
- ✅ Split screen and picture-in-picture layouts
- ✅ Storyboard mode for quick rough cuts

### Color Grading
- ✅ Node-based color grading engine with WebGL shaders
- ✅ Primary color correction: Lift/Gamma/Gain wheels
- ✅ Curve editor with RGB per-channel control
- ✅ HSL qualifier for secondary color correction
- ✅ LUT management with .cube file support
- ✅ Window masks for targeted adjustments
- ✅ Color scopes: waveform, vectorscope, histogram

### Audio Mixing
- ✅ Professional mixer with Submix/Send/Aux/Master routing
- ✅ 20+ audio effects: EQ, compressor, limiter, noise gate, reverb, delay, etc.
- ✅ AI-powered audio denoise (nnnoiseless)
- ✅ Automation curves with Read/Write/Touch/Latch modes
- ✅ VU metering with peak/RMS display
- ✅ 3D spatial audio with HRTF support
- ✅ Dialogue detection and speaker diarization

### AI Features
- ✅ AI smart remix with beat detection
- ✅ AI automatic subtitle generation (4-stage workflow)
- ✅ Local Whisper integration for speech-to-text
- ✅ AI scene detection with adaptive thresholds
- ✅ Smart rough cut with algorithmic and AI modes
- ✅ Multi-model AI support (15+ providers)
- ✅ Intelligent recommendations: transitions, B-roll, rhythm, volume normalization
- ✅ Narrative analysis: story structure, emotion detection, character timelines
- ✅ AI reframe for different aspect ratios
- ✅ Speech understanding: transcription, emotion analysis, intonation detection
- ✅ Smart color: consistency correction, look matching, denoise suggestions

### Interoperability
- ✅ FCPXML import/export (Final Cut Pro interchange)
- ✅ CMX 3600 EDL support
- ✅ AAF/OMF export for Avid/Pro Tools
- ✅ Smart media matching with fuzzy name scoring

### Export & Distribution
- ✅ Multi-format export: MP4, GIF, WebP, APNG, PNG sequence
- ✅ DAG export pipeline with quality checks and hooks
- ✅ GPU hardware encoding: NVENC, VideoToolbox
- ✅ Hardware-accelerated decoding: CUDA, VAAPI, QuickSync, D3D11VA, VideoToolbox
- ✅ Render farm for distributed rendering
- ✅ Progressive export with preview
- ✅ Batch export with versioning
- ✅ Multi-platform distribution with smart crop
- ✅ Quality assessment with VMAF

### Project Management
- ✅ Auto-save and crash recovery
- ✅ Snapshot versioning
- ✅ Project archiving and sharing
- ✅ Project health diagnostics
- ✅ SQLite media index
- ✅ Project encryption (AES-GCM)
- ✅ WebDAV backup

### Media Tools
- ✅ Screen recording via FFmpeg
- ✅ Vocal separation (Demucs)
- ✅ Waveform generation
- ✅ Silence detection
- ✅ Beat detection
- ✅ Media transcoding

### Collaboration & Security
- ✅ Real-time collaboration via WebSocket
- ✅ Shared media library
- ✅ SSRF protection
- ✅ Path validation
- ✅ Privacy area detection

## Technical Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript |
| Desktop Runtime | Tauri 2 (WebView2) |
| Backend | Rust |
| Package Manager | Bun |
| Testing | Vitest (unit) + Playwright (E2E) |
| Build | Vite + Tauri CLI |

## Version History

- **v0.1 - v0.6**: MVP through capability baseline (2024-2025)
- **v4.0 - v4.10**: Core editing engine maturity (2025-2026)
- **v4.11 - v4.20**: Professional color and audio tools (2026)
- **v4.21 - v4.25**: AI features and interoperability (2026)

## Future Roadmap

### Short-term (v4.26 - v4.30)
- Enhanced timeline operations (ripple, rolling, slip, slide)
- Smart rough-cut panel with AI coordination
- Improved background job scheduling
- Code splitting for performance optimization

### Medium-term (v5.0+)
- React 19 and Tailwind CSS 4 migration
- Enhanced plugin ecosystem with marketplace
- macOS and Linux native optimizations
- WASM/GPU acceleration for export and preview

### Long-term Vision
- Industry-standard professional video editor
- Extensible architecture for custom workflows
- AI-first editing experience
- Cross-platform native performance

---

*Last updated: 2026-07-14*
*Version: v4.25.1*
