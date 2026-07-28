use crate::ltx_video::types::{SidecarCommand, SidecarMessage};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

/// Tracks active LTX-Video sidecar processes.
static LTX_CHILDREN: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
/// Tracks which task IDs have been canceled.
static CANCELED_TASKS: OnceLock<Mutex<std::collections::HashSet<String>>> = OnceLock::new();
/// Tracks task results received from sidecar.
static TASK_RESULTS: OnceLock<Mutex<HashMap<String, TaskResultEntry>>> = OnceLock::new();

fn ltx_children() -> &'static Mutex<HashMap<String, Child>> {
    LTX_CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
}

fn canceled_tasks() -> &'static Mutex<std::collections::HashSet<String>> {
    CANCELED_TASKS.get_or_init(|| Mutex::new(std::collections::HashSet::new()))
}

fn task_results() -> &'static Mutex<HashMap<String, TaskResultEntry>> {
    TASK_RESULTS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskResultEntry {
    pub status: String,
    pub video_path: Option<String>,
    pub error: Option<String>,
    pub progress: f32,
    pub stage: String,
}

/// Resolves the path to the Python sidecar script.
/// Checks app data dir first, then falls back to bundled resource.
pub fn resolve_sidecar_script(app: &AppHandle) -> Result<PathBuf, String> {
    // Check app data directory for user-installed service
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;
    let user_script = app_data.join("ltx-video-service").join("infer.py");
    if user_script.exists() {
        return Ok(user_script);
    }

    // Check relative to the executable (development mode)
    if let Ok(exe_dir) = std::env::current_exe() {
        let dev_script = exe_dir
            .parent()
            .and_then(|p| p.parent())
            .map(|p| {
                p.join("ltx-video-service")
                    .join("infer.py")
            });
        if let Some(path) = dev_script {
            if path.exists() {
                return Ok(path);
            }
        }
    }

    Err(
        "LTX-Video inference service not found. Please install the ltx-video-service module."
            .to_string(),
    )
}

/// Resolves the path to the Python interpreter.
/// Uses `python3` on Unix, `python` on Windows.
pub fn resolve_python_interpreter() -> String {
    if cfg!(target_os = "windows") {
        "python".to_string()
    } else {
        "python3".to_string()
    }
}

/// Resolves the model directory path.
pub fn resolve_model_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;
    Ok(app_data.join("models").join("ltx-video"))
}

/// Resolves the output directory for generated videos.
pub fn resolve_output_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;
    let output_dir = app_data.join("generated");
    std::fs::create_dir_all(&output_dir).map_err(|e| format!("create output dir: {e}"))?;
    Ok(output_dir)
}

use std::sync::atomic::{AtomicU64, Ordering};

/// Counter for generating unique task IDs.
static TASK_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Generates a unique task ID.
pub fn generate_task_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let seq = TASK_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("ltx-{}-{}", millis, seq)
}

/// Generates a unique output file path for a task.
pub fn generate_output_path(output_dir: &Path, task_id: &str) -> PathBuf {
    output_dir.join(format!("{}.mp4", safe_file_name(task_id)))
}

