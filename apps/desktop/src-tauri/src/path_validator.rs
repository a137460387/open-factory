use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};

pub const PATH_NOT_ALLOWED: &str = "path_not_allowed";

static SESSION_ALLOWED_PATHS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

fn session_allowed_paths() -> &'static Mutex<HashSet<PathBuf>> {
    SESSION_ALLOWED_PATHS.get_or_init(|| Mutex::new(HashSet::new()))
}

#[derive(Debug, Default, Clone)]
pub struct PathValidator {
    allowed_paths: HashSet<PathBuf>,
}

impl PathValidator {
    pub fn allow_existing_path(&mut self, path: impl AsRef<Path>) -> Result<PathBuf, String> {
        let resolved = resolve_existing_path(path.as_ref())?;
        self.allowed_paths.insert(resolved.clone());
        Ok(resolved)
    }

    pub fn allow_path_for_write(&mut self, path: impl AsRef<Path>) -> Result<PathBuf, String> {
        let resolved = resolve_creatable_path(path.as_ref())?;
        self.allowed_paths.insert(resolved.clone());
        Ok(resolved)
    }

    pub fn validate_path(&self, path: impl AsRef<Path>) -> Result<PathBuf, String> {
        let resolved = resolve_existing_path(path.as_ref())?;
        self.ensure_allowed(&resolved)
    }

    pub fn validate_path_for_write(&self, path: impl AsRef<Path>) -> Result<PathBuf, String> {
        let resolved = resolve_creatable_path(path.as_ref())?;
        self.ensure_allowed(&resolved)
    }

    fn ensure_allowed(&self, resolved: &Path) -> Result<PathBuf, String> {
        if self
            .allowed_paths
            .iter()
            .any(|allowed| resolved == allowed || resolved.starts_with(allowed))
        {
            Ok(resolved.to_path_buf())
        } else {
            Err(PATH_NOT_ALLOWED.to_string())
        }
    }
}

pub fn authorize_existing_path(app: &AppHandle, path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let resolved = resolve_existing_path(path.as_ref())?;
    authorize_resolved_path(app, resolved)
}

pub fn authorize_path_for_write(
    app: &AppHandle,
    path: impl AsRef<Path>,
) -> Result<PathBuf, String> {
    let resolved = resolve_creatable_path(path.as_ref())?;
    authorize_resolved_path(app, resolved)
}

pub fn validate_path(app: &AppHandle, path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let resolved = resolve_existing_path(path.as_ref())?;
    ensure_runtime_allowed(app, &resolved)
}

pub fn validate_path_for_write(app: &AppHandle, path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let resolved = resolve_creatable_path(path.as_ref())?;
    ensure_runtime_allowed(app, &resolved)
}

fn authorize_resolved_path(app: &AppHandle, resolved: PathBuf) -> Result<PathBuf, String> {
    let mut allowed = session_allowed_paths()
        .lock()
        .map_err(|_| "Unable to lock path allowlist".to_string())?;
    allowed.insert(resolved.clone());
    drop(allowed);
    ensure_runtime_allowed(app, &resolved)
}

fn ensure_runtime_allowed(app: &AppHandle, resolved: &Path) -> Result<PathBuf, String> {
    let allowed_paths = runtime_allowed_paths(app)?;
    if allowed_paths
        .iter()
        .any(|allowed| resolved == allowed || resolved.starts_with(allowed))
    {
        Ok(resolved.to_path_buf())
    } else {
        Err(PATH_NOT_ALLOWED.to_string())
    }
}

fn runtime_allowed_paths(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut allowed = Vec::new();
    for path in [app.path().app_data_dir(), app.path().app_cache_dir()] {
        let path = path.map_err(|error| error.to_string())?;
        fs::create_dir_all(&path).map_err(|error| error.to_string())?;
        allowed.push(fs::canonicalize(&path).map_err(|_| PATH_NOT_ALLOWED.to_string())?);
    }
    let session_paths = session_allowed_paths()
        .lock()
        .map_err(|_| "Unable to lock path allowlist".to_string())?;
    allowed.extend(session_paths.iter().cloned());
    Ok(allowed)
}

fn resolve_existing_path(path: &Path) -> Result<PathBuf, String> {
    reject_unsafe_path(path)?;
    fs::canonicalize(path).map_err(|_| PATH_NOT_ALLOWED.to_string())
}

fn resolve_creatable_path(path: &Path) -> Result<PathBuf, String> {
    reject_unsafe_path(path)?;
    if path.exists() {
        return fs::canonicalize(path).map_err(|_| PATH_NOT_ALLOWED.to_string());
    }

    let mut missing = Vec::new();
    let mut current = path;
    while !current.exists() {
        let name = current
            .file_name()
            .ok_or_else(|| PATH_NOT_ALLOWED.to_string())?;
        missing.push(name.to_os_string());
        current = current
            .parent()
            .ok_or_else(|| PATH_NOT_ALLOWED.to_string())?;
    }

    let mut resolved = fs::canonicalize(current).map_err(|_| PATH_NOT_ALLOWED.to_string())?;
    for component in missing.iter().rev() {
        resolved.push(component);
    }
    Ok(resolved)
}

fn reject_unsafe_path(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() || !path.is_absolute() {
        return Err(PATH_NOT_ALLOWED.to_string());
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(PATH_NOT_ALLOWED.to_string());
    }
    Ok(())
}
