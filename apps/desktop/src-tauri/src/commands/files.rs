use crate::path_validator::{
    authorize_existing_path, authorize_path_for_write, validate_path, validate_path_for_write,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FilePath;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogFilterDto {
    name: String,
    extensions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatDto {
    path: String,
    size: u64,
    mtime_ms: f64,
}

#[tauri::command]
pub fn open_file_dialog(
    app: AppHandle,
    multiple: bool,
    filters: Vec<DialogFilterDto>,
) -> Result<Vec<String>, String> {
    let mut dialog = app.dialog().file();
    for filter in &filters {
        let extensions = filter
            .extensions
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>();
        dialog = dialog.add_filter(&filter.name, &extensions);
    }
    let paths = if multiple {
        dialog.blocking_pick_files().unwrap_or_default()
    } else {
        dialog.blocking_pick_file().into_iter().collect()
    };
    paths
        .into_iter()
        .map(|path| authorize_file_path_to_string(&app, path))
        .collect()
}

#[tauri::command]
pub fn save_file_dialog(
    app: AppHandle,
    default_path: Option<String>,
    filters: Vec<DialogFilterDto>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();
    if let Some(path) = default_path {
        dialog = dialog.set_file_name(path);
    }
    for filter in &filters {
        let extensions = filter
            .extensions
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>();
        dialog = dialog.add_filter(&filter.name, &extensions);
    }
    dialog
        .blocking_save_file()
        .map(|path| authorize_writable_file_path_to_string(&app, path))
        .transpose()
}

#[tauri::command]
pub fn open_directory_dialog(app: AppHandle) -> Result<Option<String>, String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|path| authorize_directory_path_to_string(&app, path))
        .transpose()
}

#[tauri::command]
pub fn authorize_paths(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    for path in paths {
        authorize_existing_path(&app, Path::new(&path))?;
    }
    Ok(())
}

#[tauri::command]
pub fn read_file(app: AppHandle, path: String) -> Result<String, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    fs::read_to_string(&safe_path)
        .map_err(|error| format!("Unable to read {}: {}", normalize_path(&safe_path), error))
}

#[tauri::command]
pub fn write_file(app: AppHandle, path: String, contents: String) -> Result<(), String> {
    let safe_path = validate_path_for_write(&app, Path::new(&path))?;
    if let Some(parent) = safe_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
    }
    fs::write(&safe_path, contents)
        .map_err(|error| format!("Unable to write {}: {}", normalize_path(&safe_path), error))
}

#[tauri::command]
pub fn remove_file(app: AppHandle, path: String) -> Result<(), String> {
    let safe_path = validate_path_for_write(&app, Path::new(&path))?;
    match fs::remove_file(&safe_path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Unable to remove {}: {}",
            normalize_path(&safe_path),
            error
        )),
    }
}

#[tauri::command]
pub fn fs_exists(app: AppHandle, path: String) -> Result<bool, String> {
    let safe_path = validate_path_for_write(&app, Path::new(&path))?;
    Ok(safe_path.exists())
}

#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(normalize_path(&path))
}

#[tauri::command]
pub fn get_file_stat(app: AppHandle, path: String) -> Result<FileStatDto, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    let metadata = fs::metadata(&safe_path)
        .map_err(|error| format!("Unable to stat {}: {}", normalize_path(&safe_path), error))?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as f64)
        .unwrap_or(0.0);
    Ok(FileStatDto {
        path: normalize_path(&safe_path),
        size: metadata.len(),
        mtime_ms: modified,
    })
}

#[tauri::command]
pub fn scan_directory(
    app: AppHandle,
    path: String,
    depth: Option<u8>,
) -> Result<Vec<String>, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    let max_depth = depth.unwrap_or(3).min(3);
    let mut results = Vec::new();
    scan_directory_inner(&safe_path, max_depth, &mut results)?;
    Ok(results)
}

fn scan_directory_inner(path: &Path, depth: u8, results: &mut Vec<String>) -> Result<(), String> {
    if depth == 0 {
        return Ok(());
    }
    let entries = fs::read_dir(path)
        .map_err(|error| format!("Unable to scan {}: {}", normalize_path(path), error))?;
    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            scan_directory_inner(&entry_path, depth - 1, results)?;
        } else {
            results.push(normalize_path(&entry_path));
        }
    }
    Ok(())
}

fn authorize_file_path_to_string(app: &AppHandle, path: FilePath) -> Result<String, String> {
    let path_buf: PathBuf = path.into_path().map_err(|error| error.to_string())?;
    authorize_existing_path(app, &path_buf)?;
    authorize_parent_directory(app, &path_buf)?;
    Ok(normalize_path(&path_buf))
}

fn authorize_writable_file_path_to_string(
    app: &AppHandle,
    path: FilePath,
) -> Result<String, String> {
    let path_buf: PathBuf = path.into_path().map_err(|error| error.to_string())?;
    authorize_path_for_write(app, &path_buf)?;
    authorize_parent_directory(app, &path_buf)?;
    Ok(normalize_path(&path_buf))
}

fn authorize_directory_path_to_string(app: &AppHandle, path: FilePath) -> Result<String, String> {
    let path_buf: PathBuf = path.into_path().map_err(|error| error.to_string())?;
    authorize_existing_path(app, &path_buf)?;
    Ok(normalize_path(&path_buf))
}

fn authorize_parent_directory(app: &AppHandle, path: &Path) -> Result<(), String> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        authorize_existing_path(app, parent)?;
    }
    Ok(())
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
