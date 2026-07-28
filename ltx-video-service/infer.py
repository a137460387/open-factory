#!/usr/bin/env python3
"""
LTX-Video Inference Service

Communicates with the Tauri Rust backend via stdin/stdout using JSON lines protocol.
Supports txt2vid and img2vid modes.

Usage:
    python infer.py --model-path /path/to/model --task-id ltx-123

Protocol:
    - Input (stdin): JSON lines with commands (generate, cancel, shutdown)
    - Output (stdout): JSON lines with messages (progress, completed, error, ready)
"""

import argparse
import json
import os
import sys
import time
import threading
from pathlib import Path
from typing import Optional

# Global state
_model = None
_device = "cuda"
_cancel_event = threading.Event()


def send_message(msg_type: str, **kwargs):
    """Send a JSON message to stdout for the Rust sidecar to read."""
    msg = {"type": msg_type, **kwargs}
    print(json.dumps(msg), flush=True)


def send_progress(progress: float, stage: str):
    """Send a progress update."""
    send_message("progress", progress=round(progress, 4), stage=stage)


def send_completed(video_path: str):
    """Send completion message."""
    send_message("completed", video_path=video_path)


def send_error(message: str):
    """Send error message."""
    send_message("error", message=message)


def send_ready():
    """Send ready signal."""
    send_message("ready")


def log_stderr(message: str):
    """Log a message to stderr (for debugging, not parsed by Rust)."""
    print(message, file=sys.stderr, flush=True)


def load_model(model_path: str, device: str = "cuda"):
    """Load the LTX-Video model."""
    global _model, _device
    _device = device

    try:
        import torch
        from diffusers import LTXPipeline

        if not torch.cuda.is_available():
            log_stderr("WARNING: CUDA not available, falling back to CPU (will be slow)")
            _device = "cpu"

        log_stderr(f"Loading LTX-Video model from {model_path} on {_device}...")

        # Try to load from local path first, then from HuggingFace hub
        model_path_obj = Path(model_path)
        if model_path_obj.exists() and any(model_path_obj.glob("*.safetensors")):
            _model = LTXPipeline.from_pretrained(
                model_path,
                torch_dtype=torch.float16 if _device == "cuda" else torch.float32,
                variant="fp16" if _device == "cuda" else None,
            )
        else:
            # Try loading from HuggingFace hub
            _model = LTXPipeline.from_pretrained(
                "Lightricks/LTX-Video",
                torch_dtype=torch.float16 if _device == "cuda" else torch.float32,
                variant="fp16" if _device == "cuda" else None,
                cache_dir=model_path,
            )

        _model = _model.to(_device)

        # Enable memory optimizations
        if _device == "cuda":
            try:
                _model.enable_model_cpu_offload()
            except Exception:
                pass
            try:
                _model.enable_vae_slicing()
            except Exception:
                pass

        log_stderr("Model loaded successfully")
        return True

    except ImportError as e:
        send_error(f"Missing dependency: {e}. Please install requirements.")
        return False
    except Exception as e:
        send_error(f"Failed to load model: {e}")
        return False


