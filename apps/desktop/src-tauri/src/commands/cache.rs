use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn get_cache_dir(app: AppHandle) -> Result<String, String> {
    Ok(normalize_path(&cache_root(&app)?))
}

#[tauri::command]
pub fn ensure_cache_dirs(app: AppHandle) -> Result<(), String> {
    let root = cache_root(&app)?;
    for child in ["thumbnails", "waveforms", "media-index", "proxies"] {
        fs::create_dir_all(root.join(child)).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn read_cache(app: AppHandle, path: String) -> Result<Option<String>, String> {
    let full_path = cache_path(&app, &path)?;
    if !full_path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&full_path).map(Some).map_err(|error| {
        format!(
            "Unable to read cache {}: {}",
            normalize_path(&full_path),
            error
        )
    })
}

#[tauri::command]
pub fn write_cache(app: AppHandle, path: String, contents: String) -> Result<(), String> {
    let full_path = cache_path(&app, &path)?;
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&full_path, contents).map_err(|error| {
        format!(
            "Unable to write cache {}: {}",
            normalize_path(&full_path),
            error
        )
    })
}

#[tauri::command]
pub fn remove_cache_file(app: AppHandle, path: String) -> Result<(), String> {
    let full_path = cache_path(&app, &path)?;
    if full_path.exists() {
        fs::remove_file(full_path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn clear_cache(app: AppHandle) -> Result<(), String> {
    let root = cache_root(&app)?;
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    }
    ensure_cache_dirs(app)
}

#[tauri::command]
pub fn get_cache_size(app: AppHandle) -> Result<u64, String> {
    let root = cache_root(&app)?;
    if !root.exists() {
        return Ok(0);
    }
    directory_size(&root)
}

fn cache_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("media-cache");
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root)
}

fn cache_path(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    if relative.contains("..") || Path::new(relative).is_absolute() {
        return Err("Cache path must be a safe relative path.".to_string());
    }
    Ok(cache_root(app)?.join(relative.replace('\\', "/")))
}

fn directory_size(path: &Path) -> Result<u64, String> {
    let mut total = 0;
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if metadata.is_dir() {
            total += directory_size(&entry.path())?;
        } else {
            total += metadata.len();
        }
    }
    Ok(total)
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
