use super::binaries::ffmpeg_binary;
use crate::path_validator::validate_path;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use tauri::{AppHandle, Emitter};

const DEFAULT_SCDET_THRESHOLD: f64 = 10.0;
const SCENE_DETECTION_MAX_SECONDS: f64 = 60.0 * 60.0;
const DEFAULT_PROGRESS_FPS: f64 = 30.0;

static SCENE_CANCEL_REQUESTS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneDetectRequest {
    path: String,
    threshold: Option<f64>,
    duration: Option<f64>,
    task_id: Option<String>,
    frame_rate: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneDetectionResult {
    scene_times: Vec<f64>,
    limited: bool,
    analyzed_duration: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SceneDetectProgressPayload {
    progress: f32,
    pts_time: Option<f64>,
    analyzed_frames: Option<u64>,
    total_frames: Option<u64>,
}

#[tauri::command]
pub async fn detect_scene_changes(
    app: AppHandle,
    request: SceneDetectRequest,
) -> Result<SceneDetectionResult, String> {
    let safe_path = validate_path(&app, Path::new(&request.path))?;
    let threshold = normalize_scdet_threshold(request.threshold);
    let (analyzed_duration, limited) = normalize_analysis_duration(request.duration);
    let frame_rate = normalize_frame_rate(request.frame_rate);
    let task_id = request
        .task_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| normalize_path(&safe_path));
    clear_scene_cancel_request(&task_id);

    let total_frames = estimate_total_frames(analyzed_duration, frame_rate);
    let _ = app.emit(
        "scene-detect-progress",
        SceneDetectProgressPayload {
            progress: 0.0,
            pts_time: None,
            analyzed_frames: Some(0),
            total_frames,
        },
    );

    let mut command = Command::new(ffmpeg_binary());
    command
        .arg("-hide_banner")
        .arg("-i")
        .arg(normalize_path(&safe_path));
    if analyzed_duration > 0.0 {
        command
            .arg("-t")
            .arg(format_duration_arg(analyzed_duration));
    }
    command
        .arg("-vf")
        .arg(build_scene_detection_filter(threshold))
        .arg("-an")
        .arg("-f")
        .arg("null")
        .arg("-")
        .stderr(Stdio::piped())
        .stdout(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg scene detection: {}", error))?;

    let stdout_handle = child.stdout.take().map(|stdout| {
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            let mut scene_times = Vec::<f64>::new();
            for line in reader.lines().map_while(Result::ok) {
                for time in parse_scdet_scene_times(&line) {
                    push_unique_scene_time(&mut scene_times, time);
                }
            }
            scene_times
        })
    });

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg scene detection output.".to_string())?;
    let reader = BufReader::new(stderr);
    let mut scene_times = Vec::<f64>::new();

    for line in reader.lines().map_while(Result::ok) {
        for time in parse_scdet_scene_times(&line) {
            push_unique_scene_time(&mut scene_times, time);
            let _ = app.emit(
                "scene-detect-progress",
                progress_payload(Some(time), None, analyzed_duration, frame_rate),
            );
        }
        if let Some((time, frame)) = parse_progress_line(&line) {
            let _ = app.emit(
                "scene-detect-progress",
                progress_payload(time, frame, analyzed_duration, frame_rate),
            );
        }
        if is_scene_detection_canceled(&task_id) {
            let _ = child.kill();
            let _ = child.wait();
            clear_scene_cancel_request(&task_id);
            return Err("Scene detection canceled.".to_string());
        }
    }

    let status = child.wait().map_err(|error| error.to_string())?;
    if let Some(handle) = stdout_handle {
        for time in handle
            .join()
            .map_err(|_| "Unable to join FFmpeg scene detection output reader.".to_string())?
        {
            push_unique_scene_time(&mut scene_times, time);
        }
    }
    clear_scene_cancel_request(&task_id);
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
            analyzed_frames: total_frames,
            total_frames,
        },
    );
    Ok(SceneDetectionResult {
        scene_times,
        limited,
        analyzed_duration,
    })
}

#[tauri::command]
pub async fn cancel_scene_detection(task_id: String) -> Result<(), String> {
    if task_id.trim().is_empty() {
        return Err("Scene detection task id is required.".to_string());
    }
    cancel_requests()
        .lock()
        .map_err(|_| "Unable to lock scene detection cancel registry.".to_string())?
        .insert(task_id);
    Ok(())
}

