use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderPreviewCacheRequest {
    pub project_id: String,
    pub start_sec: f64,
    pub end_sec: f64,
    pub source_path: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderPreviewCacheResult {
    pub output_path: String,
    pub duration_ms: u64,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RenderPreviewCacheProgressEvent {
    pub project_id: String,
    pub progress: f64,
    pub stage: String,
}

#[tauri::command]
pub fn render_preview_cache(
    app: AppHandle,
    request: RenderPreviewCacheRequest,
) -> Result<RenderPreviewCacheResult, String> {
    let cache_dir = render_cache_root(&app)?;
    let project_dir = cache_dir.join(&request.project_id);
    fs::create_dir_all(&project_dir).map_err(|e| format!("Failed to create cache dir: {e}"))?;

    let duration = request.end_sec - request.start_sec;
    if duration <= 0.0 {
        return Err("Invalid time range: end must be greater than start".to_string());
    }

    let _ = app.emit(
        "render-preview-cache-progress",
        RenderPreviewCacheProgressEvent {
            project_id: request.project_id.clone(),
            progress: 0.0,
            stage: "starting".to_string(),
        },
    );

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let output_path = project_dir.join(format!("{ts}.mp4"));
    let output_str = output_path.to_string_lossy().to_string();

    let ffmpeg = super::binaries::ffmpeg_binary();

    let start_str = format!("{:.3}", request.start_sec);
    let duration_str = format!("{:.3}", duration);
    let size_str = format!("{}x{}", request.width, request.height);
    let vf_arg = format!("scale={size_str}");

    let args = vec![
        "-ss", start_str.as_str(),
        "-i", request.source_path.as_str(),
        "-t", duration_str.as_str(),
        "-vf", vf_arg.as_str(),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-c:a", "aac",
        "-y",
        output_str.as_str(),
    ];

    let start_time = std::time::Instant::now();

    let status = Command::new(&ffmpeg)
        .args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(|e| format!("Failed to run ffmpeg: {e}"))?;

    let duration_ms = start_time.elapsed().as_millis() as u64;

    let _ = app.emit(
        "render-preview-cache-progress",
        RenderPreviewCacheProgressEvent {
            project_id: request.project_id.clone(),
            progress: 1.0,
            stage: "finished".to_string(),
        },
    );

    if status.success() {
        Ok(RenderPreviewCacheResult {
            output_path: output_str,
            duration_ms,
            success: true,
            error: None,
        })
    } else {
        Ok(RenderPreviewCacheResult {
            output_path: String::new(),
            duration_ms,
            success: false,
            error: Some(format!("ffmpeg exited with status: {status}")),
        })
    }
}

fn render_cache_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(base.join("render-cache"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_cache_request_roundtrip() {
        let request = RenderPreviewCacheRequest {
            project_id: "test-project".to_string(),
            start_sec: 0.0,
            end_sec: 10.0,
            source_path: "/tmp/video.mp4".to_string(),
            width: 1920,
            height: 1080,
        };
        let json = serde_json::to_string(&request).unwrap();
        let parsed: RenderPreviewCacheRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.project_id, "test-project");
        assert_eq!(parsed.width, 1920);
    }

    #[test]
    fn render_preview_cache_progress_event_serializes() {
        let event = RenderPreviewCacheProgressEvent {
            project_id: "proj".to_string(),
            progress: 0.5,
            stage: "rendering".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("progress"));
        assert!(json.contains("rendering"));
    }
}
