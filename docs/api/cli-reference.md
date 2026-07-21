# Open Factory CLI API Reference

## Commands

### `of render`

Render a project file to video using the headless FFmpeg pipeline.

```bash
of render -i <project-file> -o <output-file> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <path>` | Path to project file (.ofp/.json) | Required |
| `-o, --output <path>` | Output video file path | Required |
| `-f, --format <format>` | Output format (mp4\|webm\|mov) | `mp4` |
| `--width <pixels>` | Output width | `1920` |
| `--height <pixels>` | Output height | `1080` |
| `--fps <rate>` | Frame rate | `30` |
| `--bitrate <rate>` | Video bitrate | `8M` |
| `--audio-bitrate <rate>` | Audio bitrate | `192k` |
| `--range <start-end>` | Render range in seconds | Full timeline |
| `--ffmpeg <path>` | Path to ffmpeg binary | `ffmpeg` |
| `--concurrency <n>` | Max concurrent threads | `4` |

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 3 | FFmpeg not found |

---

### `of analyze`

Analyze video content and output structured reports.

```bash
of analyze -i <video-file> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <path>` | Path to video file | Required |
| `-t, --type <type>` | Analysis type | `quality` |
| `-p, --platform <name>` | Target platform for compliance | `youtube` |
| `--fail-on-low-score <n>` | Exit code 2 if score below threshold | Disabled |

**Analysis Types:**

- `quality` — Technical quality assessment (resolution, bitrate, loudness, codec)
- `semantic` — Scene detection and content analysis
- `compliance` — Platform-specific compliance checks
- `full` — All of the above combined

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Success / checks passed |
| 1 | General error |
| 2 | Quality score below threshold |

---

### `of apply-template`

Apply a template to source media files.

```bash
of apply-template -t <template> -m <media-files...> -o <output> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --template <path>` | Path to template file | Required |
| `-m, --media <files...>` | Source media files | Required |
| `-o, --output <path>` | Output project file path | Required |
| `--render` | Also render to video | `false` |
| `--render-output <path>` | Render output path | — |

---

### `of workflow run`

Execute a workflow definition file.

```bash
of workflow run -f <workflow-file> [--var key=value...]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --file <path>` | Path to workflow file | Required |
| `--var <pairs...>` | Override workflow variables | — |

---

### `of workflow validate`

Validate a workflow definition file.

```bash
of workflow validate -f <workflow-file>
```

---

## Output Format

All commands produce structured JSON output on stdout:

```json
{
  "success": true,
  "command": "render",
  "data": {
    "outputPath": "/path/to/output.mp4",
    "fileSize": 1048576,
    "duration": 45.2
  },
  "error": null,
  "warnings": [],
  "meta": {
    "timestamp": "2026-07-21T12:00:00.000Z",
    "duration": 45.2,
    "version": "0.1.0"
  }
}
```

Logs are written to stderr, making it safe to pipe stdout to other tools.

---

## TypeScript SDK

```typescript
import { HeadlessEditorCore, headlessRender, headlessAnalyze } from '@open-factory/editor-core/headless';

// Render a project
const result = await headlessRender({
  projectPath: './project.ofp',
  outputPath: './output.mp4',
  settings: { width: 1920, height: 1080, fps: 30 },
  onProgress: (p) => console.log(`${p.phase}: ${p.percent}%`),
});

// Analyze a video
const analysis = await headlessAnalyze({
  inputPath: './video.mp4',
  type: 'quality',
  format: 'json',
});
```
