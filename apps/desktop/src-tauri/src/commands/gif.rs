use crate::path_validator::{validate_path, validate_path_for_write};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const PREVIEW_WIDTH: u32 = 128;

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GifExportRequest {
    source_path: String,
    output_path: String,
    frame_rate: f64,
    scale_width: u32,
    start_time: f64,
    duration: f64,
    loop_count: u32,
    dither: GifDitherAlgorithm,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GifPreviewRequest {
    source_path: String,
    frame_rate: f64,
    start_time: f64,
    duration: f64,
    dither: GifDitherAlgorithm,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub enum GifDitherAlgorithm {
    #[serde(rename = "bayer")]
    Bayer,
    #[serde(rename = "floyd_steinberg")]
    FloydSteinberg,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GifWorkflowResult {
    output_path: String,
    full_args: Vec<String>,
    duration_ms: u128,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GifArgsOptions {
    frame_rate: f64,
    scale_width: u32,
    start_time: f64,
    duration: f64,
    loop_count: u32,
    dither: GifDitherAlgorithm,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn export_media_gif(
    app: AppHandle,
    request: GifExportRequest,
) -> Result<GifWorkflowResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_gif_export(app, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn generate_gif_preview(
    app: AppHandle,
    request: GifPreviewRequest,
) -> Result<GifWorkflowResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_gif_preview(app, request))
        .await
        .map_err(|error| error.to_string())?
}

fn run_gif_export(app: AppHandle, request: GifExportRequest) -> Result<GifWorkflowResult, String> {
    let source_path = validate_path(&app, Path::new(&request.source_path))?;
    let output_path = validate_path_for_write(&app, Path::new(&request.output_path))?;
    let options = GifArgsOptions {
        frame_rate: request.frame_rate,
        scale_width: request.scale_width,
        start_time: request.start_time,
        duration: request.duration,
        loop_count: request.loop_count,
        dither: request.dither,
    };
    run_gif_command(&source_path, &output_path, &options)
}

fn run_gif_preview(
    app: AppHandle,
    request: GifPreviewRequest,
) -> Result<GifWorkflowResult, String> {
    let source_path = validate_path(&app, Path::new(&request.source_path))?;
    let output_path = validate_path_for_write(&app, &build_preview_output_path(&app)?)?;
    let options = GifArgsOptions {
        frame_rate: request.frame_rate,
        scale_width: PREVIEW_WIDTH,
        start_time: request.start_time,
        duration: request.duration,
        loop_count: 0,
        dither: request.dither,
    };
    run_gif_command(&source_path, &output_path, &options)
}

fn run_gif_command(
    source_path: &Path,
    output_path: &Path,
    options: &GifArgsOptions,
) -> Result<GifWorkflowResult, String> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let input_arg = normalize_path(source_path);
    let output_arg = normalize_path(output_path);
    let args = build_gif_args(&input_arg, &output_arg, options);
    let started = Instant::now();
    let output = Command::new(ffmpeg_binary())
        .args(&args)
        .output()
        .map_err(|error| format!("Unable to start FFmpeg GIF export: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "FFmpeg GIF export failed.\n{}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(GifWorkflowResult {
        output_path: output_arg,
        full_args: args,
        duration_ms: started.elapsed().as_millis(),
    })
}

pub fn build_gif_args(
    input_path: &str,
    output_path: &str,
    options: &GifArgsOptions,
) -> Vec<String> {
    let frame_rate = clamp_frame_rate(options.frame_rate);
    let duration = clamp_duration(options.duration);
    let start_time = options.start_time.max(0.0);
    vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-ss".to_string(),
        format_seconds_arg(start_time),
        "-t".to_string(),
        format_seconds_arg(duration),
        "-i".to_string(),
        input_path.to_string(),
        "-filter_complex".to_string(),
        gif_filter_complex(frame_rate, options.scale_width, &options.dither),
        "-map".to_string(),
        "[gifout]".to_string(),
        "-an".to_string(),
        "-loop".to_string(),
        options.loop_count.to_string(),
        "-f".to_string(),
        "gif".to_string(),
        output_path.to_string(),
    ]
}

fn gif_filter_complex(frame_rate: f64, scale_width: u32, dither: &GifDitherAlgorithm) -> String {
    let safe_width = scale_width.clamp(16, 4096);
    format!(
        "[0:v]fps={},scale=w='min({},iw)':h=-2:flags=lanczos,split[gifsrc][gifpal];[gifpal]palettegen=stats_mode=diff[gifpalette];[gifsrc][gifpalette]paletteuse=dither={}:diff_mode=rectangle[gifout]",
        format_seconds_arg(frame_rate),
        safe_width,
        dither.as_ffmpeg_value()
    )
}

fn build_preview_output_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("gif-previews");
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    Ok(dir.join(format!("preview-{timestamp}.gif")))
}

impl GifDitherAlgorithm {
    fn as_ffmpeg_value(&self) -> &'static str {
        match self {
            GifDitherAlgorithm::Bayer => "bayer",
            GifDitherAlgorithm::FloydSteinberg => "floyd_steinberg",
        }
    }
}

fn clamp_frame_rate(value: f64) -> f64 {
    if value.is_finite() {
        value.clamp(1.0, 30.0)
    } else {
        12.0
    }
}

fn clamp_duration(value: f64) -> f64 {
    if value.is_finite() {
        value.max(0.1)
    } else {
        1.0
    }
}

fn format_seconds_arg(value: f64) -> String {
    let rounded = format!("{:.3}", value.max(0.0));
    rounded
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_string()
}

fn ffmpeg_binary() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(dither: GifDitherAlgorithm) -> GifArgsOptions {
        GifArgsOptions {
            frame_rate: 12.0,
            scale_width: 480,
            start_time: 1.25,
            duration: 2.5,
            loop_count: 0,
            dither,
        }
    }

    #[test]
    fn builds_gif_args_with_bayer_dither() {
        let args = build_gif_args(
            "C:/Media/source.mp4",
            "C:/Exports/source_animated.gif",
            &options(GifDitherAlgorithm::Bayer),
        );
        let command = args.join(" ");

        assert!(args.windows(2).any(|pair| pair == ["-ss", "1.25"]));
        assert!(args.windows(2).any(|pair| pair == ["-t", "2.5"]));
        assert!(command.contains("fps=12"));
        assert!(command.contains("scale=w='min(480,iw)':h=-2:flags=lanczos"));
        assert!(command.contains("paletteuse=dither=bayer:diff_mode=rectangle"));
        assert!(args.windows(2).any(|pair| pair == ["-loop", "0"]));
        assert_eq!(
            args.last().map(String::as_str),
            Some("C:/Exports/source_animated.gif")
        );
    }

    #[test]
    fn builds_gif_args_with_floyd_steinberg_dither() {
        let args = build_gif_args(
            "C:/Media/source.mp4",
            "C:/Exports/source_animated.gif",
            &options(GifDitherAlgorithm::FloydSteinberg),
        );

        assert!(args
            .join(" ")
            .contains("paletteuse=dither=floyd_steinberg:diff_mode=rectangle"));
    }

    #[test]
    fn clamps_gif_frame_rate_and_scale() {
        let args = build_gif_args(
            "C:/Media/source.mp4",
            "C:/Exports/source_animated.gif",
            &GifArgsOptions {
                frame_rate: 120.0,
                scale_width: 8,
                start_time: -1.0,
                duration: 0.0,
                loop_count: 3,
                dither: GifDitherAlgorithm::Bayer,
            },
        );
        let command = args.join(" ");

        assert!(args.windows(2).any(|pair| pair == ["-ss", "0"]));
        assert!(args.windows(2).any(|pair| pair == ["-t", "0.1"]));
        assert!(command.contains("fps=30"));
        assert!(command.contains("scale=w='min(16,iw)'"));
        assert!(args.windows(2).any(|pair| pair == ["-loop", "3"]));
    }

    #[test]
    fn builds_preview_args_with_128px_scale() {
        let args = build_gif_args(
            "C:/Media/source.mp4",
            "C:/App/gif-previews/preview.gif",
            &GifArgsOptions {
                scale_width: PREVIEW_WIDTH,
                ..options(GifDitherAlgorithm::FloydSteinberg)
            },
        );

        assert!(args
            .join(" ")
            .contains("scale=w='min(128,iw)':h=-2:flags=lanczos"));
    }
}
