use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

static RECORDING_CHILDREN: OnceLock<Mutex<HashMap<String, RecordingProcess>>> = OnceLock::new();

fn recording_children() -> &'static Mutex<HashMap<String, RecordingProcess>> {
    RECORDING_CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
}

struct RecordingProcess {
    child: Child,
    output_path: PathBuf,
    started: Instant,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum RecordingSource {
    Screen,
    Camera,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordingRequest {
    task_id: String,
    source: RecordingSource,
    width: u32,
    height: u32,
    frame_rate: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStartResult {
    task_id: String,
    output_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStopResult {
    task_id: String,
    output_path: String,
    duration_ms: u128,
}

#[tauri::command]
pub async fn start_recording(
    app: AppHandle,
    request: RecordingRequest,
) -> Result<RecordingStartResult, String> {
    tauri::async_runtime::spawn_blocking(move || start_recording_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub fn stop_recording(task_id: String) -> Result<RecordingStopResult, String> {
    let mut process = recording_children()
        .lock()
        .map_err(|_| "Unable to lock recording processes".to_string())?
        .remove(&task_id)
        .ok_or_else(|| "Recording task was not found.".to_string())?;
    if let Some(stdin) = process.child.stdin.as_mut() {
        let _ = stdin.write_all(b"q\n");
    }
    let _ = process.child.kill();
    let _ = process.child.wait();
    Ok(RecordingStopResult {
        task_id,
        output_path: normalize_path(&process.output_path),
        duration_ms: process.started.elapsed().as_millis(),
    })
}

fn start_recording_blocking(
    app: AppHandle,
    request: RecordingRequest,
) -> Result<RecordingStartResult, String> {
    validate_recording_request(&request)?;
    let output_path = build_recording_output_path(&app, &request)?;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let args = build_recording_args_for_current_platform(&request, &output_path);
    let child = Command::new(ffmpeg_binary())
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg recording: {}", error))?;
    recording_children()
        .lock()
        .map_err(|_| "Unable to lock recording processes".to_string())?
        .insert(
            request.task_id.clone(),
            RecordingProcess {
                child,
                output_path: output_path.clone(),
                started: Instant::now(),
            },
        );
    Ok(RecordingStartResult {
        task_id: request.task_id,
        output_path: normalize_path(&output_path),
    })
}

fn validate_recording_request(request: &RecordingRequest) -> Result<(), String> {
    if request.task_id.trim().is_empty() {
        return Err("Recording task id is missing.".to_string());
    }
    if request.width == 0 || request.height == 0 {
        return Err("Recording resolution is invalid.".to_string());
    }
    if request.frame_rate == 0 {
        return Err("Recording frame rate is invalid.".to_string());
    }
    Ok(())
}

fn build_recording_output_path(
    app: &AppHandle,
    request: &RecordingRequest,
) -> Result<PathBuf, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("recordings")
        .join(format!(
            "{}-{}.mp4",
            safe_file_name(&request.task_id),
            millis
        )))
}

fn build_recording_args_for_current_platform(
    request: &RecordingRequest,
    output_path: &Path,
) -> Vec<String> {
    if cfg!(target_os = "macos") {
        return build_recording_args_for_platform("macos", request, output_path);
    }
    build_recording_args_for_platform("windows", request, output_path)
}

fn build_recording_args_for_platform(
    platform: &str,
    request: &RecordingRequest,
    output_path: &Path,
) -> Vec<String> {
    let size = format!("{}x{}", request.width, request.height);
    let frame_rate = request.frame_rate.to_string();
    let mut args = vec!["-y".to_string()];
    match (platform, &request.source) {
        ("macos", RecordingSource::Screen) => {
            args.extend([
                "-f".to_string(),
                "avfoundation".to_string(),
                "-framerate".to_string(),
                frame_rate,
                "-video_size".to_string(),
                size,
                "-i".to_string(),
                "1:none".to_string(),
            ]);
        }
        ("macos", RecordingSource::Camera) => {
            args.extend([
                "-f".to_string(),
                "avfoundation".to_string(),
                "-framerate".to_string(),
                frame_rate,
                "-video_size".to_string(),
                size,
                "-i".to_string(),
                "0:none".to_string(),
            ]);
        }
        ("windows", RecordingSource::Camera) => {
            args.extend([
                "-f".to_string(),
                "dshow".to_string(),
                "-framerate".to_string(),
                frame_rate,
                "-video_size".to_string(),
                size,
                "-i".to_string(),
                "video=default".to_string(),
            ]);
        }
        _ => {
            args.extend([
                "-f".to_string(),
                "gdigrab".to_string(),
                "-framerate".to_string(),
                frame_rate,
                "-video_size".to_string(),
                size,
                "-i".to_string(),
                "desktop".to_string(),
            ]);
        }
    }
    args.extend([
        "-an".to_string(),
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "veryfast".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        normalize_path(output_path),
    ]);
    args
}

fn ffmpeg_binary() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

fn safe_file_name(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_windows_screen_gdigrab_args() {
        let request = RecordingRequest {
            task_id: "rec-1".to_string(),
            source: RecordingSource::Screen,
            width: 1280,
            height: 720,
            frame_rate: 30,
        };

        let args = build_recording_args_for_platform(
            "windows",
            &request,
            Path::new("C:/Temp/recording.mp4"),
        );

        assert!(args.windows(2).any(|pair| pair == ["-f", "gdigrab"]));
        assert!(args.windows(2).any(|pair| pair == ["-i", "desktop"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-video_size", "1280x720"]));
        assert!(args.windows(2).any(|pair| pair == ["-framerate", "30"]));
        assert_eq!(
            args.last().map(String::as_str),
            Some("C:/Temp/recording.mp4")
        );
    }

    #[test]
    fn builds_macos_screen_avfoundation_args() {
        let request = RecordingRequest {
            task_id: "rec-1".to_string(),
            source: RecordingSource::Screen,
            width: 1920,
            height: 1080,
            frame_rate: 60,
        };

        let args =
            build_recording_args_for_platform("macos", &request, Path::new("/tmp/recording.mp4"));

        assert!(args.windows(2).any(|pair| pair == ["-f", "avfoundation"]));
        assert!(args.windows(2).any(|pair| pair == ["-i", "1:none"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-video_size", "1920x1080"]));
        assert!(args.windows(2).any(|pair| pair == ["-framerate", "60"]));
        assert_eq!(args.last().map(String::as_str), Some("/tmp/recording.mp4"));
    }

    #[test]
    fn rejects_invalid_recording_settings() {
        let request = RecordingRequest {
            task_id: String::new(),
            source: RecordingSource::Camera,
            width: 0,
            height: 720,
            frame_rate: 30,
        };

        assert_eq!(
            validate_recording_request(&request).unwrap_err(),
            "Recording task id is missing."
        );
    }
}