pub(crate) fn build_scdet_filter_arg(threshold: f64) -> String {
    format!(
        "scdet=threshold={}",
        format_filter_number(normalize_scdet_threshold(Some(threshold)))
    )
}

pub(crate) fn build_scene_detection_filter(threshold: f64) -> String {
    format!(
        "{},metadata=print:key=lavfi.scd.time:file=-",
        build_scdet_filter_arg(threshold)
    )
}

pub(crate) fn normalize_scdet_threshold(threshold: Option<f64>) -> f64 {
    threshold
        .filter(|value| value.is_finite())
        .unwrap_or(DEFAULT_SCDET_THRESHOLD)
        .clamp(0.0, 100.0)
}

pub(crate) fn normalize_analysis_duration(duration: Option<f64>) -> (f64, bool) {
    let value = normalize_duration(duration).unwrap_or(0.0);
    (
        value.min(SCENE_DETECTION_MAX_SECONDS),
        value > SCENE_DETECTION_MAX_SECONDS,
    )
}

pub(crate) fn parse_scdet_scene_times(text: &str) -> Vec<f64> {
    let mut scene_times = Vec::new();
    for time in text.lines().flat_map(|line| {
        parse_marker_value(line, "lavfi.scd.time=")
            .or_else(|| parse_marker_value(line, "lavfi.scd.time:"))
            .or_else(|| parse_marker_value(line, "pts_time:"))
    }) {
        push_unique_scene_time(&mut scene_times, time);
    }
    scene_times
}

fn parse_marker_value(line: &str, marker: &str) -> Option<f64> {
    let start = line.find(marker)? + marker.len();
    let value = line[start..]
        .trim_start()
        .split(|character: char| character.is_whitespace() || character == ',')
        .next()?;
    value.parse::<f64>().ok()
}

fn push_unique_scene_time(scene_times: &mut Vec<f64>, time: f64) {
    if !scene_times
        .iter()
        .any(|existing| (existing - time).abs() <= 0.001)
    {
        scene_times.push(time);
    }
}

fn parse_progress_line(line: &str) -> Option<(Option<f64>, Option<u64>)> {
    let time = parse_ffmpeg_status_time(line).or_else(|| parse_progress_out_time_ms(line));
    let frame = parse_progress_frame(line);
    if time.is_some() || frame.is_some() {
        Some((time, frame))
    } else {
        None
    }
}

fn parse_ffmpeg_status_time(line: &str) -> Option<f64> {
    let marker = "time=";
    let start = line.find(marker)? + marker.len();
    let value = line[start..].split_whitespace().next()?;
    parse_hms_time(value)
}

fn parse_progress_out_time_ms(line: &str) -> Option<f64> {
    let marker = "out_time_ms=";
    let start = line.find(marker)? + marker.len();
    let raw = line[start..]
        .split_whitespace()
        .next()?
        .parse::<f64>()
        .ok()?;
    Some((raw / 1_000_000.0).max(0.0))
}

fn parse_progress_frame(line: &str) -> Option<u64> {
    let marker = "frame=";
    let start = line.find(marker)? + marker.len();
    line[start..]
        .split_whitespace()
        .next()?
        .parse::<u64>()
        .ok()
}

fn progress_payload(
    pts_time: Option<f64>,
    frame: Option<u64>,
    duration: f64,
    frame_rate: f64,
) -> SceneDetectProgressPayload {
    let total_frames = estimate_total_frames(duration, frame_rate);
    let analyzed_frames = frame.or_else(|| {
        pts_time.map(|time| {
            let bounded = if duration > 0.0 {
                time.min(duration)
            } else {
                time
            };
            (bounded.max(0.0) * frame_rate).round() as u64
        })
    });
    SceneDetectProgressPayload {
        progress: calculate_progress(pts_time.unwrap_or(0.0), duration),
        pts_time,
        analyzed_frames,
        total_frames,
    }
}

fn calculate_progress(pts_time: f64, duration: f64) -> f32 {
    if !duration.is_finite() || duration <= 0.0 {
        return 0.0;
    }
    ((pts_time / duration) * 100.0).clamp(0.0, 100.0) as f32 / 100.0
}

