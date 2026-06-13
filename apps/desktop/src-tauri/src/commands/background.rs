use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

const EXPORT_TRAY_ID: &str = "export-tray";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportPowerAction {
    Shutdown,
    Hibernate,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemCommandSpec {
    program: String,
    args: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTrayLabels {
    show_window: String,
    pause_queue: String,
    cancel_all: String,
    exit: String,
}

#[tauri::command]
pub fn minimize_to_tray(app: AppHandle, labels: Option<ExportTrayLabels>) -> Result<(), String> {
    ensure_export_tray(&app, labels)?;
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    show_main_window_inner(&app)
}

#[tauri::command]
pub fn update_export_tray_progress(
    app: AppHandle,
    progress: f64,
    running_count: u32,
) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(EXPORT_TRAY_ID) else {
        return Ok(());
    };
    let label = build_export_tray_progress_label(progress, running_count);
    tray.set_tooltip(Some(label.clone()))
        .map_err(|error| error.to_string())?;
    tray.set_title(Some(label))
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn run_export_power_action(action: String, allow_power_actions: bool) -> Result<(), String> {
    if !allow_power_actions {
        return Err("Power actions must be enabled in settings first.".to_string());
    }
    let action = parse_power_action(&action)?;
    let spec = build_power_action_command(action);
    Command::new(&spec.program)
        .args(&spec.args)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn build_export_tray_progress_label(progress: f64, running_count: u32) -> String {
    if running_count == 0 {
        return "Open Factory".to_string();
    }
    let safe_progress = if progress.is_finite() {
        progress.clamp(0.0, 1.0)
    } else {
        0.0
    };
    format!("Open Factory {}%", (safe_progress * 100.0).round() as u32)
}

pub fn build_power_action_command(action: ExportPowerAction) -> SystemCommandSpec {
    if cfg!(windows) {
        match action {
            ExportPowerAction::Shutdown => SystemCommandSpec {
                program: "shutdown".to_string(),
                args: vec!["/s".to_string(), "/t".to_string(), "0".to_string()],
            },
            ExportPowerAction::Hibernate => SystemCommandSpec {
                program: "shutdown".to_string(),
                args: vec!["/h".to_string()],
            },
        }
    } else if cfg!(target_os = "macos") {
        match action {
            ExportPowerAction::Shutdown => SystemCommandSpec {
                program: "osascript".to_string(),
                args: vec![
                    "-e".to_string(),
                    "tell app \"System Events\" to shut down".to_string(),
                ],
            },
            ExportPowerAction::Hibernate => SystemCommandSpec {
                program: "pmset".to_string(),
                args: vec!["sleepnow".to_string()],
            },
        }
    } else {
        match action {
            ExportPowerAction::Shutdown => SystemCommandSpec {
                program: "shutdown".to_string(),
                args: vec!["-h".to_string(), "now".to_string()],
            },
            ExportPowerAction::Hibernate => SystemCommandSpec {
                program: "systemctl".to_string(),
                args: vec!["hibernate".to_string()],
            },
        }
    }
}

fn ensure_export_tray(
    app: &AppHandle,
    labels: Option<ExportTrayLabels>,
) -> Result<tauri::tray::TrayIcon, String> {
    if let Some(tray) = app.tray_by_id(EXPORT_TRAY_ID) {
        return Ok(tray);
    }
    let labels = labels.unwrap_or_else(default_tray_labels);
    let show = MenuItem::with_id(
        app,
        "export-show-window",
        labels.show_window,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let pause = MenuItem::with_id(
        app,
        "export-pause-queue",
        labels.pause_queue,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let cancel = MenuItem::with_id(
        app,
        "export-cancel-all",
        labels.cancel_all,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let quit = MenuItem::with_id(app, "export-exit", labels.exit, true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let menu = Menu::with_items(app, &[&show, &pause, &cancel, &quit])
        .map_err(|error| error.to_string())?;
    let mut builder = TrayIconBuilder::with_id(EXPORT_TRAY_ID)
        .menu(&menu)
        .tooltip("Open Factory")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "export-show-window" => {
                let _ = show_main_window_inner(app);
            }
            "export-pause-queue" => {
                let _ = app.emit("export-tray-command", "pause");
            }
            "export-cancel-all" => {
                let _ = app.emit("export-tray-command", "cancel-all");
            }
            "export-exit" => {
                app.exit(0);
            }
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app).map_err(|error| error.to_string())
}

fn default_tray_labels() -> ExportTrayLabels {
    ExportTrayLabels {
        show_window: "Show Main Window".to_string(),
        pause_queue: "Pause Queue".to_string(),
        cancel_all: "Cancel All".to_string(),
        exit: "Exit".to_string(),
    }
}

fn show_main_window_inner(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn parse_power_action(action: &str) -> Result<ExportPowerAction, String> {
    match action {
        "shutdown" => Ok(ExportPowerAction::Shutdown),
        "hibernate" => Ok(ExportPowerAction::Hibernate),
        _ => Err("Unsupported export completion power action.".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_progress_label_clamps_progress() {
        assert_eq!(
            build_export_tray_progress_label(0.424, 1),
            "Open Factory 42%"
        );
        assert_eq!(
            build_export_tray_progress_label(3.0, 1),
            "Open Factory 100%"
        );
        assert_eq!(build_export_tray_progress_label(0.5, 0), "Open Factory");
    }

    #[test]
    fn builds_windows_shutdown_command_args() {
        let spec = build_windows_power_action_command(ExportPowerAction::Shutdown);
        assert_eq!(spec.program, "shutdown");
        assert_eq!(spec.args, vec!["/s", "/t", "0"]);
    }

    #[test]
    fn builds_windows_hibernate_command_args() {
        let spec = build_windows_power_action_command(ExportPowerAction::Hibernate);
        assert_eq!(spec.program, "shutdown");
        assert_eq!(spec.args, vec!["/h"]);
    }

    fn build_windows_power_action_command(action: ExportPowerAction) -> SystemCommandSpec {
        match action {
            ExportPowerAction::Shutdown => SystemCommandSpec {
                program: "shutdown".to_string(),
                args: vec!["/s".to_string(), "/t".to_string(), "0".to_string()],
            },
            ExportPowerAction::Hibernate => SystemCommandSpec {
                program: "shutdown".to_string(),
                args: vec!["/h".to_string()],
            },
        }
    }
}
