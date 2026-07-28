# Open Factory Desktop

Local-first desktop video editor built with Tauri 2.x, React 18, TypeScript, and Vite.

## Features

### AI Video Generation (LTX-Video)

Generate videos from text prompts or images using the LTX-Video model, running entirely locally on your GPU.

**Capabilities:**
- Text-to-video generation with customizable parameters
- Image-to-video generation (image as first frame)
- Real-time progress tracking with stage indicators
- Automatic video import to timeline after generation
- Generation history with IndexedDB persistence
- GPU detection with automatic precision recommendation (fp16/fp32)

**Presets:**
- Quick 480p (16 frames, 25 steps) - Fast preview generation
- Standard 720p (32 frames, 50 steps) - Balanced quality/speed
- High Quality 1080p (64 frames, 75 steps) - Maximum quality
- Custom presets with user-defined parameters

**Requirements:**
- CUDA-compatible GPU with at least 4 GB VRAM
- Python 3.x with PyTorch installed
- LTX-Video model weights (downloadable from Model Manager)

### Video Editing

- Multi-track timeline with drag-and-drop
- Real-time preview with GPU acceleration
- Audio mixing and waveform display
- Subtitle generation and editing
- Export with hardware encoder support

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Start Tauri desktop app
bun run tauri:dev

# Run type checking
bun run typecheck

# Run E2E tests
bun run e2e

# Build for production
bun run tauri:build
```

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Rust (Tauri 2.x) with sidecar processes for AI inference
- **AI Pipeline**: Python sidecar for LTX-Video model inference
- **Storage**: IndexedDB for generation history, presets, and task progress
- **State Management**: Zustand stores for editor state

## Project Structure

```
apps/desktop/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── AIVideoGeneration/  # AI video generation panel
│   │   ├── Timeline/       # Video timeline editor
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and bridge layer
│   └── store/              # Zustand state stores
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── ltx_video/      # LTX-Video sidecar module
│   │   ├── model_downloader/ # Model download management
│   │   ├── gpu_detect/     # GPU detection and capabilities
│   │   └── commands/       # Tauri command handlers
│   └── Cargo.toml
└── e2e/                    # Playwright E2E tests
```
