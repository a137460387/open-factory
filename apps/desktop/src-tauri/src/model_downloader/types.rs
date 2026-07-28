use serde::{Deserialize, Serialize};

/// Metadata for a model file hosted on HuggingFace.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelFile {
    pub filename: String,
    pub size: u64,
    pub url: String,
}

/// Metadata for a model (repo) on HuggingFace.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteModelInfo {
    pub repo_id: String,
    pub files: Vec<ModelFile>,
    pub total_size: u64,
}

/// Status of a locally downloaded model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelInfo {
    pub repo_id: String,
    pub path: String,
    pub files: Vec<LocalModelFile>,
    pub total_size: u64,
}

/// A single file within a local model directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelFile {
    pub filename: String,
    pub size: u64,
}

/// Download progress event emitted to the frontend.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadProgressPayload {
    pub repo_id: String,
    pub filename: String,
    pub file_index: u32,
    pub total_files: u32,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub overall_progress: f32,
}

/// Completion event emitted to the frontend.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadCompletedPayload {
    pub repo_id: String,
    pub path: String,
    pub total_size: u64,
}

/// Result of a list_local_models call.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListModelsResponse {
    pub models: Vec<LocalModelInfo>,
    pub total_size: u64,
}

/// Result of a list_remote_models call.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteModelListResponse {
    pub models: Vec<RemoteModelInfo>,
}

/// Default list of LTX-Video model repos on HuggingFace.
pub const DEFAULT_MODEL_REPOS: &[&str] = &[
    "Lightricks/LTX-Video-0.9.1",
    "Lightricks/LTX-Video-0.9.7",
];

/// Expected filenames for the LTX-Video model.
pub const EXPECTED_MODEL_FILES: &[&str] = &[
    "ltx-video-2b-v0.9.1.safetensors",
    "ltx-video-2b-v0.9.7.safetensors",
    "scheduler_config.json",
    "text_encoder/config.json",
    "text_encoder/model.safetensors",
    "tokenizer/merges.txt",
    "tokenizer/special_tokens_map.json",
    "tokenizer/tokenizer_config.json",
    "tokenizer/vocab.json",
    "transformer/config.json",
    "transformer/diffusion_pytorch_model.safetensors",
    "vae/config.json",
    "vae/diffusion_pytorch_model.safetensors",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_download_progress_serializes() {
        let payload = ModelDownloadProgressPayload {
            repo_id: "Lightricks/LTX-Video-0.9.1".to_string(),
            filename: "model.safetensors".to_string(),
            file_index: 1,
            total_files: 5,
            bytes_downloaded: 1024,
            total_bytes: 4096,
            overall_progress: 0.25,
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"repoId\""));
        assert!(json.contains("\"overallProgress\":0.25"));
    }

    #[test]
    fn local_model_info_serializes() {
        let info = LocalModelInfo {
            repo_id: "Lightricks/LTX-Video-0.9.1".to_string(),
            path: "/home/user/.open-factory/models/ltx-video/Lightricks/LTX-Video-0.9.1".to_string(),
            files: vec![LocalModelFile {
                filename: "model.safetensors".to_string(),
                size: 5_000_000_000,
            }],
            total_size: 5_000_000_000,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"repoId\""));
        assert!(json.contains("\"totalSize\":5000000000"));
    }

    #[test]
    fn default_model_repos_not_empty() {
        assert!(!DEFAULT_MODEL_REPOS.is_empty());
    }
}
