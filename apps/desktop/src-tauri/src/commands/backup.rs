use crate::path_validator::validate_path;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const SECRET_FILE_NAME: &str = "backup-secrets.json";
const EXPORT_UPLOAD_SECRET_FILE_NAME: &str = "export-upload-secrets.json";
const EXPORT_PRESET_SYNC_SECRET_FILE_NAME: &str = "export-preset-sync-secrets.json";
const EXPORT_HISTORY_FILE_NAME: &str = "export-history.json";
const WEBDAV_HTTPS_REQUIRED_ERROR: &str = "WebDAV 连接需要使用 HTTPS（仅 localhost 允许 HTTP）";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavProjectBackupRequest {
    url: String,
    username: Option<String>,
    password: Option<String>,
    project_path: String,
    contents: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavProjectBackupResult {
    status: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavExportUploadRequest {
    url: String,
    username: Option<String>,
    password: Option<String>,
    source_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavExportUploadResult {
    status: u16,
    bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavTextRequest {
    url: String,
    username: Option<String>,
    password: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavTextPutRequest {
    url: String,
    username: Option<String>,
    password: Option<String>,
    contents: String,
    content_type: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavTextResult {
    status: u16,
    contents: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavTextPutResult {
    status: u16,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WebdavPutArgs {
    method: &'static str,
    url: String,
    username: Option<String>,
    password_present: bool,
    content_type: String,
    content_len: usize,
    project_path: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WebdavExportPutArgs {
    method: &'static str,
    url: String,
    username: Option<String>,
    password_present: bool,
    content_type: String,
    content_len: u64,
    source_path: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WebdavTextGetArgs {
    method: &'static str,
    url: String,
    username: Option<String>,
    password_present: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WebdavTextPutArgs {
    method: &'static str,
    url: String,
    username: Option<String>,
    password_present: bool,
    content_type: String,
    content_len: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupSecretFile {
    version: u8,
    nonce: String,
    ciphertext: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportHistoryWhitelistEntry {
    output_path: String,
    status: String,
}

#[tauri::command]
pub async fn put_webdav_project(
    request: WebdavProjectBackupRequest,
) -> Result<WebdavProjectBackupResult, String> {
    let args = build_webdav_put_args(&request)?;
    let client = reqwest::Client::new();
    let mut builder = client
        .put(&args.url)
        .header(reqwest::header::CONTENT_TYPE, args.content_type)
        .body(request.contents);
    if let Some(username) = request.username.filter(|value| !value.trim().is_empty()) {
        builder = builder.basic_auth(username, request.password);
    }
    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("WebDAV PUT failed with status {}", status.as_u16()));
    }
    Ok(WebdavProjectBackupResult {
        status: status.as_u16(),
    })
}

#[tauri::command]
pub async fn put_webdav_export_file(
    app: AppHandle,
    request: WebdavExportUploadRequest,
) -> Result<WebdavExportUploadResult, String> {
    let source_path = validate_webdav_export_upload_source(&app, &request.source_path)?;
    let bytes = fs::read(&source_path)
        .map_err(|error| format!("Unable to read export file for upload: {}", error))?;
    let args = build_webdav_export_put_args(&request, bytes.len() as u64)?;
    let client = reqwest::Client::new();
    let mut builder = client
        .put(&args.url)
        .header(reqwest::header::CONTENT_TYPE, args.content_type)
        .body(bytes);
    if let Some(username) = request.username.filter(|value| !value.trim().is_empty()) {
        builder = builder.basic_auth(username, request.password);
    }
    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "WebDAV export upload failed with status {}",
            status.as_u16()
        ));
    }
    Ok(WebdavExportUploadResult {
        status: status.as_u16(),
        bytes: args.content_len,
    })
}

fn validate_webdav_export_upload_source(
    app: &AppHandle,
    source_path: &str,
) -> Result<PathBuf, String> {
    let history_path = export_history_path(app)?;
    validate_webdav_export_upload_source_with_history(source_path, &history_path, |path| {
        validate_path(app, path)
    })
}

fn validate_webdav_export_upload_source_with_history(
    source_path: &str,
    history_path: &Path,
    validate_source_path: impl FnOnce(&Path) -> Result<PathBuf, String>,
) -> Result<PathBuf, String> {
    if source_path.trim().is_empty() {
        return Err("Export upload source path is required.".to_string());
    }
    let safe_path = validate_source_path(Path::new(source_path))?;
    ensure_completed_export_history_output_path(history_path, &safe_path)?;
    Ok(safe_path)
}

fn ensure_completed_export_history_output_path(
    history_path: &Path,
    source_path: &Path,
) -> Result<(), String> {
    let raw = fs::read_to_string(history_path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "Export upload source path is not a completed export history output.".to_string()
        } else {
            format!("Unable to read export history: {}", error)
        }
    })?;
    let entries: Vec<ExportHistoryWhitelistEntry> = serde_json::from_str(&raw)
        .map_err(|error| format!("Unable to parse export history: {}", error))?;
    let is_completed_export = entries.iter().any(|entry| {
        entry.status == "success"
            && fs::canonicalize(Path::new(&entry.output_path))
                .is_ok_and(|output_path| output_path == source_path)
    });
    if is_completed_export {
        Ok(())
    } else {
        Err("Export upload source path is not a completed export history output.".to_string())
    }
}

#[tauri::command]
pub async fn get_webdav_text(request: WebdavTextRequest) -> Result<WebdavTextResult, String> {
    let args = build_webdav_text_get_args(&request)?;
    let client = reqwest::Client::new();
    let mut builder = client.get(&args.url);
    if let Some(username) = request.username.filter(|value| !value.trim().is_empty()) {
        builder = builder.basic_auth(username, request.password);
    }
    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("WebDAV GET failed with status {}", status.as_u16()));
    }
    let contents = response.text().await.map_err(|error| error.to_string())?;
    Ok(WebdavTextResult {
        status: status.as_u16(),
        contents,
    })
}

#[tauri::command]
pub async fn put_webdav_text(request: WebdavTextPutRequest) -> Result<WebdavTextPutResult, String> {
    let args = build_webdav_text_put_args(&request)?;
    let client = reqwest::Client::new();
    let mut builder = client
        .put(&args.url)
        .header(reqwest::header::CONTENT_TYPE, args.content_type)
        .body(request.contents);
    if let Some(username) = request.username.filter(|value| !value.trim().is_empty()) {
        builder = builder.basic_auth(username, request.password);
    }
    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "WebDAV PUT text failed with status {}",
            status.as_u16()
        ));
    }
    Ok(WebdavTextPutResult {
        status: status.as_u16(),
    })
}

#[tauri::command]
pub fn read_webdav_password(app: AppHandle) -> Result<Option<String>, String> {
    read_password_secret(app, SECRET_FILE_NAME)
}

#[tauri::command]
pub fn write_webdav_password(app: AppHandle, password: Option<String>) -> Result<(), String> {
    write_password_secret(app, SECRET_FILE_NAME, password)
}

#[tauri::command]
pub fn read_export_upload_webdav_password(app: AppHandle) -> Result<Option<String>, String> {
    read_password_secret(app, EXPORT_UPLOAD_SECRET_FILE_NAME)
}

#[tauri::command]
pub fn write_export_upload_webdav_password(
    app: AppHandle,
    password: Option<String>,
) -> Result<(), String> {
    write_password_secret(app, EXPORT_UPLOAD_SECRET_FILE_NAME, password)
}

#[tauri::command]
pub fn read_export_preset_sync_webdav_password(app: AppHandle) -> Result<Option<String>, String> {
    read_password_secret(app, EXPORT_PRESET_SYNC_SECRET_FILE_NAME)
}

#[tauri::command]
pub fn write_export_preset_sync_webdav_password(
    app: AppHandle,
    password: Option<String>,
) -> Result<(), String> {
    write_password_secret(app, EXPORT_PRESET_SYNC_SECRET_FILE_NAME, password)
}

fn read_password_secret(app: AppHandle, file_name: &str) -> Result<Option<String>, String> {
    let secret_path = secret_file_path(&app, file_name)?;
    if !secret_path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&secret_path)
        .map_err(|error| format!("Unable to read backup secret: {}", error))?;
    let secret: BackupSecretFile = serde_json::from_str(&raw)
        .map_err(|error| format!("Unable to parse backup secret: {}", error))?;
    decrypt_password(&app_data_dir(&app)?, &secret).map(Some)
}