/// Starts the LTX-Video sidecar process for a generation task.
/// Returns the task_id.
pub fn start_generation(
    app: &AppHandle,
    task_id: &str,
    payload: &crate::ltx_video::types::TaskPayload,
) -> Result<(), String> {
    let script_path = resolve_sidecar_script(app)?;
    let model_dir = resolve_model_dir(app)?;
    let output_dir = resolve_output_dir(app)?;
    let output_path = generate_output_path(&output_dir, task_id);
    let python = resolve_python_interpreter();

    // Validate prompt
    if payload.prompt.trim().is_empty() {
        return Err("Prompt cannot be empty.".to_string());
    }

    // Check if model exists
    if !model_dir.exists() {
        return Err(format!(
            "Model not found at '{}'. Please download the model first.",
            model_dir.display()
        ));
    }

    // Check if model has required files
    let has_safetensors = std::fs::read_dir(&model_dir)
        .ok()
        .and_then(|mut entries| {
            entries.find_map(|e| {
                e.ok().and_then(|entry| {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.ends_with(".safetensors") {
                        Some(())
                    } else {
                        None
                    }
                })
            })
        })
        .is_some();

    if !has_safetensors {
        return Err(
            "Model directory exists but contains no model weights. Please re-download the model."
                .to_string(),
        );
    }

    // Build command
    let mut child = Command::new(&python)
        .arg(&script_path)
        .arg("--model-path")
        .arg(&model_dir)
        .arg("--task-id")
        .arg(task_id)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start LTX-Video sidecar: {}", e))?;

    // Send the generate command via stdin
    let generate_cmd = SidecarCommand::Generate {
        prompt: payload.prompt.clone(),
        negative_prompt: payload.negative_prompt.clone(),
        image_path: payload.image_path.clone(),
        num_frames: payload.num_frames,
        resolution: payload.resolution,
        fps: payload.fps,
        steps: payload.steps,
        cfg_scale: payload.cfg_scale,
        seed: payload.seed,
        output_path: output_path.to_string_lossy().to_string(),
    };

    if let Some(ref mut stdin) = child.stdin {
        let cmd_json =
            serde_json::to_string(&generate_cmd).map_err(|e| format!("serialize command: {e}"))?;
        writeln!(stdin, "{}", cmd_json).map_err(|e| format!("write to stdin: {e}"))?;
        stdin.flush().map_err(|e| format!("flush stdin: {e}"))?;
    }

    // Take stdout and stderr for reading
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to capture sidecar stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture sidecar stderr.".to_string())?;

    // Store the child process
    ltx_children()
        .lock()
        .map_err(|_| "Unable to lock LTX processes".to_string())?
        .insert(task_id.to_string(), child);

    // Initialize task result
    task_results()
        .lock()
        .map_err(|_| "Unable to lock task results".to_string())?
        .insert(
            task_id.to_string(),
            TaskResultEntry {
                status: "running".to_string(),
                video_path: None,
                error: None,
                progress: 0.0,
                stage: "starting".to_string(),
            },
        );

    // Spawn readers for stdout (JSON lines) and stderr (logging)
    let app_clone = app.clone();
    let task_id_clone = task_id.to_string();
    let lines = Arc::new(Mutex::new(Vec::<String>::new()));

    let stdout_reader = {
        let app = app_clone.clone();
        let tid = task_id_clone.clone();
        let lines = Arc::clone(&lines);
        std::thread::spawn(move || {
            read_sidecar_stdout(stdout, &app, &tid, &lines);
        })
    };

    let stderr_reader = {
        let app = app_clone.clone();
        let tid = task_id_clone.clone();
        let lines = Arc::clone(&lines);
        std::thread::spawn(move || {
            read_sidecar_stderr(stderr, &app, &tid, &lines);
        })
    };

    // Spawn a thread to wait for the process and handle completion
    let app_for_wait = app.clone();
    let task_id_for_wait = task_id.to_string();
    std::thread::spawn(move || {
        // Wait for readers to finish
        let _ = stdout_reader.join();
        let _ = stderr_reader.join();

        // Get the child and wait for exit
        let maybe_child = ltx_children()
            .lock()
            .ok()
            .and_then(|mut children| children.remove(&task_id_for_wait));

        if let Some(mut child) = maybe_child {
            if is_canceled(&task_id_for_wait) {
                clear_canceled(&task_id_for_wait);
                update_task_status(
                    &task_id_for_wait,
                    "canceled",
                    None,
                    Some("Generation canceled by user.".to_string()),
                );
                emit_completion(&app_for_wait, &task_id_for_wait, "canceled", None);
                return;
            }

            match child.wait() {
                Ok(status) if status.success() => {
                    // Check if we got a result from stdout
                    let result = task_results()
                        .lock()
                        .ok()
                        .and_then(|r| r.get(&task_id_for_wait).cloned());

                    if let Some(result) = result {
                        if result.status == "completed" {
                            update_task_status(
                                &task_id_for_wait,
                                "completed",
                                result.video_path.as_deref(),
                                None,
                            );
                            emit_completion(
                                &app_for_wait,
                                &task_id_for_wait,
                                "completed",
                                result.video_path.as_deref(),
                            );
                        } else if result.status == "failed" {
                            update_task_status(
                                &task_id_for_wait,
                                "failed",
                                None,
                                result.error.clone(),
                            );
                            emit_completion(&app_for_wait, &task_id_for_wait, "failed", None);
                        }
                    }
                }
                Ok(status) => {
                    let tail = lines
                        .lock()
                        .map(|items| items.iter().rev().take(20).cloned().collect::<Vec<_>>())
                        .unwrap_or_default()
                        .into_iter()
                        .rev()
                        .collect::<Vec<_>>()
                        .join("\n");
                    let error = format!("LTX-Video exited with status {}.\n{}", status, tail);

                    // Clean up partial output file on crash
                    if let Ok(output_dir) = resolve_output_dir(&app_for_wait) {
                        let output_path =
                            generate_output_path(&output_dir, &task_id_for_wait);
                        if output_path.exists() {
                            let _ = std::fs::remove_file(&output_path);
                            tracing::info!(
                                "Cleaned up partial output: {}",
                                output_path.display()
                            );
                        }
                    }

                    update_task_status(&task_id_for_wait, "failed", None, Some(error));
                    emit_completion(&app_for_wait, &task_id_for_wait, "failed", None);
                }
                Err(e) => {
                    let error = format!("Failed to wait for LTX-Video process: {}", e);

                    // Clean up partial output file on error
                    if let Ok(output_dir) = resolve_output_dir(&app_for_wait) {
                        let output_path =
                            generate_output_path(&output_dir, &task_id_for_wait);
                        if output_path.exists() {
                            let _ = std::fs::remove_file(&output_path);
                        }
                    }

                    update_task_status(&task_id_for_wait, "failed", None, Some(error));
                    emit_completion(&app_for_wait, &task_id_for_wait, "failed", None);
                }
            }
        }
    });

    Ok(())
}

