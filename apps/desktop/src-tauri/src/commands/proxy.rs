use crate::path_validator::{validate_path, validate_path_for_write};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Instant;
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyPlanDto {
    asset_id: String,
    input_path: String,
    output_path: String,
    width: u32,
    height: u32,
    video_bitrate: String,
    reason: String,
    cfr_frame_rate: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResult {
    asset_id: String,
    proxy_path: String,
    duration_ms: u128,
}

#[tauri::command]
pub async fn generate_proxy(app: AppHandle, plan: ProxyPlanDto) -> Result<ProxyResult, String> {
    let input_path = validate_path(&app, Path::new(&plan.input_path))?;
    let output_path = validate_path_for_write(&app, Path::new(&plan.output_path))?;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let started = Instant::now();
    let input_arg = normalize_path(&input_path);
    let output_arg = normalize_path(&output_path);
    let filter = build_proxy_video_filter(plan.width, plan.height, plan.cfr_frame_rate);
    let status = Command::new(if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    })
    .args([
        "-y",
        "-i",
        &input_arg,
        "-vf",
        &filter,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-b:v",
        &plan.video_bitrate,
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        &output_arg,
    ])
    .stderr(Stdio::piped())
    .stdout(Stdio::null())
    .status()
    .map_err(|error| format!("Unable to run FFmpeg proxy generation: {}", error))?;
    if !status.success() {
        return Err(format!(
            "Proxy generation failed for {} with status {}",
            plan.reason, status
        ));
    }
    Ok(ProxyResult {
        asset_id: plan.asset_id,
        proxy_path: output_arg,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn build_proxy_video_filter(width: u32, height: u32, cfr_frame_rate: Option<f64>) -> String {
    let scale = format!(
        "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2",
        width, height, width, height
    );
    match cfr_frame_rate.filter(|value| value.is_finite() && *value > 0.0) {
        Some(frame_rate) => format!("fps={},{}", trim_float(frame_rate), scale),
        None => scale,
    }
}

fn trim_float(value: f64) -> String {
    let rounded = (value * 1000.0).round() / 1000.0;
    let mut text = format!("{rounded:.3}");
    while text.contains('.') && text.ends_with('0') {
        text.pop();
    }
    if text.ends_with('.') {
        text.pop();
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_proxy_filter_with_optional_cfr_fps() {
        assert_eq!(
            build_proxy_video_filter(1280, 720, None),
            "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2"
        );
        assert_eq!(
            build_proxy_video_filter(1280, 720, Some(29.97003)),
            "fps=29.97,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2"
        );
    }
}