fn write_password_secret(
    app: AppHandle,
    file_name: &str,
    password: Option<String>,
) -> Result<(), String> {
    let secret_path = secret_file_path(&app, file_name)?;
    match password
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        Some(password) => {
            let app_dir = app_data_dir(&app)?;
            let secret = encrypt_password(&app_dir, &password)?;
            fs::write(
                &secret_path,
                serde_json::to_string_pretty(&secret).map_err(|error| error.to_string())?,
            )
            .map_err(|error| format!("Unable to write backup secret: {}", error))
        }
        None => match fs::remove_file(&secret_path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("Unable to remove backup secret: {}", error)),
        },
    }
}

pub fn build_webdav_put_args(
    request: &WebdavProjectBackupRequest,
) -> Result<WebdavPutArgs, String> {
    let parsed = parse_webdav_http_url(&request.url)?;
    if request.contents.is_empty() {
        return Err("Project backup contents are empty.".to_string());
    }
    Ok(WebdavPutArgs {
        method: "PUT",
        url: parsed.to_string(),
        username: request
            .username
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        password_present: request
            .password
            .as_ref()
            .is_some_and(|value| !value.is_empty()),
        content_type: "application/json".to_string(),
        content_len: request.contents.len(),
        project_path: request.project_path.clone(),
    })
}