/// Cancels a running generation task.
pub fn cancel_generation(task_id: &str) -> Result<(), String> {
    canceled_tasks()
        .lock()
        .map_err(|_| "Unable to lock cancellation set".to_string())?
        .insert(task_id.to_string());

    // Try to send cancel command via stdin
    if let Some(mut child) = ltx_children()
        .lock()
        .map_err(|_| "Unable to lock LTX processes".to_string())?
        .get(task_id)
        .and_then(|_| None::<Child>)
    {
        // If we can't send cancel via stdin, kill the process
        let _ = child.kill();
    }

    // Kill the process if it's still running
    if let Some(mut child) = ltx_children()
        .lock()
        .map_err(|_| "Unable to lock LTX processes".to_string())?
        .remove(task_id)
    {
        let _ = child.kill();
        let _ = child.wait();
    }

    update_task_status(task_id, "canceled", None, Some("Canceled by user.".to_string()));
    Ok(())
}

/// Gets the current status of a generation task.
pub fn get_generation_status(task_id: &str) -> Option<TaskResultEntry> {
    task_results()
        .lock()
        .ok()
        .and_then(|results| results.get(task_id).cloned())
}

/// Reads stdout from the sidecar process, parsing JSON lines.
fn read_sidecar_stdout<R: std::io::Read + Send + 'static>(
    reader: R,
    app: &AppHandle,
    task_id: &str,
    lines: &Arc<Mutex<Vec<String>>>,
) {
    let buf_reader = BufReader::new(reader);
    for line in buf_reader.lines().map_while(Result::ok) {
        if let Ok(mut items) = lines.lock() {
            if items.len() >= 100 {
                items.remove(0);
            }
            items.push(line.clone());
        }

        // Try to parse as SidecarMessage
        match serde_json::from_str::<SidecarMessage>(&line) {
            Ok(SidecarMessage::Progress { progress, stage }) => {
                let _ = task_results()
                    .lock()
                    .ok()
                    .and_then(|mut results| {
                        results.get_mut(task_id).map(|r| {
                            r.progress = progress;
                            r.stage = stage.clone();
                            r.status = "running".to_string();
                        })
                    });
                emit_progress(app, task_id, progress, &stage);
            }
            Ok(SidecarMessage::Completed { video_path }) => {
                update_task_status(task_id, "completed", Some(&video_path), None);
            }
            Ok(SidecarMessage::Error { message }) => {
                update_task_status(task_id, "failed", None, Some(message));
            }
            Ok(SidecarMessage::Ready) => {
                // Sidecar is ready, nothing to do
            }
            Err(_) => {
                // Not a JSON message, just log it
                tracing::debug!("LTX-Video stdout: {}", line);
            }
        }
    }
}

