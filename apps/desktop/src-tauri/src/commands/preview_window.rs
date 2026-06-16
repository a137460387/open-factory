use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const PREVIEW_WINDOW_LABEL: &str = "preview";
const PREVIEW_WINDOW_TITLE: &str = "Open Factory Preview";
const PREVIEW_WINDOW_URL: &str = "index.html?previewWindow=1";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWindowBounds {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWindowRequest {
    pub bounds: PreviewWindowBounds,
    pub always_on_top: bool,
    pub resolution_scale: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWindowState {
    pub open: bool,
    pub label: String,
    pub bounds: Option<PreviewWindowBounds>,
    pub always_on_top: bool,
    pub fullscreen: bool,
    pub resolution_scale: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PreviewWindowConfig {
    pub label: String,
    pub title: String,
    pub url: String,
    pub bounds: PreviewWindowBounds,
    pub always_on_top: bool,
    pub resolution_scale: f64,
}

#[derive(Debug, Clone, Copy)]
struct PreviewWindowRuntimeState {
    always_on_top: bool,
    resolution_scale: f64,
}

impl Default for PreviewWindowRuntimeState {
    fn default() -> Self {
        Self {
            always_on_top: false,
            resolution_scale: 1.0,
        }
    }
}

static PREVIEW_WINDOW_RUNTIME_STATE: OnceLock<Mutex<PreviewWindowRuntimeState>> = OnceLock::new();

fn runtime_state() -> &'static Mutex<PreviewWindowRuntimeState> {
    PREVIEW_WINDOW_RUNTIME_STATE.get_or_init(|| Mutex::new(PreviewWindowRuntimeState::default()))
}

#[tauri::command]
pub fn open_preview_window(
    app: AppHandle,
    request: PreviewWindowRequest,
) -> Result<PreviewWindowState, String> {
    let config = build_preview_window_config(request);
    set_runtime_state(config.always_on_top, config.resolution_scale)?;

    if let Some(window) = app.get_webview_window(PREVIEW_WINDOW_LABEL) {
        window.set_focus().map_err(|error| error.to_string())?;
        return read_preview_window_state(&window, true);
    }

    let mut builder = WebviewWindowBuilder::new(
        &app,
        PREVIEW_WINDOW_LABEL,
        WebviewUrl::App(config.url.clone().into()),
    )
    .title(config.title)
    .inner_size(config.bounds.width as f64, config.bounds.height as f64)
    .resizable(true)
    .focused(true)
    .always_on_top(config.always_on_top);

    if let (Some(x), Some(y)) = (config.bounds.x, config.bounds.y) {
        builder = builder.position(x as f64, y as f64);
    } else {
        builder = builder.center();
    }

    let window = builder.build().map_err(|error| error.to_string())?;
    let app_for_event = app.clone();
    let window_for_event = window.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
            let payload = preview_window_closed_state(&window_for_event);
            let _ = app_for_event.emit_to("main", "preview-window-closed", payload);
        }
    });
    read_preview_window_state(&window, true)
}

#[tauri::command]
pub fn close_preview_window(app: AppHandle) -> Result<PreviewWindowState, String> {
    if let Some(window) = app.get_webview_window(PREVIEW_WINDOW_LABEL) {
        let state = preview_window_closed_state(&window);
        window.close().map_err(|error| error.to_string())?;
        Ok(state)
    } else {
        Ok(closed_preview_window_state(None))
    }
}

#[tauri::command]
pub fn get_preview_window_state(app: AppHandle) -> Result<PreviewWindowState, String> {
    if let Some(window) = app.get_webview_window(PREVIEW_WINDOW_LABEL) {
        read_preview_window_state(&window, true)
    } else {
        Ok(closed_preview_window_state(None))
    }
}

#[tauri::command]
pub fn set_preview_window_always_on_top(
    app: AppHandle,
    always_on_top: bool,
) -> Result<PreviewWindowState, String> {
    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Unable to lock preview window state".to_string())?;
    state.always_on_top = always_on_top;
    drop(state);
    if let Some(window) = app.get_webview_window(PREVIEW_WINDOW_LABEL) {
        window
            .set_always_on_top(always_on_top)
            .map_err(|error| error.to_string())?;
        read_preview_window_state(&window, true)
    } else {
        Ok(closed_preview_window_state(None))
    }
}

#[tauri::command]
pub fn set_preview_window_fullscreen(
    app: AppHandle,
    fullscreen: bool,
) -> Result<PreviewWindowState, String> {
    if let Some(window) = app.get_webview_window(PREVIEW_WINDOW_LABEL) {
        window
            .set_fullscreen(fullscreen)
            .map_err(|error| error.to_string())?;
        read_preview_window_state(&window, true)
    } else {
        Ok(closed_preview_window_state(None))
    }
}

