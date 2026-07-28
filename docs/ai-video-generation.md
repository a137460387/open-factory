# AI Video Generation User Guide

## Overview

Open Factory integrates the LTX-Video model for local AI video generation. Generate videos from text prompts directly on your desktop — no cloud service required.

## Requirements

- **GPU**: NVIDIA GPU with CUDA support, minimum 4 GB VRAM (8 GB+ recommended)
- **Python**: Python 3.8+ installed and available in PATH
- **Disk Space**: ~10 GB for model weights
- **OS**: Windows 10/11, macOS 11+, or Linux (Ubuntu 20.04+)

## Getting Started

### Step 1: Check GPU Compatibility

Open Factory automatically detects your GPU on startup. Go to **File → AI Video Generation** to see your GPU status:

- **Green**: GPU detected and compatible (CUDA + PyTorch)
- **Yellow**: GPU detected via Vulkan but CUDA not available (limited functionality)
- **Red**: No compatible GPU found

### Step 2: Download the Model

1. Open the AI Video Generation panel
2. If no model is installed, click **Download** next to the "No model installed" warning
3. The model (~8 GB) will download from HuggingFace with resume support
4. Progress is shown in real-time

### Step 3: Generate a Video

1. Select a **preset** (Quick 480p, Standard 720p, or High Quality 1080p)
2. Enter a **prompt** describing the video you want
3. Optionally add a **negative prompt** to exclude unwanted elements
4. Click **Generate Video**

### Step 4: Use the Result

Once generation completes:
- **Preview**: The generated video plays in the panel
- **Import to Timeline**: Adds the video directly to your project timeline
- **Show in Explorer**: Opens the file location in your system file manager

## Presets

| Preset | Resolution | Duration | Steps | Best For |
|--------|-----------|----------|-------|----------|
| Quick 480p | 480p | ~0.7s (16 frames) | 25 | Quick previews, testing prompts |
| Standard 720p | 720p | ~1.3s (32 frames) | 50 | General use |
| High Quality 1080p | 1080p | ~2.7s (64 frames) | 75 | Final output (requires 8 GB+ VRAM) |

### Custom Presets

Click the **Save** button next to the preset selector to save your current settings as a custom preset.

### GPU Warnings

If you select "High Quality 1080p" with less than 8 GB VRAM, a warning will appear recommending the Standard preset for better stability.

## Advanced Settings

- **Inference Steps** (1-100): More steps = higher quality but slower generation
- **CFG Scale** (1-20): How closely the output follows the prompt. Higher values = more adherence
- **Seed**: Set a specific seed for reproducible results

## Troubleshooting

### "No model installed"

Download the model from the Model Manager. The model requires ~8 GB of disk space.

### "No compatible GPU"

- Ensure you have an NVIDIA GPU with CUDA support
- Update your GPU drivers to the latest version
- Install the CUDA toolkit if not already installed

### "Model directory exists but contains no model weights"

The model download may have been interrupted. Delete the model and re-download it.

### Generation fails with "CUDA out of memory"

- Close other GPU-intensive applications
- Use a lower resolution preset (480p or 720p)
- Reduce the number of inference steps

### Generation is very slow

- Use the Quick 480p preset for faster results
- Ensure no other applications are using the GPU
- Check that your GPU drivers are up to date

### Python not found

Ensure Python 3.8+ is installed and available in your system PATH:
```bash
python --version
```

## File Locations

| Item | Location |
|------|----------|
| Models | `<AppData>/open-factory/models/ltx-video/` |
| Generated videos | `<AppData>/open-factory/generated/` |
| Sidecar service | `<AppData>/open-factory/ltx-video-service/` |

## Privacy

All processing happens locally on your machine. No data is sent to external servers. The only network activity is downloading the model from HuggingFace (one-time).
