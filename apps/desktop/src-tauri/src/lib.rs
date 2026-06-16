mod commands;
pub mod path_validator;

use serde_json::json;
use std::fs;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;

static CLOSE_ALLOWED: OnceLock<Mutex<bool>> = OnceLock::new();

fn close_allowed() -> &'static Mutex<bool> {
    CLOSE_ALLOWED.get_or_init(|| Mutex::new(false))
}

#[tauri::command]
fn force_close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    *close_allowed()
        .lock()
        .map_err(|_| "Unable to lock close state".to_string())? = true;
    window.close().map_err(|error| error.to_string())
}

#[tauri::command]
fn send_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .on_page_load(|_window, payload| {
            write_frontend_smoke_page_load_marker(
                "OPEN_FACTORY_PREVIEW_SMOKE",
                "OPEN_FACTORY_PREVIEW_SMOKE_REPORT",
                "preview",
                payload.url().as_str(),
                format!("{:?}", payload.event()),
            );
            write_frontend_smoke_page_load_marker(
                "OPEN_FACTORY_CANCEL_SMOKE",
                "OPEN_FACTORY_CANCEL_SMOKE_REPORT",
                "cancel",
                payload.url().as_str(),
                format!("{:?}", payload.event()),
            );
        })
        .invoke_handler(tauri::generate_handler![
            commands::ffmpeg::detect_ffmpeg,
            commands::ffmpeg::get_ffmpeg_capabilities,
            commands::ffmpeg::get_available_memory_bytes,
            commands::ffmpeg::get_system_resource_snapshot,
            commands::ffmpeg::analyze_clip,
            commands::ffmpeg::analyze_motion_track,
            commands::ffmpeg::evaluate_export_quality,
            commands::ffmpeg::run_export,
            commands::ffmpeg::run_export_preview_samples,
            commands::ffmpeg::cancel_export,
            commands::ffmpeg::cancel_motion_tracking,
            commands::ffmpeg::cancel_quality_evaluation,
            commands::gif::export_media_gif,
            commands::gif::generate_gif_preview,
            commands::files::open_file_dialog,
            commands::files::save_file_dialog,
            commands::files::open_directory_dialog,
            commands::files::authorize_paths,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::remove_file,
            commands::files::copy_file,
            commands::files::fs_exists,
            commands::files::get_app_data_dir,
            commands::files::get_temp_segments_dir,
            commands::files::get_file_stat,
            commands::files::scan_directory,
            commands::project_crypto::encrypt_project_file,
            commands::project_crypto::decrypt_project_file,
            commands::project_crypto::is_encrypted_project_file,
            commands::cache::get_cache_dir,
            commands::cache::ensure_cache_dirs,
            commands::cache::read_cache,
            commands::cache::write_cache,
            commands::cache::remove_cache_file,
            commands::cache::clear_cache,
            commands::cache::get_cache_size,
            commands::media::probe_media,
            commands::media::analyze_media,
            commands::media::scan_media_integrity,
            commands::media::analyze_audio_spectrum,
            commands::media::analyze_waveform,
            commands::media::detect_silence,
            commands::media::detect_beats,
            commands::media::generate_gap_fill_media,
            commands::media::extract_cover_frames,
            commands::media::batch_extract_cover_frames,
            commands::privacy::detect_privacy_regions,
            commands::preview_window::open_preview_window,
            commands::preview_window::close_preview_window,
            commands::preview_window::get_preview_window_state,
            commands::preview_window::set_preview_window_always_on_top,
            commands::preview_window::set_preview_window_fullscreen,
            commands::preview_window::set_preview_window_resolution_scale,
            commands::proxy::generate_proxy,
            commands::scene::detect_scene_changes,
            commands::secrets::read_translation_api_key,
            commands::secrets::write_translation_api_key,
            commands::share::create_share_package,
            commands::backup::put_webdav_project,
            commands::backup::put_webdav_export_file,
            commands::backup::get_webdav_text,
            commands::backup::put_webdav_text,
            commands::backup::read_webdav_password,
            commands::backup::write_webdav_password,
            commands::backup::read_export_upload_webdav_password,
            commands::backup::write_export_upload_webdav_password,
            commands::backup::read_export_preset_sync_webdav_password,
            commands::backup::write_export_preset_sync_webdav_password,
            commands::background::minimize_to_tray,
            commands::background::show_main_window,
            commands::background::update_export_tray_progress,
            commands::background::run_export_power_action,
            commands::transcode::batch_transcode_media,
            commands::transcode::cancel_batch_transcode_task,
            commands::demucs::run_demucs,
            commands::demucs::cancel_demucs,
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::reports::write_clip_report,
            commands::whisper::run_whisper,
            commands::smoke::get_preview_smoke_config,
            commands::smoke::get_cancel_smoke_config,
            send_notification,
            force_close_window
        ])
        .setup(|app| {
            let window_exists = app.get_webview_window("main").is_some();
            if let Some(window) = app.get_webview_window("main") {
                let window_for_event = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let allowed = close_allowed().lock().map(|state| *state).unwrap_or(false);
                        if !allowed {
                            api.prevent_close();
                            let _ = window_for_event.emit("close-requested", ());
                        }
                    }
                });
            }
            if std::env::var("OPEN_FACTORY_SMOKE").ok().as_deref() == Some("1") {
                let report_path = std::env::var("OPEN_FACTORY_SMOKE_REPORT")
                    .unwrap_or_else(|_| "open-factory-smoke-report.json".to_string());
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let output = Command::new(commands::binaries::ffmpeg_binary())
                        .arg("-version")
                        .output();
                    let ffmpeg_available =
                        output.as_ref().is_ok_and(|result| result.status.success());
                    let ffmpeg_version = output
                        .ok()
                        .and_then(|result| String::from_utf8(result.stdout).ok())
                        .and_then(|text| text.lines().next().map(ToOwned::to_owned));
                    let report = json!({
                        "windowExists": window_exists,
                        "ffmpegAvailable": ffmpeg_available,
                        "ffmpegVersion": ffmpeg_version,
                    });
                    let _ = fs::write(
                        &report_path,
                        serde_json::to_string_pretty(&report).unwrap_or_default(),
                    );
                    handle.exit(if window_exists && ffmpeg_available {
                        0
                    } else {
                        1
                    });
                });
            }
            let main_window_url = app
                .get_webview_window("main")
                .and_then(|window| window.url().ok())
                .map(|url| url.to_string());
            write_frontend_smoke_startup_marker(
                "OPEN_FACTORY_PREVIEW_SMOKE",
                "OPEN_FACTORY_PREVIEW_SMOKE_REPORT",
                "preview",
                main_window_url.as_deref(),
            );
            write_frontend_smoke_startup_marker(
                "OPEN_FACTORY_CANCEL_SMOKE",
                "OPEN_FACTORY_CANCEL_SMOKE_REPORT",
                "cancel",
                main_window_url.as_deref(),
            );
            if std::env::var("OPEN_FACTORY_DIALOG_SMOKE").ok().as_deref() == Some("1") {
                let report_path = std::env::var("OPEN_FACTORY_DIALOG_SMOKE_REPORT")
                    .unwrap_or_else(|_| "open-factory-dialog-smoke-report.json".to_string());
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let picked = handle
                        .dialog()
                        .file()
                        .set_title("Open Factory Dialog Smoke")
                        .add_filter(
                            "Media",
                            &["mp4", "mov", "webm", "mkv", "mp3", "wav", "png", "jpg"],
                        )
                        .blocking_pick_file();
                    let selected_path = picked
                        .and_then(|path| path.into_path().ok())
                        .map(|path| path.to_string_lossy().replace('\\', "/"));
                    let report = json!({
                        "windowExists": window_exists,
                        "dialogReturned": true,
                        "dialogCanceled": selected_path.is_none(),
                        "selectedPath": selected_path,
                    });
                    let _ = fs::write(
                        &report_path,
                        serde_json::to_string_pretty(&report).unwrap_or_default(),
                    );
                    handle.exit(if window_exists { 0 } else { 1 });
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn write_frontend_smoke_startup_marker(
    enabled_env: &str,
    report_env: &str,
    smoke_name: &str,
    window_url: Option<&str>,
) {
    if std::env::var(enabled_env).ok().as_deref() != Some("1") {
        return;
    }
    let Ok(report_path) = std::env::var(report_env) else {
        return;
    };
    let report = json!({
        "success": false,
        "smokeName": smoke_name,
        "stage": "native-startup",
        "windowUrl": window_url,
        "error": "Frontend smoke runner did not overwrite the native startup marker."
    });
    if let Some(parent) = std::path::Path::new(&report_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(
        report_path,
        serde_json::to_string_pretty(&report).unwrap_or_default(),
    );
}

fn write_frontend_smoke_page_load_marker(
    enabled_env: &str,
    report_env: &str,
    smoke_name: &str,
    url: &str,
    event: String,
) {
    if std::env::var(enabled_env).ok().as_deref() != Some("1") {
        return;
    }
    let Ok(report_path) = std::env::var(report_env) else {
        return;
    };
    let report = json!({
        "success": false,
        "smokeName": smoke_name,
        "stage": "page-load",
        "pageLoadEvent": event,
        "url": url,
        "error": "Frontend smoke runner did not overwrite the page-load marker."
    });
    if let Some(parent) = std::path::Path::new(&report_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(
        report_path,
        serde_json::to_string_pretty(&report).unwrap_or_default(),
    );
}
