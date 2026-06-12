use crate::path_validator::{validate_path, validate_path_for_write};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

static TRANSCODE_CHILDREN: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
static CANCELED_TRANSCODE_TASKS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn transcode_children() -> &'static Mutex<HashMap<String, Child>> {
    TRANSCODE_CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
}

fn canceled_transcode_tasks() -> &'static Mutex<HashSet<String>> {
    CANCELED_TRANSCODE_TASKS.get_or_init(|| Mutex::new(HashSet::new()))
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatchTranscodeRequest {
    tasks: Vec<BatchTranscodeTaskRequest>,
    preset: TranscodePreset,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatchTranscodeTaskRequest {
    task_id: String,
    source_path: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub enum TranscodePreset {
    #[serde(rename = "h264-720p")]
    H264720p,
    #[serde(rename = "h264-1080p")]
    H2641080p,
    #[serde(rename = "prores-proxy")]
    ProResProxy,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatchTranscodeProgressPayload {
    task_id: String,
    source_path: String,
    output_path: Option<String>,
    status: String,
    progress: f32,
    progress_pct: f32,
    current: usize,
    total: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatchTranscodeTaskResult {
    task_id: String,
    source_path: String,
    output_path: Option<String>,
    status: String,
    error: Option<String>,
    duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatchTranscodeResponse {
    results: Vec<BatchTranscodeTaskResult>,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn batch_transcode_media(
    app: AppHandle,
    request: BatchTranscodeRequest,
) -> Result<BatchTranscodeResponse, String> {
    tauri::async_runtime::spawn_blocking(move || run_batch_transcode(app, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub fn cancel_batch_transcode_task(task_id: String) -> Result<(), String> {
    canceled_transcode_tasks()
        .lock()
        .map_err(|_| "Unable to lock transcode cancellation set".to_string())?
        .insert(task_id.clone());
    if let Some(mut child) = transcode_children()
        .lock()
        .map_err(|_| "Unable to lock transcode processes".to_string())?
        .remove(&task_id)
    {
        child.kill().map_err(|error| error.to_string())?;
        let _ = child.wait();
    }
    Ok(())
}

fn run_batch_transcode(
    app: AppHandle,
    request: BatchTranscodeRequest,
) -> Result<BatchTranscodeResponse, String> {
    let total = request.tasks.len();
    let mut results = Vec::with_capacity(total);
    for (index, task) in request.tasks.into_iter().enumerate() {
        let current = index + 1;
        if is_task_canceled(&task.task_id) {
            emit_progress(
                &app,
                &task,
                None,
                "canceled",
                0.0,
                current,
                total,
            );
            remove_cancellation(&task.task_id);
            results.push(BatchTranscodeTaskResult {
                task_id: task.task_id,
                source_path: task.source_path,
                output_path: None,
                status: "canceled".to_string(),
                error: None,
                duration_ms: 0,
            });
            continue;
        }

        let result = run_transcode_task(&app, &task, &request.preset, current, total);
        if result.status != "canceled" {
            remove_cancellation(&task.task_id);
        }
        results.push(result);
    }
    Ok(BatchTranscodeResponse { results })
}

fn run_transcode_task(
    app: &AppHandle,
    task: &BatchTranscodeTaskRequest,
    preset: &TranscodePreset,
    current: usize,
    total: usize,
) -> BatchTranscodeTaskResult {
    let started = Instant::now();
    let source_path = match validate_path(app, Path::new(&task.source_path)) {
        Ok(path) => path,
        Err(error) => {
            emit_progress(app, task, None, "failed", 0.0, current, total);
            return task_result(task, None, "failed", Some(error), started);
        }
    };
    let output_path = match build_transcode_output_path(app, &source_path, preset, current) {
        Ok(path) => path,
        Err(error) => {
            emit_progress(app, task, None, "failed", 0.0, current, total);
            return task_result(task, None, "failed", Some(error), started);
        }
    };
    let safe_output = match validate_path_for_write(app, &output_path) {
        Ok(path) => path,
        Err(error) => {
            emit_progress(app, task, None, "failed", 0.0, current, total);
            return task_result(task, None, "failed", Some(error), started);
        }
    };
    if let Some(parent) = safe_output.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            emit_progress(app, task, None, "failed", 0.0, current, total);
            return task_result(task, None, "failed", Some(error.to_string()), started);
        }
    }

    let source_arg = normalize_path(&source_path);
    let output_arg = normalize_path(&safe_output);
    let expected_duration_us = ffprobe_duration_us(&source_path).unwrap_or(0);
    let args = build_transcode_args(&source_arg, &output_arg, preset);
    emit_progress(
        app,
        task,
        Some(output_arg.clone()),
        "running",
        0.0,
        current,
        total,
    );

    let mut child = match Command::new(ffmpeg_binary())
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            emit_progress(
                app,
                task,
                Some(output_arg.clone()),
                "failed",
                0.0,
                current,
                total,
            );
            return task_result(
                task,
                Some(output_arg),
                "failed",
                Some(format!("Unable to start FFmpeg transcode: {error}")),
                started,
            );
        }
    };

    let stdout = match child.stdout.take() {
        Some(stdout) => stdout,
        None => {
            emit_progress(
                app,
                task,
                Some(output_arg.clone()),
                "failed",
                0.0,
                current,
                total,
            );
            return task_result(
                task,
                Some(output_arg),
                "failed",
                Some("Unable to capture FFmpeg progress output.".to_string()),
                started,
            );
        }
    };
    let stderr_tail = Arc::new(Mutex::new(Vec::<String>::new()));
    if let Some(stderr) = child.stderr.take() {
        let tail = Arc::clone(&stderr_tail);
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if let Ok(mut guard) = tail.lock() {
                    if guard.len() >= 20 {
                        guard.remove(0);
                    }
                    guard.push(line);
                }
            }
        });
    }
    if let Err(error) = transcode_children()
        .lock()
        .map_err(|_| "Unable to lock transcode processes".to_string())
        .and_then(|mut children| {
            children.insert(task.task_id.clone(), child);
            Ok(())
        })
    {
        emit_progress(
            app,
            task,
            Some(output_arg.clone()),
            "failed",
            0.0,
            current,
            total,
        );
        return task_result(task, Some(output_arg), "failed", Some(error), started);
    }

    let reader = BufReader::new(stdout);
    for line in reader.lines().map_while(Result::ok) {
        if let Some(out_time_us) = parse_out_time_us(&line) {
            emit_progress(
                app,
                task,
                Some(output_arg.clone()),
                "running",
                progress_from_out_time(out_time_us, expected_duration_us),
                current,
                total,
            );
        }
    }

    let maybe_child = transcode_children()
        .lock()
        .ok()
        .and_then(|mut children| children.remove(&task.task_id));
    if is_task_canceled(&task.task_id) || maybe_child.is_none() {
        emit_progress(
            app,
            task,
            Some(output_arg.clone()),
            "canceled",
            0.0,
            current,
            total,
        );
        return task_result(task, Some(output_arg), "canceled", None, started);
    }

    let mut child = maybe_child.expect("checked above");
    match child.wait() {
        Ok(status) if status.success() => {
            emit_progress(
                app,
                task,
                Some(output_arg.clone()),
                "completed",
                1.0,
                current,
                total,
            );
            task_result(task, Some(output_arg), "completed", None, started)
        }
        Ok(status) => {
            let tail = stderr_tail
                .lock()
                .map(|tail| tail.join("\n"))
                .unwrap_or_default();
            emit_progress(
                app,
                task,
                Some(output_arg.clone()),
                "failed",
                0.0,
                current,
                total,
            );
            task_result(
                task,
                Some(output_arg),
                "failed",
                Some(format!("FFmpeg transcode failed with status {status}.\n{tail}")),
                started,
            )
        }
        Err(error) => {
            emit_progress(
                app,
                task,
                Some(output_arg.clone()),
                "failed",
                0.0,
                current,
                total,
            );
            task_result(task, Some(output_arg), "failed", Some(error.to_string()), started)
        }
    }
}

pub fn build_transcode_args(
    input_path: &str,
    output_path: &str,
    preset: &TranscodePreset,
) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-i".to_string(),
        input_path.to_string(),
        "-map".to_string(),
        "0:v:0".to_string(),
        "-map".to_string(),
        "0:a:0?".to_string(),
        "-vf".to_string(),
    ];
    match preset {
        TranscodePreset::H264720p => {
            args.extend([
                scale_limit_filter(1280, 720),
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                "veryfast".to_string(),
                "-crf".to_string(),
                "23".to_string(),
                "-pix_fmt".to_string(),
                "yuv420p".to_string(),
                "-c:a".to_string(),
                "aac".to_string(),
                "-b:a".to_string(),
                "160k".to_string(),
                "-movflags".to_string(),
                "+faststart".to_string(),
            ]);
        }
        TranscodePreset::H2641080p => {
            args.extend([
                scale_limit_filter(1920, 1080),
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                "veryfast".to_string(),
                "-crf".to_string(),
                "21".to_string(),
                "-pix_fmt".to_string(),
                "yuv420p".to_string(),
                "-c:a".to_string(),
                "aac".to_string(),
                "-b:a".to_string(),
                "192k".to_string(),
                "-movflags".to_string(),
                "+faststart".to_string(),
            ]);
        }
        TranscodePreset::ProResProxy => {
            args.extend([
                scale_limit_filter(1920, 1080),
                "-c:v".to_string(),
                "prores_ks".to_string(),
                "-profile:v".to_string(),
                "0".to_string(),
                "-pix_fmt".to_string(),
                "yuv422p10le".to_string(),
                "-c:a".to_string(),
                "pcm_s16le".to_string(),
            ]);
        }
    }
    args.extend([
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-nostats".to_string(),
        output_path.to_string(),
    ]);
    args
}

