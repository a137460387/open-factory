use crate::model_downloader::types::{
    LocalModelFile, LocalModelInfo, ModelDownloadCompletedPayload, ModelDownloadProgressPayload,
};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

/// Resolves the base directory for storing downloaded models.
pub fn resolve_models_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;
    Ok(app_data.join("models").join("ltx-video"))
}

/// Converts a HuggingFace repo_id (e.g. "Lightricks/LTX-Video-0.9.1") to a
/// safe local directory name.
fn repo_id_to_dir_name(repo_id: &str) -> String {
    repo_id
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

/// Builds the HuggingFace API URL for listing files in a repo.
fn build_repo_api_url(repo_id: &str) -> String {
    format!("https://huggingface.co/api/models/{}/tree/main", repo_id)
}

/// Builds the raw download URL for a file in a HuggingFace repo.
fn build_download_url(repo_id: &str, filename: &str) -> String {
    format!(
        "https://huggingface.co/{}/resolve/main/{}",
        repo_id, filename
    )
}

/// Fetches the file list for a remote HuggingFace model repo.
pub fn fetch_remote_model_info(repo_id: &str) -> Result<super::types::RemoteModelInfo, String> {
    let url = build_repo_api_url(repo_id);
    let response =
        reqwest::blocking::get(&url).map_err(|e| format!("fetch model info: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "HuggingFace API returned status {} for {}",
            response.status(),
            repo_id
        ));
    }

    let entries: Vec<HuggingFaceTreeEntry> = response
        .json()
        .map_err(|e| format!("parse model info: {e}"))?;

    let files: Vec<super::types::ModelFile> = entries
        .iter()
        .filter(|entry| entry.entry_type == "file")
        .map(|entry| super::types::ModelFile {
            filename: entry.path.clone(),
            size: entry.size.unwrap_or(0),
            url: build_download_url(repo_id, &entry.path),
        })
        .collect();

    let total_size = files.iter().map(|f| f.size).sum();

    Ok(super::types::RemoteModelInfo {
        repo_id: repo_id.to_string(),
        files,
        total_size,
    })
}

/// JSON structure returned by the HuggingFace tree API.
#[derive(Debug, serde::Deserialize)]
struct HuggingFaceTreeEntry {
    path: String,
    #[serde(rename = "type")]
    entry_type: String,
    size: Option<u64>,
}

/// Downloads a model from HuggingFace, emitting progress events to the frontend.
pub fn download_model(
    app: &AppHandle,
    repo_id: &str,
) -> Result<LocalModelInfo, String> {
    let base_dir = resolve_models_base_dir(app)?;
    let model_dir = base_dir.join(repo_id_to_dir_name(repo_id));

    // Fetch remote file list
    let remote_info = fetch_remote_model_info(repo_id)?;
    if remote_info.files.is_empty() {
        return Err(format!("No files found for model {}", repo_id));
    }

    fs::create_dir_all(&model_dir).map_err(|e| format!("create model dir: {e}"))?;

    let total_files = remote_info.files.len() as u32;
    let total_bytes = remote_info.total_size;
    let mut downloaded_bytes: u64 = 0;

    for (index, file) in remote_info.files.iter().enumerate() {
        let file_path = model_dir.join(&file.filename);

        // Create subdirectories if needed
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create subdir: {e}"))?;
        }

        // Check if file already exists and has correct size
        if file_path.exists() {
            if let Ok(metadata) = fs::metadata(&file_path) {
                if metadata.len() == file.size && file.size > 0 {
                    downloaded_bytes += file.size;
                    continue;
                }
            }
        }

        // Download with resume support
        download_file_with_progress(
            app,
            repo_id,
            &file.url,
            &file_path,
            file.size,
            index as u32,
            total_files,
            downloaded_bytes,
            total_bytes,
        )?;

        downloaded_bytes += file.size;
    }

    // Emit completion event
    let local_info = scan_local_model_dir(&model_dir, repo_id)?;
    let _ = app.emit(
        "model-download-completed",
        ModelDownloadCompletedPayload {
            repo_id: repo_id.to_string(),
            path: model_dir.to_string_lossy().to_string(),
            total_size: local_info.total_size,
        },
    );

    Ok(local_info)
}

