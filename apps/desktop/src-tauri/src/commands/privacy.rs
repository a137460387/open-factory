use crate::path_validator::validate_path;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Instant;
use tauri::AppHandle;

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrivacyDetectionRequest {
    model_path: String,
    media_path: String,
    clip_id: String,
    duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrivacyDetectionBox {
    time: f64,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    label: Option<String>,
    confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrivacyDetectionResult {
    clip_id: String,
    boxes: Vec<PrivacyDetectionBox>,
    duration_ms: u128,
}

#[tauri::command]
pub async fn detect_privacy_regions(
    app: AppHandle,
    request: PrivacyDetectionRequest,
) -> Result<PrivacyDetectionResult, String> {
    tauri::async_runtime::spawn_blocking(move || detect_privacy_regions_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

fn detect_privacy_regions_blocking(
    app: AppHandle,
    request: PrivacyDetectionRequest,
) -> Result<PrivacyDetectionResult, String> {
    validate_privacy_detection_request(&request)?;
    let model = validate_path(&app, Path::new(&request.model_path))?;
    let media = validate_path(&app, Path::new(&request.media_path))?;
    let started = Instant::now();
    let args = build_privacy_detection_args(&media, &model, request.duration);
    let mut child = Command::new(ffmpeg_binary())
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg privacy detection: {}", error))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg privacy detection output.".to_string())?;
    let mut boxes = Vec::new();
    let mut tail = Vec::<String>::new();
    for line in BufReader::new(stderr).lines().map_while(Result::ok) {
        if tail.len() >= 20 {
            tail.remove(0);
        }
        tail.push(line.clone());
        if let Some(detected) = parse_privacy_detection_line(&line) {
            boxes.push(detected);
        }
    }
    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        return Err(format!(
            "FFmpeg privacy detection exited with status {}.\n{}",
            status,
            tail.join("\n")
        ));
    }
    Ok(PrivacyDetectionResult {
        clip_id: request.clip_id,
        boxes,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn validate_privacy_detection_request(request: &PrivacyDetectionRequest) -> Result<(), String> {
    if request.model_path.trim().is_empty() {
        return Err("Privacy detection model path is not configured.".to_string());
    }
    if request.media_path.trim().is_empty() {
        return Err("Privacy detection media path is missing.".to_string());
    }
    if request.clip_id.trim().is_empty() {
        return Err("Privacy detection clip id is missing.".to_string());
    }
    Ok(())
}

fn build_privacy_detection_args(media: &Path, model: &Path, duration: Option<f64>) -> Vec<String> {
    let mut args = vec![
        "-hide_banner".to_string(),
        "-nostats".to_string(),
        "-i".to_string(),
        normalize_path(media),
        "-vf".to_string(),
        format!(
            "dnn_detect=dnn_backend=opencv:model={}:input=data:output=detection",
            normalize_path(model)
        ),
    ];
    if let Some(duration) = duration.filter(|value| value.is_finite() && *value > 0.0) {
        args.extend(["-t".to_string(), format!("{:.3}", duration)]);
    }
    args.extend(["-f".to_string(), "null".to_string(), "-".to_string()]);
    args
}

fn parse_privacy_detection_line(line: &str) -> Option<PrivacyDetectionBox> {
    let time = parse_number_after(line, "time=")?;
    let x = parse_number_after(line, "x=")?;
    let y = parse_number_after(line, "y=")?;
    let w = parse_number_after(line, "w=")?;
    let h = parse_number_after(line, "h=")?;
    Some(PrivacyDetectionBox {
        time,
        x: x.clamp(0.0, 1.0),
        y: y.clamp(0.0, 1.0),
        w: w.clamp(0.001, 1.0),
        h: h.clamp(0.001, 1.0),
        label: parse_string_after(line, "label="),
        confidence: parse_number_after(line, "confidence=").map(|value| value.clamp(0.0, 1.0)),
    })
}

fn parse_number_after(line: &str, key: &str) -> Option<f64> {
    let start = line.find(key)? + key.len();
    let tail = &line[start..];
    let end = tail
        .find(|ch: char| ch.is_whitespace() || ch == ',' || ch == ';')
        .unwrap_or(tail.len());
    tail[..end].trim().parse::<f64>().ok()
}

fn parse_string_after(line: &str, key: &str) -> Option<String> {
    let start = line.find(key)? + key.len();
    let tail = &line[start..];
    let end = tail
        .find(|ch: char| ch.is_whitespace() || ch == ',' || ch == ';')
        .unwrap_or(tail.len());
    let value = tail[..end].trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
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

    #[test]
    fn rejects_missing_model_path() {
        let request = PrivacyDetectionRequest {
            model_path: "".to_string(),
            media_path: "C:/Media/tiny-video.mp4".to_string(),
            clip_id: "clip-1".to_string(),
            duration: Some(2.0),
        };

        expect_error_contains(
            validate_privacy_detection_request(&request),
            "model path is not configured",
        );
    }

    #[test]
    fn builds_ffmpeg_dnn_detect_args() {
        let args = build_privacy_detection_args(
            Path::new("C:/Media/tiny-video.mp4"),
            Path::new("C:/Models/face.onnx"),
            Some(1.25),
        );

        assert!(args
            .windows(2)
            .any(|pair| pair[0] == "-i" && pair[1] == "C:/Media/tiny-video.mp4"));
        assert!(args.windows(2).any(|pair| pair[0] == "-vf" && pair[1].contains("dnn_detect=dnn_backend=opencv:model=C:/Models/face.onnx")));
        assert!(args.windows(2).any(|pair| pair[0] == "-t" && pair[1] == "1.250"));
        assert_eq!(args.last().map(String::as_str), Some("-"));
    }

    #[test]
    fn parses_detection_output_line() {
        let parsed = parse_privacy_detection_line("frame=1 time=0.5 x=0.2 y=0.3 w=0.4 h=0.5 label=face confidence=0.91").unwrap();

        assert_eq!(
            parsed,
            PrivacyDetectionBox {
                time: 0.5,
                x: 0.2,
                y: 0.3,
                w: 0.4,
                h: 0.5,
                label: Some("face".to_string()),
                confidence: Some(0.91)
            }
        );
    }

    fn expect_error_contains(result: Result<(), String>, needle: &str) {
        let error = result.expect_err("expected error");
        assert!(error.contains(needle), "expected `{}` to contain `{}`", error, needle);
    }
}