#[tauri::command]
pub fn set_preview_window_resolution_scale(
    app: AppHandle,
    resolution_scale: f64,
) -> Result<PreviewWindowState, String> {
    let normalized = normalize_resolution_scale(resolution_scale);
    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Unable to lock preview window state".to_string())?;
    state.resolution_scale = normalized;
    drop(state);
    if let Some(window) = app.get_webview_window(PREVIEW_WINDOW_LABEL) {
        read_preview_window_state(&window, true)
    } else {
        Ok(closed_preview_window_state(None))
    }
}

pub fn build_preview_window_config(request: PreviewWindowRequest) -> PreviewWindowConfig {
    PreviewWindowConfig {
        label: PREVIEW_WINDOW_LABEL.to_string(),
        title: PREVIEW_WINDOW_TITLE.to_string(),
        url: PREVIEW_WINDOW_URL.to_string(),
        bounds: normalize_preview_window_bounds(request.bounds),
        always_on_top: request.always_on_top,
        resolution_scale: normalize_resolution_scale(request.resolution_scale),
    }
}

pub fn normalize_preview_window_bounds(bounds: PreviewWindowBounds) -> PreviewWindowBounds {
    PreviewWindowBounds {
        x: bounds.x.map(|value| value.clamp(-32768, 32767)),
        y: bounds.y.map(|value| value.clamp(-32768, 32767)),
        width: bounds.width.clamp(320, 7680),
        height: bounds.height.clamp(240, 4320),
    }
}

fn normalize_resolution_scale(value: f64) -> f64 {
    if (value - 0.5).abs() < f64::EPSILON {
        0.5
    } else if (value - 0.25).abs() < f64::EPSILON {
        0.25
    } else {
        1.0
    }
}

fn set_runtime_state(always_on_top: bool, resolution_scale: f64) -> Result<(), String> {
    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Unable to lock preview window state".to_string())?;
    state.always_on_top = always_on_top;
    state.resolution_scale = resolution_scale;
    Ok(())
}

fn read_runtime_state() -> PreviewWindowRuntimeState {
    runtime_state()
        .lock()
        .map(|state| *state)
        .unwrap_or_else(|_| PreviewWindowRuntimeState::default())
}

fn read_preview_window_state(
    window: &WebviewWindow,
    open: bool,
) -> Result<PreviewWindowState, String> {
    let runtime = read_runtime_state();
    Ok(PreviewWindowState {
        open,
        label: PREVIEW_WINDOW_LABEL.to_string(),
        bounds: read_preview_window_bounds(window),
        always_on_top: window.is_always_on_top().unwrap_or(runtime.always_on_top),
        fullscreen: window.is_fullscreen().unwrap_or(false),
        resolution_scale: runtime.resolution_scale,
    })
}

fn preview_window_closed_state(window: &WebviewWindow) -> PreviewWindowState {
    closed_preview_window_state(read_preview_window_bounds(window))
}

fn closed_preview_window_state(bounds: Option<PreviewWindowBounds>) -> PreviewWindowState {
    let runtime = read_runtime_state();
    PreviewWindowState {
        open: false,
        label: PREVIEW_WINDOW_LABEL.to_string(),
        bounds,
        always_on_top: runtime.always_on_top,
        fullscreen: false,
        resolution_scale: runtime.resolution_scale,
    }
}

fn read_preview_window_bounds(window: &WebviewWindow) -> Option<PreviewWindowBounds> {
    let position = window.outer_position().ok();
    let size = window.inner_size().ok()?;
    Some(PreviewWindowBounds {
        x: position.map(|value| value.x),
        y: position.map(|value| value.y),
        width: size.width,
        height: size.height,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_preview_window_bounds_for_safe_creation() {
        let bounds = normalize_preview_window_bounds(PreviewWindowBounds {
            x: Some(40_000),
            y: Some(-40_000),
            width: 12,
            height: 99,
        });

        assert_eq!(
            bounds,
            PreviewWindowBounds {
                x: Some(32767),
                y: Some(-32768),
                width: 320,
                height: 240,
            }
        );
    }

    #[test]
    fn builds_preview_window_command_config() {
        let config = build_preview_window_config(PreviewWindowRequest {
            bounds: PreviewWindowBounds {
                x: Some(10),
                y: Some(20),
                width: 1280,
                height: 720,
            },
            always_on_top: true,
            resolution_scale: 0.5,
        });

        assert_eq!(config.label, PREVIEW_WINDOW_LABEL);
        assert_eq!(config.title, PREVIEW_WINDOW_TITLE);
        assert_eq!(config.url, PREVIEW_WINDOW_URL);
        assert_eq!(config.bounds.width, 1280);
        assert!(config.always_on_top);
        assert_eq!(config.resolution_scale, 0.5);
    }

    #[test]
    fn falls_back_to_full_resolution_for_unknown_scale() {
        let config = build_preview_window_config(PreviewWindowRequest {
            bounds: PreviewWindowBounds {
                x: None,
                y: None,
                width: 960,
                height: 540,
            },
            always_on_top: false,
            resolution_scale: 0.75,
        });

        assert_eq!(config.resolution_scale, 1.0);
    }
}
