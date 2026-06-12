mod commands;
pub mod path_validator;

use serde_json::json;
use std::fs;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::ffmpeg::detect_ffmpeg,
            commands::ffmpeg::get_ffmpeg_capabilities,
            commands::ffmpeg::analyze_clip,
            commands::ffmpeg::run_export,
            commands::ffmpeg::cancel_export,
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
            commands::files::get_file_stat,
            commands::files::scan_directory,
            commands::cache::get_cache_dir,
            commands::cache::ensure_cache_dirs,
            commands::cache::read_cache,
            commands::cache::write_cache,
            commands::cache::remove_cache_file,
            commands::cache::clear_cache,
            commands::cache::get_cache_size,
            commands::media::probe_media,
            commands::media::analyze_waveform,
            commands::media::detect_silence,
            commands::proxy::generate_proxy,
            commands::scene::detect_scene_changes,
            commands::share::create_share_package,
            commands::whisper::run_whisper,
            commands::smoke::get_preview_smoke_config,
            commands::smoke::get_cancel_smoke_config,
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
                    let output = Command::new(if cfg!(windows) {
                        "ffmpeg.exe"
                    } else {
                        "ffmpeg"
                    })
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
