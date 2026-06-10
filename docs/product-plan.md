# Product Plan

## Positioning

open-factory is a local-first desktop video editor for fast personal edits, internal demos, screen recordings, and lightweight social clips. It favors predictable editing primitives over cloud collaboration or template marketplaces.

## User Scenarios

- A creator imports a local MP4, trims the intro/outro, adds a title, and exports MP4.
- A product teammate cuts together a short feature demo without uploading unreleased footage.
- A developer validates timeline algorithm changes in a small desktop editor.

## MVP Scope

- Local media import for video, audio, and images.
- Media bin, preview canvas, multi-track timeline, inspector, and toolbar.
- Clip move, trim, split, delete, undo, redo, playhead, playback, zoom, and snapping.
- Text overlay preview.
- `.cutproj.json` save/open with missing-media tolerance.
- FFmpeg detection, multi-track MP4 export, text overlays, embedded audio mix, and queued export tasks.
- Thumbnail, decoded waveform, and proxy caches for smoother large-file editing.
- Background media jobs for automatic proxy/waveform generation.
- Export presets, batch queueing, and retry for failed/canceled tasks.
- Web Audio preview mixing and WebGL preview compositing with fallback.
- Windows native file picker smoke harness.

## Non-Goals

- Cloud sync, account login, telemetry, and remote rendering.
- Full CapCut-grade effects, transitions, motion graphics, and templates.
- Frame-accurate professional color/audio tools.
- Collaborative editing.

## Roadmap

- v0.2: Relative media paths, Relink, multi-track export, drawtext/textfile, cache, proxy media, background jobs, export presets/queue, WebGL preview, and smoke tests.
- v0.3: Better track operations, improved AV sync, ripple edits, advanced GPU/WASM render pipeline, and smarter background media scheduling.
- v0.4: Plugin/script/template system.
