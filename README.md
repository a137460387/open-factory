# open-factory

open-factory is a local-first desktop video editor MVP built with Tauri 2, React, TypeScript, Zustand, and a pure `editor-core` package. It keeps user media on the local machine, has no login or telemetry, and implements a clean-room timeline editor with media import, preview, project files, Relink, cache, and FFmpeg export.

![Golden preview frame](docs/open-factory-golden-preview.png)

The golden preview frame is generated locally from a synthetic FFmpeg fixture by `bun run smoke:golden`; no user media is checked in or uploaded.

## Features

- Import local video, audio, and image files.
- Add video, audio, image, and text clips to multi-track timelines with mute, solo, lock, and track volume controls.
- Move, trim, split, delete, undo, and redo timeline edits through command objects.
- Preview video, image, text, and audio locally with Tauri `convertFileSrc`.
- Save and open `.cutproj.json` files using `schemaVersion: 2` and `project.media`.
- Store same-drive media as `relativePath`; keep absolute paths with a warning for Windows cross-drive media.
- Mark missing media without blocking project load, then Relink a single item or scan a folder for all missing media.
- Cache thumbnails and waveform previews with keys based on `path + size + mtime`.
- Run a background media job queue that automatically generates decoded waveform previews and proxy media when suitable.
- Generate decoded waveform previews with Web Audio when available, worker/byte fallback for large files, and reusable waveform cache.
- Generate proxy media for large video files or high-resolution sources; preview uses proxy while export keeps original media paths.
- Export MP4 with FFmpeg through argument arrays, multi-track overlay compositing, per-clip color correction, per-clip speed, adjacent clip transitions, text `drawtext=textfile`, embedded video audio, audio fade/volume/mute, and `amix`.
- Animate clip opacity, volume, position, and scale with undoable keyframes; image clips can enable a Ken Burns pan/zoom setup.
- Queue multiple export tasks, select export presets, batch output paths, retry failed/canceled tasks, and keep toolbar progress visible while the queue runs.
- Preview audio through a Web Audio mixer that includes audio tracks and embedded video audio.
- Use a WebGL preview compositor when available, with 2D canvas fallback.
- Run Playwright E2E in web/mock mode without real dialogs, FFmpeg, or user media.
- Run native Tauri smoke tests that launch the release app, check local FFmpeg execution, and automate a real Windows file picker dialog.

## Prerequisites

- Rust stable >= 1.77: `rustup install stable`
- Node.js >= 20 LTS
- Bun >= 1.1
- macOS: `xcode-select --install`
- Windows: WebView2 Runtime and Microsoft C++ Build Tools from Visual Studio Installer
- Linux: Tauri WebKit dependencies such as `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev librsvg2-dev`
- FFmpeg for export:
  - macOS: `brew install ffmpeg`
  - Windows: `winget install ffmpeg`
  - Linux: `sudo apt install ffmpeg`
  - Text export needs `drawtext` and `libfreetype`; Homebrew and official FFmpeg builds usually include them.
- Fonts for text export:
  - Windows: Microsoft YaHei or Arial
  - macOS: PingFang or Helvetica
  - Linux: DejaVu Sans

## Install

```bash
bun install
```

## Develop

```bash
bun run dev
bun run tauri:dev
```

The Vite, Tauri, and Playwright dev URL is `http://localhost:1420`.

## Test

```bash
bun run typecheck
bun run test
bun x playwright install chromium
bun run e2e
bun run e2e:headed
bun run e2e:ui
bun run smoke:tauri
bun run smoke:preview
bun run smoke:dialog
bun run smoke:cancel
bun run smoke:golden
```

Coverage output is written to `coverage/`. `packages/editor-core` thresholds are 80% for lines, functions, branches, and statements.

`bun run smoke:tauri` expects a release executable from `bun run tauri:build`. It writes and validates `apps/desktop/src-tauri/target/open-factory-smoke-report.json`.
`bun run smoke:preview` also expects a release executable. It generates a local original MP4 fixture plus a 640x360 proxy MP4 with FFmpeg, launches the packaged Tauri app, verifies the original asset is imported through `convertFileSrc`, attaches the proxy as local preview media, and confirms `PreviewRenderer` reads back the proxy green center pixel near `[47, 209, 126, 255]` in `apps/desktop/src-tauri/target/open-factory-preview-smoke-report.json`.
`bun run smoke:dialog` also expects a release executable. On Windows it opens a real native file picker, finds the `#32770` dialog window, closes it, and validates `apps/desktop/src-tauri/target/open-factory-dialog-smoke-report.json`.
`bun run smoke:cancel` also expects a release executable. It creates a synthetic 30-second local video+audio fixture, launches the packaged Tauri app, triggers export cancellation through the UI, verifies the Rust FFmpeg child is stopped, confirms partial output cleanup, retries the task successfully, and writes `apps/desktop/src-tauri/target/open-factory-cancel-smoke-report.json`.
`bun run smoke:golden` expects `packages/editor-core/dist` from `bun run build`. It creates synthetic local FFmpeg fixtures, builds each export through the real editor-core FFmpeg planner, runs FFmpeg, validates duration, size, and pixels, refreshes `docs/open-factory-golden-preview.png`, and writes `apps/desktop/src-tauri/target/golden-smoke/golden-smoke-report.json`.

Golden fixtures:

