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
    source_start: Option<f64>,
    source_duration: Option<f64>,
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
    let args = build_proxy_args(&plan, &input_arg, &filter, &output_arg);
    let status = Command::new(if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    })
    .args(&args)
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

fn build_proxy_args(
    plan: &ProxyPlanDto,
    input_arg: &str,
    filter: &str,
    output_arg: &str,
) -> Vec<String> {
    let mut args = vec!["-y".to_string()];
    if let Some(source_start) = valid_segment_value(plan.source_start) {
        args.push("-ss".to_string());
        args.push(trim_float(source_start));
    }
    if let Some(source_duration) = valid_segment_value(plan.source_duration) {
        args.push("-t".to_string());
        args.push(trim_float(source_duration));
    }
    args.extend([
        "-i".to_string(),
        input_arg.to_string(),
        "-vf".to_string(),
        filter.to_string(),
        "-an".to_string(),
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "veryfast".to_string(),
        "-b:v".to_string(),
        plan.video_bitrate.clone(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        output_arg.to_string(),
    ]);
    args
}

fn valid_segment_value(value: Option<f64>) -> Option<f64> {
    value.filter(|item| item.is_finite() && *item > 0.0)
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
        assert_eq!(
            build_proxy_video_filter(1280, 720, Some(30.0)),
            "fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2"
        );
    }

    #[test]
    fn builds_incremental_proxy_args_with_source_segment() {
        let plan = ProxyPlanDto {
            asset_id: "asset".to_string(),
            input_path: "C:/Media/source.mp4".to_string(),
            output_path: "C:/Proxy/source.mp4".to_string(),
            width: 1280,
            height: 720,
            video_bitrate: "2500k".to_string(),
            reason: "manual".to_string(),
            cfr_frame_rate: None,
            source_start: Some(12.3456),
            source_duration: Some(4.2),
        };
        let args = build_proxy_args(
            &plan,
            "C:/Media/source.mp4",
            "scale=1280:720",
            "C:/Proxy/source.mp4",
        );

        assert_eq!(
            &args[0..7],
            [
                "-y",
                "-ss",
                "12.346",
                "-t",
                "4.2",
                "-i",
                "C:/Media/source.mp4"
            ]
        );
    }
}
