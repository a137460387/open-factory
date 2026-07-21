# Open Factory Docker Usage

## Quick Start

```bash
# Build the base image
docker build -t open-factory -f docker/Dockerfile .

# Render a project file
docker run --rm -v $(pwd):/workspace open-factory render \
  -i /workspace/project.ofp \
  -o /workspace/output.mp4

# Analyze a video
docker run --rm -v $(pwd):/workspace open-factory analyze \
  -i /workspace/video.mp4 \
  -t full

# Apply a template
docker run --rm -v $(pwd):/workspace open-factory apply-template \
  -t /workspace/template.json \
  -m /workspace/media1.mp4 /workspace/media2.mp4 \
  -o /workspace/output-project.json

# Run a workflow
docker run --rm -v $(pwd):/workspace open-factory workflow run \
  -f /workspace/workflow.json
```

## GPU Support

For AI-powered features (scene detection, quality assessment, etc.):

```bash
# Build GPU image
docker build -t open-factory:gpu -f docker/Dockerfile.gpu .

# Run with GPU
docker run --rm --gpus all -v $(pwd):/workspace open-factory:gpu analyze \
  -i /workspace/video.mp4 \
  -t semantic
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Video Quality Check
on:
  push:
    paths: ['videos/**']

jobs:
  quality-check:
    runs-on: ubuntu-latest
    container:
      image: open-factory:latest
    steps:
      - uses: actions/checkout@v4
      - name: Analyze video quality
        run: |
          of analyze -i videos/output.mp4 -t quality --fail-on-low-score 80
```

### GitLab CI

```yaml
video-analysis:
  image: open-factory:latest
  script:
    - of analyze -i video.mp4 -t full
  artifacts:
    paths: [analysis-report.json]
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OF_FFMPEG_PATH` | Path to ffmpeg binary | `ffmpeg` |
| `OF_TEMP_DIR` | Temp directory | `/tmp/open-factory` |
| `OF_LOG_LEVEL` | Log level | `info` |
| `OF_CONCURRENCY` | Max render threads | `4` |