- `text-drawtext`: solid dark-blue background plus a `drawtext=textfile` text clip with pink text and a cyan text box; the sampled frame must contain more than 1000 non-background pixels, more than 500 pink text pixels, and more than 5000 cyan box pixels.
- `multi-clip-overlay`: coral first video segment, blue second video segment, and yellow image overlay on the second segment; center pixels must be near `[217, 85, 63, 255]` at `0.45s` and `[247, 216, 74, 255]` at `1.45s`.
- `audio-volume-fade`: violet video with embedded audio, `fadeInDuration: 0.5`, and `volume: 0.5`; export must be non-empty, duration-correct, and include the fade and volume filters.
- `subtitle-burn-in`: solid dark-blue background plus two subtitle clips serialized to a temporary SRT artifact; export must include the `subtitles=filename` filter, white `PrimaryColour` force style with `MarginV=72`, and more than 200 white subtitle pixels.
- `color-correction`: cyan video with `hue: 60`; export must include the `eq` and `hue=h=60` filters and shift the center pixel away from cyan to a blue-dominant `[141, 126, 254, 255]`.
- `speed-change`: 1.5s green video with embedded audio exported at `speed: 2`; output duration must be about `0.75s`, include `setpts=(PTS-STARTPTS)/2+0/TB` and `atempo=2.0`, and keep the center pixel near `[47, 209, 126, 255]`.
- `mute-track`: green video track plus a muted audio track; export must exclude the muted audio input, fall back to silent `anullsrc`, and keep the center pixel near `[47, 209, 126, 255]`.
- `ken-burns`: patterned local image clip with Ken Burns scale keyframes from `1x` to `1.5x`; export must include a frame-evaluated scale expression and the first/last center-region average pixels must differ.
- `proxy-preview-original-export`: original 1280x720 green source exported while proxy metadata is present; export must use the original media path and center pixel near `[47, 209, 126, 255]`, matching the proxy preview smoke color within +/- 10 RGB.

## Build

```bash
bun run build
bun run tauri:build
```

Frontend output is written to `apps/desktop/dist`. Tauri bundles are written under `apps/desktop/src-tauri/target/release/bundle/`.

## Export

Open the export dialog from the toolbar, choose an output `.mp4`, select a preset, optionally paste one output path per line for batch export, then click Add to queue. The exporter builds a `filter_complex` graph in `packages/editor-core`, sends `fullArgs: string[]` to Rust, and Rust executes `Command::new("ffmpeg").args(...)`.

The current compositor creates a black base, overlays every video/image clip at timeline time, renders adjacent dissolve/fade-black transitions with FFmpeg `xfade`, applies text clips through `drawtext=textfile`, mixes standalone audio and embedded video audio with `amix`, and applies clip volume, track volume, mute, fade-in, and fade-out. Text files are written to a temporary directory and cleaned after success, failure, or cancellation.

Export queue states are `pending`, `running`, `canceled`, `error`, and `success`. Pending tasks cancel immediately; running tasks call the Rust `cancel_export` command. Canceled or failed tasks can be retried from the queue.

## Project Paths And Relink

Project files use `schemaVersion: 2`:

```json
{
  "schemaVersion": 2,
  "project": {
    "media": [],
    "timeline": { "tracks": [] }
  }
}
```

Same-drive media is saved with `relativePath`. Windows cross-drive media cannot be made relative, so the absolute path is kept and a warning is recorded. Opening a project checks media paths, marks missing files, and keeps the project usable. Missing media cards show a Relink button and the media bin can Relink all missing items by scanning a selected folder up to three levels deep.

## Cache

Cache keys use normalized `path + size + mtime + cache format version`. Raw keys are hashed before becoming filenames:

- `thumbnails/{hash}.webp`
- `waveforms/{hash}.json`
- `media-index/{hash}.json`
- `proxies/{hash}.mp4`

Use the toolbar cache button to clear cached thumbnails, waveform data, and proxy files. Cache failures are non-fatal and surface as warnings or fallbacks. The media bin shows background media job status while proxy and waveform tasks run.

## Proxy Media

Video cards show proxy status. For large files or sources larger than the preview proxy target, the background media job queue automatically generates a proxy. The manual Generate proxy button remains available for retry. Tauri runs FFmpeg with argument arrays to create an H.264 proxy in the app cache. Preview video uses the proxy path when ready; preview audio and export planning still read the original media path for final quality.

## Preview

The preview renderer tries a WebGL compositor for video, image, text, and missing-media overlays. If WebGL is unavailable, it falls back to the 2D canvas renderer. Audio preview uses Web Audio gain nodes to mix audio clips and video clips with embedded audio, including volume, mute, fade-in, and fade-out.

## Current Limits

- Rotation export uses FFmpeg `rotate` but advanced bounding and blend modes are still limited.
- Web Audio decoded waveform depends on browser codec support; very large files can fall back to sampled previews.
- Playwright E2E runs web/mock mode. Native dialog smoke automation currently supports Windows.
- Proxy generation is automatic for recommended assets, but more advanced scheduling priorities and throttling are future work.
- WebGL preview covers core compositing, but advanced effects and WASM/GPU export acceleration are future work.

## Troubleshooting

- FFmpeg missing: install it with the command for your platform above.
- FFmpeg has no drawtext/libfreetype: text overlays are skipped with a visible warning; install an FFmpeg build with libfreetype.
- Playwright browser missing: run `bun x playwright install chromium`.
- Tauri build fails: verify Rust stable, WebView2, Visual Studio C++ Build Tools, and platform-specific dependencies.