pub fn build_webdav_export_put_args(
    request: &WebdavExportUploadRequest,
    content_len: u64,
) -> Result<WebdavExportPutArgs, String> {
    let parsed = parse_webdav_http_url(&request.url)?;
    if request.source_path.trim().is_empty() {
        return Err("Export upload source path is required.".to_string());
    }
    Ok(WebdavExportPutArgs {
        method: "PUT",
        url: parsed.to_string(),
        username: request
            .username
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        password_present: request
            .password
            .as_ref()
            .is_some_and(|value| !value.is_empty()),
        content_type: "application/octet-stream".to_string(),
        content_len,
        source_path: request.source_path.clone(),
    })
}

pub fn build_webdav_text_get_args(
    request: &WebdavTextRequest,
) -> Result<WebdavTextGetArgs, String> {
    let parsed = parse_webdav_http_url(&request.url)?;
    Ok(WebdavTextGetArgs {
        method: "GET",
        url: parsed.to_string(),
        username: request
            .username
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        password_present: request
            .password
            .as_ref()
            .is_some_and(|value| !value.is_empty()),
    })
}

pub fn build_webdav_text_put_args(
    request: &WebdavTextPutRequest,
) -> Result<WebdavTextPutArgs, String> {
    let parsed = parse_webdav_http_url(&request.url)?;
    if request.contents.is_empty() {
        return Err("WebDAV text contents are empty.".to_string());
    }
    Ok(WebdavTextPutArgs {
        method: "PUT",
        url: parsed.to_string(),
        username: request
            .username
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        password_present: request
            .password
            .as_ref()
            .is_some_and(|value| !value.is_empty()),
        content_type: request
            .content_type
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "text/plain; charset=utf-8".to_string()),
        content_len: request.contents.len(),
    })
}

fn parse_webdav_http_url(url: &str) -> Result<reqwest::Url, String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("WebDAV URL is required.".to_string());
    }
    let parsed = reqwest::Url::parse(url).map_err(|error| error.to_string())?;
    match parsed.scheme() {
        "https" => Ok(parsed),
        "http" if is_local_http_webdav_url(&parsed) => Ok(parsed),
        "http" => Err(WEBDAV_HTTPS_REQUIRED_ERROR.to_string()),
        _ => Err("WebDAV URL must use http or https.".to_string()),
    }
}

fn is_local_http_webdav_url(url: &reqwest::Url) -> bool {
    url.host_str()
        .is_some_and(|host| host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1")
}

fn encrypt_password(app_dir: &Path, password: &str) -> Result<BackupSecretFile, String> {
    let key = derive_secret_key(app_dir);
    let nonce = derive_nonce(password);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|error| error.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), password.as_bytes())
        .map_err(|error| format!("Unable to encrypt backup secret: {:?}", error))?;
    Ok(BackupSecretFile {
        version: 1,
        nonce: general_purpose::STANDARD.encode(nonce),
        ciphertext: general_purpose::STANDARD.encode(ciphertext),
    })
}