/// Reads stderr from the sidecar process for logging.
fn read_sidecar_stderr<R: std::io::Read + Send + 'static>(
    reader: R,
    _app: &AppHandle,
    task_id: &str,
    lines: &Arc<Mutex<Vec<String>>>,
) {
    let buf_reader = BufReader::new(reader);
    for line in buf_reader.lines().map_while(Result::ok) {
        if let Ok(mut items) = lines.lock() {
            if items.len() >= 100 {
                items.remove(0);
            }
            items.push(line.clone());
        }
        tracing::debug!("LTX-Video stderr [{}]: {}", task_id, line);
    }
}

fn update_task_status(
    task_id: &str,
    status: &str,
    video_path: Option<&str>,
    error: Option<String>,
) {
    if let Ok(mut results) = task_results().lock() {
        if let Some(entry) = results.get_mut(task_id) {
            entry.status = status.to_string();
            if let Some(path) = video_path {
                entry.video_path = Some(path.to_string());
            }
            entry.error = error;
        }
    }
}

fn emit_progress(app: &AppHandle, task_id: &str, progress: f32, stage: &str) {
    let clamped = progress.clamp(0.0, 1.0);
    let _ = app.emit(
        "ltx-video-progress",
        crate::ltx_video::types::LtxProgressPayload {
            task_id: task_id.to_string(),
            progress: clamped,
            progress_pct: clamped * 100.0,
            stage: stage.to_string(),
        },
    );
}

fn emit_completion(
    app: &AppHandle,
    task_id: &str,
    status: &str,
    video_path: Option<&str>,
) {
    let _ = app.emit(
        "ltx-video-completed",
        serde_json::json!({
            "taskId": task_id,
            "status": status,
            "videoPath": video_path,
        }),
    );
}

fn is_canceled(task_id: &str) -> bool {
    canceled_tasks()
        .lock()
        .map(|tasks| tasks.contains(task_id))
        .unwrap_or(false)
}

fn clear_canceled(task_id: &str) {
    if let Ok(mut tasks) = canceled_tasks().lock() {
        tasks.remove(task_id);
    }
}

fn safe_file_name(value: &str) -> String {
    value
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_unique_task_ids() {
        let id1 = generate_task_id();
        let id2 = generate_task_id();
        assert!(id1.starts_with("ltx-"));
        assert!(id2.starts_with("ltx-"));
        assert_ne!(id1, id2);
    }

    #[test]
    fn safe_file_name_sanitizes_special_chars() {
        assert_eq!(safe_file_name("test-123"), "test-123");
        assert_eq!(safe_file_name("test file!@#"), "test_file___");
        assert_eq!(safe_file_name("normal_name.mp4"), "normal_name.mp4");
    }

    #[test]
    fn generate_output_path_uses_task_id() {
        let dir = Path::new("/tmp/generated");
        let path = generate_output_path(dir, "ltx-12345");
        assert_eq!(path, PathBuf::from("/tmp/generated/ltx-12345.mp4"));
    }

    #[test]
    fn task_result_entry_serializes() {
        let entry = TaskResultEntry {
            status: "running".to_string(),
            video_path: None,
            error: None,
            progress: 0.5,
            stage: "denoising".to_string(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"status\":\"running\""));
        assert!(json.contains("\"progress\":0.5"));
    }

    #[test]
    fn resolve_python_interpreter_returns_platform_default() {
        let python = resolve_python_interpreter();
        if cfg!(target_os = "windows") {
            assert_eq!(python, "python");
        } else {
            assert_eq!(python, "python3");
        }
    }

    #[test]
    fn task_status_lifecycle() {
        // Test that status updates work correctly
        let task_id = "ltx-test-lifecycle";

        // Initialize
        task_results()
            .lock()
            .unwrap()
            .insert(task_id.to_string(), TaskResultEntry {
                status: "queued".to_string(),
                video_path: None,
                error: None,
                progress: 0.0,
                stage: "waiting".to_string(),
            });

        // Update to running
        update_task_status(task_id, "running", None, None);
        let result = get_generation_status(task_id).unwrap();
        assert_eq!(result.status, "running");

        // Update to completed
        update_task_status(task_id, "completed", Some("/tmp/video.mp4"), None);
        let result = get_generation_status(task_id).unwrap();
        assert_eq!(result.status, "completed");
        assert_eq!(result.video_path, Some("/tmp/video.mp4".to_string()));

        // Cleanup
        task_results().lock().unwrap().remove(task_id);
    }
}