fn scale_limit_filter(max_width: u32, max_height: u32) -> String {
    format!(
        "scale=w='min({max_width},iw)':h='min({max_height},ih)':force_original_aspect_ratio=decrease,setsar=1"
    )
}

fn build_transcode_output_path(
    app: &AppHandle,
    source_path: &Path,
    preset: &TranscodePreset,
    index: usize,
) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("transcodes");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let stem = source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(sanitize_stem)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "media".to_string());
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    Ok(dir.join(format!(
        "{timestamp}_{index}_{stem}_{}.{}",
        preset.slug(),
        preset.extension()
    )))
}

fn sanitize_stem(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn parse_out_time_us(line: &str) -> Option<u64> {
    line.strip_prefix("out_time_us=")?.trim().parse().ok()
}

fn progress_from_out_time(out_time_us: u64, expected_duration_us: u64) -> f32 {
    if expected_duration_us == 0 {
        return 0.0;
    }
    ((out_time_us as f64 / expected_duration_us as f64).clamp(0.0, 0.99) as f32 * 10_000.0)
        .round()
        / 10_000.0
}

fn ffprobe_duration_us(path: &Path) -> Option<u64> {
    let output = Command::new(ffprobe_binary())
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            &normalize_path(path),
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8(output.stdout).ok()?;
    let seconds = text.trim().parse::<f64>().ok()?;
    Some((seconds.max(0.0) * 1_000_000.0).round() as u64)
}

fn emit_progress(
    app: &AppHandle,
    task: &BatchTranscodeTaskRequest,
    output_path: Option<String>,
    status: &str,
    progress: f32,
    current: usize,
    total: usize,
) {
    let progress = progress.clamp(0.0, 1.0);
    let _ = app.emit(
        "batch-transcode-progress",
        BatchTranscodeProgressPayload {
            task_id: task.task_id.clone(),
            source_path: task.source_path.clone(),
            output_path,
            status: status.to_string(),
            progress,
            progress_pct: progress * 100.0,
            current,
            total,
        },
    );
}

fn task_result(
    task: &BatchTranscodeTaskRequest,
    output_path: Option<String>,
    status: &str,
    error: Option<String>,
    started: Instant,
) -> BatchTranscodeTaskResult {
    BatchTranscodeTaskResult {
        task_id: task.task_id.clone(),
        source_path: task.source_path.clone(),
        output_path,
        status: status.to_string(),
        error,
        duration_ms: started.elapsed().as_millis(),
    }
}

fn is_task_canceled(task_id: &str) -> bool {
    canceled_transcode_tasks()
        .lock()
        .map(|tasks| tasks.contains(task_id))
        .unwrap_or(false)
}

fn remove_cancellation(task_id: &str) {
    if let Ok(mut tasks) = canceled_transcode_tasks().lock() {
        tasks.remove(task_id);
    }
}

impl TranscodePreset {
    fn slug(&self) -> &'static str {
        match self {
            TranscodePreset::H264720p => "h264-720p",
            TranscodePreset::H2641080p => "h264-1080p",
            TranscodePreset::ProResProxy => "prores-proxy",
        }
    }

    fn extension(&self) -> &'static str {
        match self {
            TranscodePreset::H264720p | TranscodePreset::H2641080p => "mp4",
            TranscodePreset::ProResProxy => "mov",
        }
    }
}