fn decrypt_password(app_dir: &Path, secret: &BackupSecretFile) -> Result<String, String> {
    if secret.version != 1 {
        return Err("Unsupported backup secret version.".to_string());
    }
    let key = derive_secret_key(app_dir);
    let nonce = general_purpose::STANDARD
        .decode(&secret.nonce)
        .map_err(|error| error.to_string())?;
    let ciphertext = general_purpose::STANDARD
        .decode(&secret.ciphertext)
        .map_err(|error| error.to_string())?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|error| error.to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_slice())
        .map_err(|error| format!("Unable to decrypt backup secret: {:?}", error))?;
    String::from_utf8(plaintext).map_err(|error| error.to_string())
}

fn derive_secret_key(app_dir: &Path) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"open-factory:webdav-backup-password:v1");
    hasher.update(app_dir.to_string_lossy().as_bytes());
    hasher.finalize().into()
}

fn derive_nonce(password: &str) -> [u8; 12] {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(now.to_le_bytes());
    hasher.update(std::process::id().to_le_bytes());
    hasher.update(password.len().to_le_bytes());
    let digest = hasher.finalize();
    let mut nonce = [0u8; 12];
    nonce.copy_from_slice(&digest[..12]);
    nonce
}

fn export_history_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(EXPORT_HISTORY_FILE_NAME))
}

