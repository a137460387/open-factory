use serde::{Deserialize, Serialize};

/// Input payload for LTX-Video generation task.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPayload {
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

/// Status of a generation task.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum GenerationStatus {
    Queued,
    Running { progress: f32 },
    Completed,
    Failed { error: String },
    Canceled,
}

/// Result returned after a generation task finishes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskResult {
    pub task_id: String,
    pub video_path: String,
    pub duration_ms: u128,
    pub status: GenerationStatus,
}

/// Progress event emitted to the frontend during generation.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LtxProgressPayload {
    pub task_id: String,
    pub progress: f32,
    pub progress_pct: f32,
    pub stage: String,
}

/// Message sent from Python sidecar to Rust via stdout (JSON lines).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SidecarMessage {
    Progress {
        progress: f32,
        stage: String,
    },
    Completed {
        video_path: String,
    },
    Error {
        message: String,
    },
    Ready,
}

/// Message sent from Rust to Python sidecar via stdin (JSON lines).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SidecarCommand {
    Generate {
        prompt: String,
        negative_prompt: Option<String>,
        image_path: Option<String>,
        num_frames: u32,
        resolution: u32,
        fps: u32,
        steps: u32,
        cfg_scale: f64,
        seed: Option<u64>,
        output_path: String,
    },
    Cancel,
    Shutdown,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_task_payload_with_defaults() {
        let payload = TaskPayload {
            prompt: "a cat walking".to_string(),
            negative_prompt: None,
            image_path: None,
            num_frames: 97,
            resolution: 720,
            fps: 24,
            steps: 50,
            cfg_scale: 7.5,
            seed: None,
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"prompt\":\"a cat walking\""));
        assert!(json.contains("\"numFrames\":97"));
    }

    #[test]
    fn deserializes_sidecar_message_progress() {
        let json = r#"{"type":"progress","progress":0.5,"stage":"denoising"}"#;
        let msg: SidecarMessage = serde_json::from_str(json).unwrap();
        match msg {
            SidecarMessage::Progress { progress, stage } => {
                assert!((progress - 0.5).abs() < f32::EPSILON);
                assert_eq!(stage, "denoising");
            }
            _ => panic!("expected Progress variant"),
        }
    }

    #[test]
    fn deserializes_sidecar_message_completed() {
        let json = r#"{"type":"completed","video_path":"/tmp/output.mp4"}"#;
        let msg: SidecarMessage = serde_json::from_str(json).unwrap();
        match msg {
            SidecarMessage::Completed { video_path } => {
                assert_eq!(video_path, "/tmp/output.mp4");
            }
            _ => panic!("expected Completed variant"),
        }
    }

    #[test]
    fn deserializes_sidecar_message_error() {
        let json = r#"{"type":"error","message":"CUDA out of memory"}"#;
        let msg: SidecarMessage = serde_json::from_str(json).unwrap();
        match msg {
            SidecarMessage::Error { message } => {
                assert_eq!(message, "CUDA out of memory");
            }
            _ => panic!("expected Error variant"),
        }
    }

    #[test]
    fn serializes_sidecar_command_generate() {
        let cmd = SidecarCommand::Generate {
            prompt: "test".to_string(),
            negative_prompt: Some("blurry".to_string()),
            image_path: None,
            num_frames: 25,
            resolution: 512,
            fps: 24,
            steps: 30,
            cfg_scale: 7.0,
            seed: Some(42),
            output_path: "/tmp/out.mp4".to_string(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("\"type\":\"generate\""));
        assert!(json.contains("\"seed\":42"));
    }

    #[test]
    fn generation_status_equality() {
        assert_eq!(GenerationStatus::Queued, GenerationStatus::Queued);
        assert_eq!(GenerationStatus::Completed, GenerationStatus::Completed);
        assert_eq!(
            GenerationStatus::Running { progress: 0.5 },
            GenerationStatus::Running { progress: 0.5 }
        );
    }
}