fn estimate_total_frames(duration: f64, frame_rate: f64) -> Option<u64> {
    if duration.is_finite() && duration > 0.0 && frame_rate.is_finite() && frame_rate > 0.0 {
        Some((duration * frame_rate).ceil() as u64)
    } else {
        None
    }
}

fn normalize_duration(duration: Option<f64>) -> Option<f64> {
    duration.filter(|value| value.is_finite() && *value > 0.0)
}

fn normalize_frame_rate(frame_rate: Option<f64>) -> f64 {
    frame_rate
        .filter(|value| value.is_finite() && *value > 0.0)
        .unwrap_or(DEFAULT_PROGRESS_FPS)
}

fn parse_hms_time(value: &str) -> Option<f64> {
    let parts = value.split(':').collect::<Vec<_>>();
    if parts.len() != 3 {
        return None;
    }
    let hours = parts[0].parse::<f64>().ok()?;
    let minutes = parts[1].parse::<f64>().ok()?;
    let seconds = parts[2].parse::<f64>().ok()?;
    Some((hours * 3600.0 + minutes * 60.0 + seconds).max(0.0))
}

fn format_duration_arg(duration: f64) -> String {
    format_filter_number(duration)
}

fn format_filter_number(value: f64) -> String {
    if (value.round() - value).abs() <= f64::EPSILON {
        format!("{}", value.round() as i64)
    } else {
        let formatted = format!("{:.6}", value);
        formatted
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    }
}

fn cancel_requests() -> &'static Mutex<HashSet<String>> {
    SCENE_CANCEL_REQUESTS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn is_scene_detection_canceled(task_id: &str) -> bool {
    cancel_requests()
        .lock()
        .map(|requests| requests.contains(task_id))
        .unwrap_or(false)
}

fn clear_scene_cancel_request(task_id: &str) {
    if let Ok(mut requests) = cancel_requests().lock() {
        requests.remove(task_id);
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_scdet_filter_args_with_threshold_mapping() {
        assert_eq!(normalize_scdet_threshold(None), 10.0);
        assert_eq!(normalize_scdet_threshold(Some(-5.0)), 0.0);
        assert_eq!(normalize_scdet_threshold(Some(120.0)), 100.0);
        assert_eq!(build_scdet_filter_arg(12.5), "scdet=threshold=12.5");
        assert_eq!(
            build_scene_detection_filter(10.0),
            "scdet=threshold=10,metadata=print:key=lavfi.scd.time:file=-"
        );
    }

    #[test]
    fn parses_scdet_metadata_scene_times() {
        let output = "\
frame:1 pts:15360 pts_time:1.000000\n\
lavfi.scd.time=1.000000\n\
lavfi.scd.score=18.5\n\
lavfi.scd.time: 2.5\n\
[Parsed_showinfo_1 @ 000001] n: 2 pts_time:3.25";

        assert_eq!(parse_scdet_scene_times(output), vec![1.0, 2.5, 3.25]);
    }

    #[test]
    fn progress_payload_reports_analyzed_frames() {
        assert_eq!(
            progress_payload(Some(1.0), None, 4.0, 24.0),
            SceneDetectProgressPayload {
                progress: 0.25,
                pts_time: Some(1.0),
                analyzed_frames: Some(24),
                total_frames: Some(96)
            }
        );
        assert_eq!(calculate_progress(3.0, 2.0), 1.0);
        assert_eq!(calculate_progress(1.0, 0.0), 0.0);
    }

    #[test]
    fn parses_ffmpeg_progress_status() {
        assert_eq!(
            parse_progress_line(
                "frame=  120 fps=0.0 q=-0.0 size=N/A time=00:00:04.00 bitrate=N/A speed=8x"
            ),
            Some((Some(4.0), Some(120)))
        );
        assert_eq!(
            parse_progress_line("out_time_ms=2500000"),
            Some((Some(2.5), None))
        );
    }

    #[test]
    fn limits_long_analysis_duration() {
        assert_eq!(normalize_analysis_duration(Some(120.0)), (120.0, false));
        assert_eq!(normalize_analysis_duration(Some(3700.0)), (3600.0, true));
    }
}