def generate_video(
    prompt: str,
    negative_prompt: Optional[str] = None,
    image_path: Optional[str] = None,
    num_frames: int = 97,
    resolution: int = 720,
    fps: int = 24,
    steps: int = 50,
    cfg_scale: float = 7.5,
    seed: Optional[int] = None,
    output_path: str = "output.mp4",
):
    """Generate a video from text or image prompt."""
    global _model

    if _model is None:
        send_error("Model not loaded")
        return

    _cancel_event.clear()

    try:
        import torch
        from PIL import Image

        send_progress(0.05, "preparing")

        # Set up generator for reproducibility
        generator = None
        if seed is not None:
            generator = torch.Generator(device=_device).manual_seed(seed)

        # Load input image if provided (img2vid mode)
        init_image = None
        if image_path and os.path.exists(image_path):
            send_progress(0.1, "loading_image")
            init_image = Image.open(image_path).convert("RGB")
            # Resize to target resolution
            aspect = init_image.width / init_image.height
            target_h = resolution
            target_w = int(target_h * aspect)
            # Ensure dimensions are divisible by 8
            target_w = (target_w // 8) * 8
            target_h = (target_h // 8) * 8
            init_image = init_image.resize((target_w, target_h), Image.LANCZOS)

        if _cancel_event.is_set():
            send_error("Generation canceled")
            return

        send_progress(0.15, "generating")

        # Calculate video dimensions
        # LTX-Video typically uses 16:9 or 9:16 aspect ratios
        height = resolution
        width = int(resolution * 16 / 9)
        # Ensure divisible by 32 for the model
        width = (width // 32) * 32
        height = (height // 32) * 32

        # Create a callback for progress tracking
        def progress_callback(step, timestep, latents):
            if _cancel_event.is_set():
                raise RuntimeError("Generation canceled by user")
            progress = 0.15 + (step / steps) * 0.75
            stage = "denoising" if step < steps * 0.8 else "decoding"
            send_progress(progress, stage)

        # Generate video
        if init_image is not None:
            # img2vid mode
            result = _model(
                prompt=prompt,
                negative_prompt=negative_prompt or "",
                image=init_image,
                num_frames=num_frames,
                height=height,
                width=width,
                num_inference_steps=steps,
                guidance_scale=cfg_scale,
                generator=generator,
                callback_on_step_end=progress_callback,
            )
        else:
            # txt2vid mode
            result = _model(
                prompt=prompt,
                negative_prompt=negative_prompt or "",
                num_frames=num_frames,
                height=height,
                width=width,
                num_inference_steps=steps,
                guidance_scale=cfg_scale,
                generator=generator,
                callback_on_step_end=progress_callback,
            )

        if _cancel_event.is_set():
            send_error("Generation canceled")
            return

        send_progress(0.9, "saving_video")

        # Save video
        frames = result.frames[0]
        save_video(frames, output_path, fps)

        send_progress(1.0, "completed")
        send_completed(output_path)

    except RuntimeError as e:
        if "canceled" in str(e).lower():
            send_error("Generation canceled")
        else:
            send_error(f"Runtime error: {e}")
    except Exception as e:
        send_error(f"Generation failed: {e}")


def save_video(frames, output_path: str, fps: int = 24):
    """Save PIL Image frames as a video file."""
    try:
        import imageio
        import numpy as np

        # Convert PIL images to numpy arrays
        np_frames = [np.array(f) for f in frames]

        # Save using imageio
        writer = imageio.get_writer(
            output_path,
            fps=fps,
            codec="libx264",
            quality=8,
            pixelformat="yuv420p",
        )
        for frame in np_frames:
            writer.append_data(frame)
        writer.close()

        log_stderr(f"Video saved to {output_path}")

    except ImportError:
        # Fallback: save as individual frames and use ffmpeg
        send_error("imageio not available, cannot save video")
    except Exception as e:
        send_error(f"Failed to save video: {e}")


def handle_command(cmd: dict):
    """Handle an incoming command from stdin."""
    cmd_type = cmd.get("type")

    if cmd_type == "generate":
        # Extract parameters
        prompt = cmd.get("prompt", "")
        negative_prompt = cmd.get("negative_prompt")
        image_path = cmd.get("image_path")
        num_frames = cmd.get("num_frames", 97)
        resolution = cmd.get("resolution", 720)
        fps = cmd.get("fps", 24)
        steps = cmd.get("steps", 50)
        cfg_scale = cmd.get("cfg_scale", 7.5)
        seed = cmd.get("seed")
        output_path = cmd.get("output_path", "output.mp4")

        generate_video(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image_path=image_path,
            num_frames=num_frames,
            resolution=resolution,
            fps=fps,
            steps=steps,
            cfg_scale=cfg_scale,
            seed=seed,
            output_path=output_path,
        )

    elif cmd_type == "cancel":
        _cancel_event.set()
        log_stderr("Cancel signal received")

    elif cmd_type == "shutdown":
        log_stderr("Shutdown signal received")
        sys.exit(0)

    else:
        send_error(f"Unknown command type: {cmd_type}")


def main():
    parser = argparse.ArgumentParser(description="LTX-Video Inference Service")
    parser.add_argument(
        "--model-path",
        type=str,
        required=True,
        help="Path to the LTX-Video model directory",
    )
    parser.add_argument(
        "--task-id",
        type=str,
        default="unknown",
        help="Task ID for this session",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="cuda",
        choices=["cuda", "cpu"],
        help="Device to use for inference",
    )
    args = parser.parse_args()

    log_stderr(f"LTX-Video service starting, task_id={args.task_id}")

    # Load model
    if not load_model(args.model_path, args.device):
        send_error("Failed to load model")
        sys.exit(1)

    # Signal ready
    send_ready()

    # Read commands from stdin
    log_stderr("Ready to receive commands")
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                cmd = json.loads(line)
                handle_command(cmd)
            except json.JSONDecodeError as e:
                send_error(f"Invalid JSON command: {e}")
            except Exception as e:
                send_error(f"Command handling error: {e}")

    except KeyboardInterrupt:
        log_stderr("Interrupted")
    except EOFError:
        log_stderr("EOF reached")

    log_stderr("Service shutting down")


if __name__ == "__main__":
    main()
