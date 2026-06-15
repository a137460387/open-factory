use super::binaries::ffmpeg_binary;
use crate::path_validator::validate_path;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneDetectRequest {
    path: String,
    threshold: Option<f64>,
    duration: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneDetectionResult {
    scene_times: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SceneDetectProgressPayload {
    progress: f32,
    pts_time: Option<f64>,
}

#[tauri::command]
pub async fn detect_scene_changes(
    app: AppHandle,
    request: SceneDetectRequest,
) -> Result<SceneDetectionResult, String> {
    let safe_path = validate_path(&app, Path::new(&request.path))?;
    let threshold = request.threshold.unwrap_or(0.3).clamp(0.0, 1.0);
    let filter = format!("select='gt(scene,{threshold})',showinfo");
    let mut child = Command::new(ffmpeg_binary())
        .arg("-hide_banner")
        .arg("-i")
        .arg(normalize_path(&safe_path))
        .arg("-vf")
        .arg(filter)
        .arg("-an")
        .arg("-f")
        .arg("null")
        .arg("-")
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg scene detection: {}", error))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg scene detection output.".to_string())?;
    let reader = BufReader::new(stderr);
    let mut scene_times = Vec::<f64>::new();
    let duration = request.duration.unwrap_or(0.0);
    let _ = app.emit(
        "scene-detect-progress",
        SceneDetectProgressPayload {
            progress: 0.0,
            pts_time: None,
        },
    );

    for line in reader.lines().map_while(Result::ok) {
        for time in parse_showinfo_scene_times(&line) {
            push_unique_scene_time(&mut scene_times, time);
            let _ = app.emit(
                "scene-detect-progress",
                SceneDetectProgressPayload {
                    progress: calculate_progress(time, duration),
                    pts_time: Some(time),
                },
            );
        }
    }

    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        return Err(format!(
            "FFmpeg scene detection exited with status {}",
            status
        ));
    }

    scene_times.sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));
    let _ = app.emit(
        "scene-detect-progress",
        SceneDetectProgressPayload {
            progress: 1.0,
            pts_time: scene_times.last().copied(),
        },
    );
    Ok(SceneDetectionResult { scene_times })
}

pub(crate) fn parse_showinfo_scene_times(text: &str) -> Vec<f64> {
    text.lines()
        .filter_map(|line| {
            let marker = "pts_time:";
            let start = line.find(marker)? + marker.len();
            let value = line[start..].split_whitespace().next()?;
            value.parse::<f64>().ok()
        })
        .collect()
}

fn push_unique_scene_time(scene_times: &mut Vec<f64>, time: f64) {
    if !scene_times
        .iter()
        .any(|existing| (existing - time).abs() <= 0.001)
    {
        scene_times.push(time);
    }
}

fn calculate_progress(pts_time: f64, duration: f64) -> f32 {
    if !duration.is_finite() || duration <= 0.0 {
        return 0.0;
    }
    ((pts_time / duration) * 100.0).clamp(0.0, 100.0) as f32 / 100.0
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_showinfo_scene_pts_times() {
        let output = "\
[Parsed_showinfo_1 @ 000001] n:   0 pts: 15360 pts_time:1.000000 pos: 1234 fmt:yuv420p\n\
[Parsed_showinfo_1 @ 000001] color_range:unknown\n\
[Parsed_showinfo_1 @ 000001] n:   1 pts: 30720 pts_time:2.5 pos: 5678 fmt:yuv420p";

        assert_eq!(parse_showinfo_scene_times(output), vec![1.0, 2.5]);
    }

    #[test]
    fn progress_is_clamped() {
        assert_eq!(calculate_progress(0.5, 2.0), 0.25);
        assert_eq!(calculate_progress(3.0, 2.0), 1.0);
        assert_eq!(calculate_progress(1.0, 0.0), 0.0);
    }
}