fn ffmpeg_binary() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

fn ffprobe_binary() -> &'static str {
    if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_h264_720p_args_with_resolution_limit() {
        let args = build_transcode_args(
            "C:/Media/source.mov",
            "C:/App/transcodes/source_h264.mp4",
            &TranscodePreset::H264720p,
        );

        assert_eq!(args[0], "-y");
        assert!(args.windows(2).any(|pair| pair == ["-c:v", "libx264"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-vf", "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease,setsar=1"]));
        assert!(args.windows(2).any(|pair| pair == ["-progress", "pipe:1"]));
        assert_eq!(args.last().map(String::as_str), Some("C:/App/transcodes/source_h264.mp4"));
    }

    #[test]
    fn builds_h264_1080p_args_with_resolution_limit() {
        let args = build_transcode_args(
            "C:/Media/source.mov",
            "C:/App/transcodes/source_h264.mp4",
            &TranscodePreset::H2641080p,
        );

        assert!(args
            .windows(2)
            .any(|pair| pair == ["-vf", "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease,setsar=1"]));
        assert!(args.windows(2).any(|pair| pair == ["-crf", "21"]));
    }

    #[test]
    fn builds_prores_proxy_args_with_mov_output_codec() {
        let args = build_transcode_args(
            "C:/Media/source.mp4",
            "C:/App/transcodes/source_proxy.mov",
            &TranscodePreset::ProResProxy,
        );

        assert!(args.windows(2).any(|pair| pair == ["-c:v", "prores_ks"]));
        assert!(args.windows(2).any(|pair| pair == ["-profile:v", "0"]));
        assert!(args.windows(2).any(|pair| pair == ["-c:a", "pcm_s16le"]));
        assert_eq!(args.last().map(String::as_str), Some("C:/App/transcodes/source_proxy.mov"));
    }

    #[test]
    fn parses_progress_from_ffmpeg_progress_lines() {
        assert_eq!(parse_out_time_us("out_time_us=500000"), Some(500_000));
        assert_eq!(parse_out_time_us("progress=continue"), None);
        assert_eq!(progress_from_out_time(500_000, 1_000_000), 0.5);
        assert_eq!(progress_from_out_time(2_000_000, 1_000_000), 0.99);
        assert_eq!(progress_from_out_time(500_000, 0), 0.0);
    }
}