/// Downloads a single file with progress reporting and resume support.
#[allow(clippy::too_many_arguments)]
fn download_file_with_progress(
    app: &AppHandle,
    repo_id: &str,
    url: &str,
    dest: &Path,
    expected_size: u64,
    file_index: u32,
    total_files: u32,
    prior_bytes: u64,
    total_bytes: u64,
) -> Result<(), String> {
    let client = reqwest::blocking::Client::new();

    // Check for partial download (resume)
    let existing_len = if dest.exists() {
        fs::metadata(dest).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let mut request = client.get(url);
    if existing_len > 0 {
        request = request.header("Range", format!("bytes={}-", existing_len));
    }

    let response = request
        .send()
        .map_err(|e| format!("download {}: {}", dest.display(), e))?;

    let status = response.status();
    if !status.is_success() && status.as_u16() != 206 {
        return Err(format!(
            "download {} returned HTTP {}",
            dest.display(),
            status
        ));
    }

    let is_resume = status.as_u16() == 206;
    let mut file = if is_resume {
        fs::OpenOptions::new()
            .append(true)
            .open(dest)
            .map_err(|e| format!("open for resume: {e}"))?
    } else {
        fs::File::create(dest).map_err(|e| format!("create {}: {e}", dest.display()))?
    };

    let bytes = response
        .bytes()
        .map_err(|e| format!("read response for {}: {e}", dest.display()))?;

    file.write_all(&bytes)
        .map_err(|e| format!("write {}: {e}", dest.display()))?;
    file.flush().map_err(|e| format!("flush: {e}"))?;

    let bytes_written = existing_len + bytes.len() as u64;

    // Emit progress
    let overall = if total_bytes > 0 {
        ((prior_bytes + bytes_written) as f32) / (total_bytes as f32)
    } else {
        0.0
    };

    let filename = dest
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let _ = app.emit(
        "model-download-progress",
        ModelDownloadProgressPayload {
            repo_id: repo_id.to_string(),
            filename,
            file_index,
            total_files,
            bytes_downloaded: bytes_written,
            total_bytes: expected_size,
            overall_progress: overall.clamp(0.0, 1.0),
        },
    );

    Ok(())
}

/// Scans a local model directory and returns its info.
fn scan_local_model_dir(model_dir: &Path, repo_id: &str) -> Result<LocalModelInfo, String> {
    let mut files = Vec::new();
    let mut total_size: u64 = 0;

    scan_dir_recursive(model_dir, model_dir, &mut files, &mut total_size)?;

    Ok(LocalModelInfo {
        repo_id: repo_id.to_string(),
        path: model_dir.to_string_lossy().to_string(),
        files,
        total_size,
    })
}

/// Recursively scans a directory for files.
fn scan_dir_recursive(
    base: &Path,
    dir: &Path,
    files: &mut Vec<LocalModelFile>,
    total_size: &mut u64,
) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("read dir: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("read entry: {e}"))?;
        let path = entry.path();

        if path.is_dir() {
            scan_dir_recursive(base, &path, files, total_size)?;
        } else {
            let metadata = fs::metadata(&path).map_err(|e| format!("metadata: {e}"))?;
            let size = metadata.len();
            *total_size += size;

            let relative = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            files.push(LocalModelFile {
                filename: relative,
                size,
            });
        }
    }

    Ok(())
}

/// Lists all locally downloaded models.
pub fn list_local_models(app: &AppHandle) -> Result<Vec<LocalModelInfo>, String> {
    let base_dir = resolve_models_base_dir(app)?;

    if !base_dir.exists() {
        return Ok(Vec::new());
    }

    let mut models = Vec::new();
    let entries = fs::read_dir(&base_dir).map_err(|e| format!("read models dir: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("read entry: {e}"))?;
        let path = entry.path();

        if path.is_dir() {
            let dir_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Reconstruct repo_id from dir name
            let repo_id = dir_name.replace('_', "/");
            let info = scan_local_model_dir(&path, &repo_id)?;
            models.push(info);
        }
    }

    Ok(models)
}

/// Deletes a locally downloaded model.
pub fn delete_local_model(app: &AppHandle, repo_id: &str) -> Result<(), String> {
    let base_dir = resolve_models_base_dir(app)?;
    let model_dir = base_dir.join(repo_id_to_dir_name(repo_id));

    if !model_dir.exists() {
        return Err(format!("Model '{}' not found locally.", repo_id));
    }

    fs::remove_dir_all(&model_dir).map_err(|e| format!("delete model dir: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repo_id_to_dir_name_converts_slash() {
        assert_eq!(
            repo_id_to_dir_name("Lightricks/LTX-Video-0.9.1"),
            "Lightricks_LTX-Video-0.9.1"
        );
    }

    #[test]
    fn repo_id_to_dir_name_handles_special_chars() {
        assert_eq!(repo_id_to_dir_name("org/name@v2"), "org_name_v2");
    }

    #[test]
    fn build_download_url_correct() {
        let url = build_download_url("Lightricks/LTX-Video-0.9.1", "model.safetensors");
        assert_eq!(
            url,
            "https://huggingface.co/Lightricks/LTX-Video-0.9.1/resolve/main/model.safetensors"
        );
    }

    #[test]
    fn build_repo_api_url_correct() {
        let url = build_repo_api_url("Lightricks/LTX-Video-0.9.1");
        assert_eq!(
            url,
            "https://huggingface.co/api/models/Lightricks/LTX-Video-0.9.1/tree/main"
        );
    }

    #[test]
    fn scan_dir_recursive_handles_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let mut files = Vec::new();
        let mut total_size: u64 = 0;
        scan_dir_recursive(dir.path(), dir.path(), &mut files, &mut total_size).unwrap();
        assert!(files.is_empty());
        assert_eq!(total_size, 0);
    }

    #[test]
    fn scan_dir_recursive_finds_files() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), b"hello").unwrap();
        fs::create_dir_all(dir.path().join("sub")).unwrap();
        fs::write(dir.path().join("sub/b.txt"), b"world!!").unwrap();

        let mut files = Vec::new();
        let mut total_size: u64 = 0;
        scan_dir_recursive(dir.path(), dir.path(), &mut files, &mut total_size).unwrap();

        assert_eq!(files.len(), 2);
        assert_eq!(total_size, 12); // 5 + 7
    }
}
