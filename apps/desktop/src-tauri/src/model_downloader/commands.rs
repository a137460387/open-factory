use crate::model_downloader::downloader;
use crate::model_downloader::types::{
    ListModelsResponse, LocalModelInfo, RemoteModelListResponse, RemoteModelInfo,
};
use serde::Deserialize;
use tauri::AppHandle;

/// Response for delete_model command.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteModelResponse {
    pub repo_id: String,
    pub deleted: bool,
}

/// Request for download_model command.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadModelRequest {
    pub repo_id: String,
}

/// Downloads a model from HuggingFace to local storage.
#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    request: DownloadModelRequest,
) -> Result<LocalModelInfo, String> {
    crate::input_validator::validate_non_empty_string(&request.repo_id, "repo_id")?;

    let app_clone = app.clone();
    let repo_id = request.repo_id.clone();

    tauri::async_runtime::spawn_blocking(move || {
        downloader::download_model(&app_clone, &repo_id)
    })
    .await
    .map_err(|e| format!("download task failed: {e}"))?
}

/// Lists all locally downloaded models.
#[tauri::command]
pub async fn list_local_models(app: AppHandle) -> Result<ListModelsResponse, String> {
    let models = downloader::list_local_models(&app)?;
    let total_size = models.iter().map(|m| m.total_size).sum();

    Ok(ListModelsResponse { models, total_size })
}

/// Deletes a locally downloaded model.
#[tauri::command]
pub async fn delete_model(
    app: AppHandle,
    repo_id: String,
) -> Result<DeleteModelResponse, String> {
    crate::input_validator::validate_non_empty_string(&repo_id, "repo_id")?;

    downloader::delete_local_model(&app, &repo_id)?;

    Ok(DeleteModelResponse {
        repo_id,
        deleted: true,
    })
}

/// Fetches info about a remote model from HuggingFace.
#[tauri::command]
pub async fn get_remote_model_info(repo_id: String) -> Result<RemoteModelInfo, String> {
    crate::input_validator::validate_non_empty_string(&repo_id, "repo_id")?;

    tauri::async_runtime::spawn_blocking(move || {
        downloader::fetch_remote_model_info(&repo_id)
    })
    .await
    .map_err(|e| format!("fetch model info failed: {e}"))?
}

/// Lists available remote models from the default repos.
#[tauri::command]
pub async fn list_remote_models() -> Result<RemoteModelListResponse, String> {
    let mut models = Vec::new();

    for repo_id in crate::model_downloader::types::DEFAULT_MODEL_REPOS {
        match downloader::fetch_remote_model_info(repo_id) {
            Ok(info) => models.push(info),
            Err(e) => {
                tracing::warn!("Failed to fetch remote model {}: {}", repo_id, e);
            }
        }
    }

    Ok(RemoteModelListResponse { models })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn download_request_deserializes() {
        let json = r#"{"repoId":"Lightricks/LTX-Video-0.9.1"}"#;
        let req: DownloadModelRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.repo_id, "Lightricks/LTX-Video-0.9.1");
    }

    #[test]
    fn delete_response_serializes() {
        let resp = DeleteModelResponse {
            repo_id: "test/model".to_string(),
            deleted: true,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"deleted\":true"));
        assert!(json.contains("\"repoId\""));
    }
}
