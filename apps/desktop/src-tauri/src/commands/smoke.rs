use crate::path_validator::{authorize_existing_path, authorize_path_for_write};
use serde::Serialize;
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSmokeConfig {
    enabled: bool,
    fixture_name: Option<String>,
    media_path: String,
    proxy_media_path: Option<String>,
    report_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelSmokeConfig {
    enabled: bool,
    media_path: String,
    output_path: String,
    report_path: String,
}

#[tauri::command]
pub fn get_preview_smoke_config(app: AppHandle) -> Result<Option<PreviewSmokeConfig>, String> {
    if std::env::var("OPEN_FACTORY_PREVIEW_SMOKE").ok().as_deref() != Some("1") {
        return Ok(None);
    }
    let media_path = std::env::var("OPEN_FACTORY_PREVIEW_SMOKE_MEDIA")
        .map_err(|_| "OPEN_FACTORY_PREVIEW_SMOKE_MEDIA is required".to_string())?;
    let proxy_media_path = std::env::var("OPEN_FACTORY_PREVIEW_SMOKE_PROXY_MEDIA")
        .ok()
        .map(normalize_path);
    let fixture_name = std::env::var("OPEN_FACTORY_PREVIEW_SMOKE_FIXTURE_NAME").ok();
    let report_path = std::env::var("OPEN_FACTORY_PREVIEW_SMOKE_REPORT")
        .map_err(|_| "OPEN_FACTORY_PREVIEW_SMOKE_REPORT is required".to_string())?;
    authorize_existing_path(&app, Path::new(&media_path))?;
    if let Some(path) = &proxy_media_path {
        authorize_existing_path(&app, Path::new(path))?;
    }
    authorize_path_for_write(&app, Path::new(&report_path))?;
    Ok(Some(PreviewSmokeConfig {
        enabled: true,
        fixture_name,
        media_path: normalize_path(media_path),
        proxy_media_path,
        report_path: normalize_path(report_path),
    }))
}

#[tauri::command]
pub fn get_cancel_smoke_config(app: AppHandle) -> Result<Option<CancelSmokeConfig>, String> {
    if std::env::var("OPEN_FACTORY_CANCEL_SMOKE").ok().as_deref() != Some("1") {
        return Ok(None);
    }
    let media_path = std::env::var("OPEN_FACTORY_CANCEL_SMOKE_MEDIA")
        .map_err(|_| "OPEN_FACTORY_CANCEL_SMOKE_MEDIA is required".to_string())?;
    let output_path = std::env::var("OPEN_FACTORY_CANCEL_SMOKE_OUTPUT")
        .map_err(|_| "OPEN_FACTORY_CANCEL_SMOKE_OUTPUT is required".to_string())?;
    let report_path = std::env::var("OPEN_FACTORY_CANCEL_SMOKE_REPORT")
        .map_err(|_| "OPEN_FACTORY_CANCEL_SMOKE_REPORT is required".to_string())?;
    authorize_existing_path(&app, Path::new(&media_path))?;
    authorize_path_for_write(&app, Path::new(&output_path))?;
    authorize_path_for_write(&app, Path::new(&report_path))?;
    Ok(Some(CancelSmokeConfig {
        enabled: true,
        media_path: normalize_path(media_path),
        output_path: normalize_path(output_path),
        report_path: normalize_path(report_path),
    }))
}

fn normalize_path(path: String) -> String {
    path.replace('\\', "/")
}
