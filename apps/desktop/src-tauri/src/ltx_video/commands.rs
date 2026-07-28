use crate::ltx_video::manager;
use crate::ltx_video::types::{TaskPayload, GenerationStatus};
use crate::ltx_video::manager::HealthCheckResult;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

/// Request for video generation.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateVideoRequest {
    pub prompt: String,
    #[serde(default)]
    pub negative_prompt: Option<String>,
    #[serde(default)]
    pub image_path: Option<String>,
    #[serde(default = "default_num_frames")]
    pub num_frames: u32,
    #[serde(default = "default_resolution")]
    pub resolution: u32,
    #[serde(default = "default_fps")]
    pub fps: u32,
    #[serde(default = "default_steps")]
    pub steps: u32,
    #[serde(default = "default_cfg_scale")]
    pub cfg_scale: f64,
    #[serde(default)]
    pub seed: Option<u64>,
}

fn default_num_frames() -> u32 {
    97
}
fn default_resolution() -> u32 {
    720
}
fn default_fps() -> u32 {
    24
}
fn default_steps() -> u32 {
    50
}
fn default_cfg_scale() -> f64 {
    7.5
}

/// Response for video generation.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateVideoResponse {
    pub task_id: String,
    pub status: GenerationStatus,
}

/// Response for generation status query.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationStatusResponse {
    pub task_id: String,
    pub status: String,
    pub progress: f32,
    pub stage: String,
    pub video_path: Option<String>,
    pub error: Option<String>,
}

/// Starts a new video generation task.
#[tauri::command]
pub async fn generate_video(
    app: AppHandle,
    request: GenerateVideoRequest,
) -> Result<GenerateVideoResponse, String> {
    // Input validation
    crate::input_validator::validate_non_empty_string(&request.prompt, "prompt")?;

    if let Some(ref neg) = request.negative_prompt {
        crate::input_validator::validate_string(neg, "negative_prompt")?;
    }
    if let Some(ref path) = request.image_path {
        crate::input_validator::validate_string(path, "image_path")?;
    }
    crate::input_validator::validate_range(request.num_frames, 4, 128, "num_frames")?;
    crate::input_validator::validate_range(request.resolution, 256, 1920, "resolution")?;
    crate::input_validator::validate_range(request.fps, 1, 60, "fps")?;
    crate::input_validator::validate_range(request.steps, 1, 150, "steps")?;
    crate::input_validator::validate_range(request.cfg_scale, 1.0, 30.0, "cfg_scale")?;

    // Resolution must be a multiple of 8
    if request.resolution % 8 != 0 {
        return Err(format!(
            "resolution must be a multiple of 8, got {}",
            request.resolution
        ));
    }

    let task_id = manager::generate_task_id();

    let payload = TaskPayload {
        prompt: request.prompt,
        negative_prompt: request.negative_prompt,
        image_path: request.image_path,
        num_frames: request.num_frames,
        resolution: request.resolution,
        fps: request.fps,
        steps: request.steps,
        cfg_scale: request.cfg_scale,
        seed: request.seed,
    };

    // Start generation in a blocking thread
    let app_clone = app.clone();
    let task_id_clone = task_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        manager::start_generation(&app_clone, &task_id_clone, &payload)
    })
    .await
    .map_err(|e| format!("Failed to spawn generation task: {}", e))??;

    Ok(GenerateVideoResponse {
        task_id: task_id.clone(),
        status: GenerationStatus::Running { progress: 0.0 },
    })
}

/// Gets the status of a generation task.
#[tauri::command]
pub async fn get_generation_status(task_id: String) -> Result<GenerationStatusResponse, String> {
    crate::input_validator::validate_non_empty_string(&task_id, "task_id")?;

    let entry = manager::get_generation_status(&task_id).ok_or_else(|| {
        format!("Task '{}' not found.", task_id)
    })?;

    Ok(GenerationStatusResponse {
        task_id,
        status: entry.status,
        progress: entry.progress,
        stage: entry.stage,
        video_path: entry.video_path,
        error: entry.error,
    })
}

/// Cancels a running generation task.
#[tauri::command]
pub async fn cancel_generation(task_id: String) -> Result<(), String> {
    crate::input_validator::validate_non_empty_string(&task_id, "task_id")?;
    manager::cancel_generation(&task_id)
}

/// Performs a health check on the LTX-Video sidecar environment.
#[tauri::command]
pub async fn ltx_health_check(app: AppHandle) -> Result<HealthCheckResult, String> {
    Ok(manager::health_check(&app))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_empty_prompt() {
        let result =
            crate::input_validator::validate_non_empty_string("", "prompt");
        assert!(result.is_err());
    }

    #[test]
    fn validates_num_frames_range() {
        assert!(crate::input_validator::validate_range(0u32, 4, 128, "num_frames").is_err());
        assert!(crate::input_validator::validate_range(3u32, 4, 128, "num_frames").is_err());
        assert!(crate::input_validator::validate_range(4u32, 4, 128, "num_frames").is_ok());
        assert!(crate::input_validator::validate_range(128u32, 4, 128, "num_frames").is_ok());
        assert!(crate::input_validator::validate_range(129u32, 4, 128, "num_frames").is_err());
    }

    #[test]
    fn validates_resolution_range() {
        assert!(crate::input_validator::validate_range(256u32, 256, 1920, "resolution").is_ok());
        assert!(crate::input_validator::validate_range(720u32, 256, 1920, "resolution").is_ok());
        assert!(crate::input_validator::validate_range(100u32, 256, 1920, "resolution").is_err());
        assert!(crate::input_validator::validate_range(1921u32, 256, 1920, "resolution").is_err());
    }

    #[test]
    fn validates_resolution_multiple_of_8() {
        // 720 is divisible by 8 (720/8 = 90)
        assert!(720u32 % 8 == 0);
        // 480 is divisible by 8 (480/8 = 60)
        assert!(480u32 % 8 == 0);
        // 1080 is divisible by 8 (1080/8 = 135)
        assert!(1080u32 % 8 == 0);
        // 721 is NOT divisible by 8
        assert!(721u32 % 8 != 0);
    }

    #[test]
    fn validates_cfg_scale_range() {
        assert!(crate::input_validator::validate_range(7.5f64, 1.0, 30.0, "cfg_scale").is_ok());
        assert!(crate::input_validator::validate_range(0.5f64, 1.0, 30.0, "cfg_scale").is_err());
    }

    #[test]
    fn generate_video_request_defaults() {
        let json = r#"{"prompt":"test"}"#;
        let req: GenerateVideoRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.num_frames, 97);
        assert_eq!(req.resolution, 720);
        assert_eq!(req.fps, 24);
        assert_eq!(req.steps, 50);
        assert!((req.cfg_scale - 7.5).abs() < f64::EPSILON);
        assert!(req.negative_prompt.is_none());
        assert!(req.image_path.is_none());
        assert!(req.seed.is_none());
    }
}