fn secret_file_path(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(file_name))
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::path_validator::{PathValidator, PATH_NOT_ALLOWED};

    #[test]
    fn builds_webdav_put_args_for_basic_auth_json_upload() {
        let args = build_webdav_put_args(&WebdavProjectBackupRequest {
            url: "https://dav.example.test/projects/demo.cutproj.json".to_string(),
            username: Some("editor".to_string()),
            password: Some("secret".to_string()),
            project_path: "C:/Projects/demo.cutproj.json".to_string(),
            contents: "{\"schemaVersion\":2}".to_string(),
        })
        .unwrap();

        assert_eq!(args.method, "PUT");
        assert_eq!(
            args.url,
            "https://dav.example.test/projects/demo.cutproj.json"
        );
        assert_eq!(args.username, Some("editor".to_string()));
        assert!(args.password_present);
        assert_eq!(args.content_type, "application/json");
        assert_eq!(args.content_len, 19);
        assert_eq!(args.project_path, "C:/Projects/demo.cutproj.json");
    }

    #[test]
    fn rejects_non_http_webdav_urls() {
        let error = build_webdav_put_args(&WebdavProjectBackupRequest {
            url: "file:///tmp/demo.cutproj.json".to_string(),
            username: None,
            password: None,
            project_path: "demo.cutproj.json".to_string(),
            contents: "{}".to_string(),
        })
        .unwrap_err();

        assert!(error.contains("http or https"));
    }

    #[test]
    fn allows_https_webdav_urls() {
        let parsed = parse_webdav_http_url("https://dav.example.test/backups/demo.cutproj.json")
            .expect("https should be accepted");

        assert_eq!(parsed.scheme(), "https");
        assert_eq!(parsed.host_str(), Some("dav.example.test"));
    }

    #[test]
    fn allows_local_http_webdav_urls_for_debugging() {
        for url in [
            "http://localhost:8080/backups/demo.cutproj.json",
            "http://127.0.0.1:8080/backups/demo.cutproj.json",
        ] {
            let parsed = parse_webdav_http_url(url).expect("local http should be accepted");

            assert_eq!(parsed.scheme(), "http");
        }
    }

    #[test]
    fn rejects_remote_http_webdav_urls() {
        let error =
            parse_webdav_http_url("http://dav.example.test/backups/demo.cutproj.json").unwrap_err();

        assert_eq!(error, WEBDAV_HTTPS_REQUIRED_ERROR);
    }

    #[test]
    fn builds_webdav_export_put_args_for_file_upload() {
        let args = build_webdav_export_put_args(
            &WebdavExportUploadRequest {
                url: "https://dav.example.test/exports/render.mp4".to_string(),
                username: Some("editor".to_string()),
                password: Some("secret".to_string()),
                source_path: "C:/Exports/render.mp4".to_string(),
            },
            4096,
        )
        .unwrap();

        assert_eq!(args.method, "PUT");
        assert_eq!(args.url, "https://dav.example.test/exports/render.mp4");
        assert_eq!(args.username, Some("editor".to_string()));
        assert!(args.password_present);
        assert_eq!(args.content_type, "application/octet-stream");
        assert_eq!(args.content_len, 4096);
        assert_eq!(args.source_path, "C:/Exports/render.mp4");
    }

    #[test]
    fn rejects_missing_export_upload_source_path() {
        let error = build_webdav_export_put_args(
            &WebdavExportUploadRequest {
                url: "https://dav.example.test/exports/render.mp4".to_string(),
                username: None,
                password: None,
                source_path: " ".to_string(),
            },
            1,
        )
        .unwrap_err();

        assert!(error.contains("source path"));
    }

    #[test]
    fn rejects_export_upload_source_outside_path_allowlist() {
        let root = test_root("rejects-unauthorized-upload-source");
        fs::create_dir_all(&root).expect("create test root");
        let history_path = root.join("export-history.json");
        let unauthorized_path = platform_unauthorized_path();
        write_export_history(&history_path, &[(&unauthorized_path, "success")]);
        let validator = PathValidator::default();

        let error = validate_webdav_export_upload_source_with_history(
            &path_to_string(&unauthorized_path),
            &history_path,
            |path| validator.validate_path(path),
        )
        .unwrap_err();

        assert_eq!(error, PATH_NOT_ALLOWED);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_authorized_export_upload_source_without_completed_history() {
        let root = test_root("rejects-upload-source-missing-success-history");
        let export_dir = root.join("exports");
        fs::create_dir_all(&export_dir).expect("create export dir");
        let output_path = export_dir.join("render.mp4");
        fs::write(&output_path, b"render").expect("write export");
        let mut validator = PathValidator::default();
        validator
            .allow_existing_path(&output_path)
            .expect("authorize export");
        let history_path = root.join("export-history.json");
        write_export_history(&history_path, &[(&output_path, "error")]);

        let error = validate_webdav_export_upload_source_with_history(
            &path_to_string(&output_path),
            &history_path,
            |path| validator.validate_path(path),
        )
        .unwrap_err();

        assert!(error.contains("completed export history"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn allows_authorized_completed_export_history_output_source() {
        let root = test_root("allows-completed-upload-source");
        let export_dir = root.join("exports");
        fs::create_dir_all(&export_dir).expect("create export dir");
        let output_path = export_dir.join("render.mp4");
        fs::write(&output_path, b"render").expect("write export");
        let mut validator = PathValidator::default();
        validator
            .allow_existing_path(&output_path)
            .expect("authorize export");
        let history_path = root.join("export-history.json");
        write_export_history(&history_path, &[(&output_path, "success")]);

        let validated = validate_webdav_export_upload_source_with_history(
            &path_to_string(&output_path),
            &history_path,
            |path| validator.validate_path(path),
        )
        .expect("validate completed export");

        assert_eq!(
            validated,
            output_path.canonicalize().expect("canonical export")
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn builds_webdav_text_get_args_for_preset_sync() {
        let args = build_webdav_text_get_args(&WebdavTextRequest {
            url: "https://dav.example.test/presets/export.ofpreset.json".to_string(),
            username: Some(" editor ".to_string()),
            password: Some("secret".to_string()),
        })
        .unwrap();

        assert_eq!(args.method, "GET");
        assert_eq!(
            args.url,
            "https://dav.example.test/presets/export.ofpreset.json"
        );
        assert_eq!(args.username, Some("editor".to_string()));
        assert!(args.password_present);
    }

    #[test]
    fn builds_webdav_text_put_args_for_json_package() {
        let args = build_webdav_text_put_args(&WebdavTextPutRequest {
            url: "https://dav.example.test/presets/export.ofpreset.json".to_string(),
            username: None,
            password: None,
            contents: "{\"version\":1}".to_string(),
            content_type: Some(" application/json ".to_string()),
        })
        .unwrap();

        assert_eq!(args.method, "PUT");
        assert_eq!(args.content_type, "application/json");
        assert_eq!(args.content_len, 13);
        assert!(!args.password_present);
    }

    #[test]
    fn builds_webdav_text_get_args_without_optional_credentials() {
        let args = build_webdav_text_get_args(&WebdavTextRequest {
            url: " https://dav.example.test/presets/export.ofpreset.json ".to_string(),
            username: Some(" ".to_string()),
            password: Some("".to_string()),
        })
        .unwrap();

        assert_eq!(args.method, "GET");
        assert_eq!(
            args.url,
            "https://dav.example.test/presets/export.ofpreset.json"
        );
        assert_eq!(args.username, None);
        assert!(!args.password_present);
    }

    #[test]
    fn builds_webdav_text_put_args_with_default_text_content_type() {
        let args = build_webdav_text_put_args(&WebdavTextPutRequest {
            url: "https://dav.example.test/presets/export.ofpreset.json".to_string(),
            username: Some("editor".to_string()),
            password: Some("secret".to_string()),
            contents: "preset package".to_string(),
            content_type: Some(" ".to_string()),
        })
        .unwrap();

        assert_eq!(args.method, "PUT");
        assert_eq!(args.username, Some("editor".to_string()));
        assert!(args.password_present);
        assert_eq!(args.content_type, "text/plain; charset=utf-8");
        assert_eq!(args.content_len, "preset package".len());
    }

    #[test]
    fn rejects_empty_webdav_text_put_contents() {
        let error = build_webdav_text_put_args(&WebdavTextPutRequest {
            url: "https://dav.example.test/presets/export.ofpreset.json".to_string(),
            username: None,
            password: None,
            contents: String::new(),
            content_type: Some("application/json".to_string()),
        })
        .unwrap_err();

        assert!(error.contains("contents are empty"));
    }

    #[test]
    fn rejects_non_http_webdav_text_urls() {
        let error = build_webdav_text_get_args(&WebdavTextRequest {
            url: "file:///tmp/export.ofpreset.json".to_string(),
            username: None,
            password: None,
        })
        .unwrap_err();

        assert!(error.contains("http or https"));
    }

    #[test]
    fn encrypts_password_without_storing_plaintext() {
        let app_dir = std::env::temp_dir().join("open-factory-backup-secret-test");
        let secret = encrypt_password(&app_dir, "super-secret").unwrap();
        let serialized = serde_json::to_string(&secret).unwrap();

        assert!(!serialized.contains("super-secret"));
        assert_eq!(decrypt_password(&app_dir, &secret).unwrap(), "super-secret");
        let _ = fs::remove_dir_all(app_dir);
    }

    #[test]
    fn export_upload_password_uses_same_encrypted_secret_format() {
        let app_dir = std::env::temp_dir().join("open-factory-export-upload-secret-test");
        let secret = encrypt_password(&app_dir, "upload-secret").unwrap();
        let serialized = serde_json::to_string(&secret).unwrap();

        assert!(!serialized.contains("upload-secret"));
        assert_eq!(secret.version, 1);
        assert_eq!(
            decrypt_password(&app_dir, &secret).unwrap(),
            "upload-secret"
        );
        let _ = fs::remove_dir_all(app_dir);
    }

    #[test]
    fn export_preset_sync_password_uses_same_encrypted_secret_format() {
        let app_dir = std::env::temp_dir().join("open-factory-export-preset-sync-secret-test");
        let secret = encrypt_password(&app_dir, "preset-sync-secret").unwrap();
        let serialized = serde_json::to_string(&secret).unwrap();

        assert!(!serialized.contains("preset-sync-secret"));
        assert_eq!(secret.version, 1);
        assert_eq!(
            decrypt_password(&app_dir, &secret).unwrap(),
            "preset-sync-secret"
        );
        let _ = fs::remove_dir_all(app_dir);
    }

    fn test_root(name: &str) -> PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("open-factory-backup-{name}-{id}"))
    }

    fn platform_unauthorized_path() -> PathBuf {
        if cfg!(windows) {
            PathBuf::from(r"C:\Windows\System32")
        } else {
            PathBuf::from("/etc/passwd")
        }
    }

    fn path_to_string(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    fn write_export_history(history_path: &Path, entries: &[(&Path, &str)]) {
        let payload: Vec<serde_json::Value> = entries
            .iter()
            .enumerate()
            .map(|(index, (output_path, status))| {
                serde_json::json!({
                    "id": format!("history-{index}"),
                    "name": "Render",
                    "outputPath": path_to_string(output_path),
                    "status": status,
                    "priority": "normal",
                    "createdAt": "2026-06-16T00:00:00.000Z",
                    "finishedAt": "2026-06-16T00:00:01.000Z"
                })
            })
            .collect();
        fs::write(
            history_path,
            serde_json::to_string_pretty(&payload).expect("serialize history"),
        )
        .expect("write export history");
    }
}
