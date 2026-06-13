use crate::path_validator::validate_path;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

static DEMUCS_CHILDREN: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
static CANCELED_DEMUCS_CLIPS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn demucs_children() -> &'static Mutex<HashMap<String, Child>> {
    DEMUCS_CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
}

fn canceled_demucs_clips() -> &'static Mutex<HashSet<String>> {
    CANCELED_DEMUCS_CLIPS.get_or_init(|| Mutex::new(HashSet::new()))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DemucsRequest {
    executable_path: String,
    media_path: String,
    clip_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DemucsResult {
    vocals_path: String,
    accompaniment_path: String,
    output_dir: String,
    duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DemucsProgressPayload {
    clip_id: String,
    progress: f32,
    progress_pct: f32,
}

#[tauri::command]
pub async fn run_demucs(app: AppHandle, request: DemucsRequest) -> Result<DemucsResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_demucs_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub fn cancel_demucs(clip_id: String) -> Result<(), String> {
    canceled_demucs_clips()
        .lock()
        .map_err(|_| "Unable to lock Demucs cancellation set".to_string())?
        .insert(clip_id.clone());
    if let Some(mut child) = demucs_children()
        .lock()
        .map_err(|_| "Unable to lock Demucs processes".to_string())?
        .remove(&clip_id)
    {
        child.kill().map_err(|error| error.to_string())?;
        let _ = child.wait();
    }
    Ok(())
}

fn run_demucs_blocking(app: AppHandle, request: DemucsRequest) -> Result<DemucsResult, String> {
    validate_demucs_request(&request)?;
    let executable = validate_path(&app, Path::new(&request.executable_path))?;
    let source_media = validate_path(&app, Path::new(&request.media_path))?;
    let output_dir = create_demucs_output_dir(&app, &request.clip_id)?;
    let started = Instant::now();

    emit_progress(&app, &request.clip_id, 0.02);
    run_demucs_process(
        &app,
        &request.clip_id,
        &executable,
        &source_media,
        &output_dir,
    )?;
    let outputs = find_demucs_outputs(&output_dir, &source_media).ok_or_else(|| {
        format!(
            "Demucs did not create vocals.wav and no_vocals.wav in {}",
            normalize_path(&output_dir)
        )
    })?;
    emit_progress(&app, &request.clip_id, 1.0);
    Ok(DemucsResult {
        vocals_path: normalize_path(&outputs.vocals),
        accompaniment_path: normalize_path(&outputs.accompaniment),
        output_dir: normalize_path(&output_dir),
        duration_ms: started.elapsed().as_millis(),
    })
}

fn validate_demucs_request(request: &DemucsRequest) -> Result<(), String> {
    if request.executable_path.trim().is_empty() {
        return Err("Demucs executable path is not configured.".to_string());
    }
    if request.media_path.trim().is_empty() {
        return Err("Demucs media path is missing.".to_string());
    }
    if request.clip_id.trim().is_empty() {
        return Err("Demucs clip id is missing.".to_string());
    }
    Ok(())
}

fn create_demucs_output_dir(app: &AppHandle, clip_id: &str) -> Result<PathBuf, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let output_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("demucs")
        .join(format!("{}-{}", safe_file_name(clip_id), millis));
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;
    Ok(output_dir)
}

fn run_demucs_process(
    app: &AppHandle,
    clip_id: &str,
    executable: &Path,
    source_media: &Path,
    output_dir: &Path,
) -> Result<(), String> {
    let mut child = Command::new(executable)
        .args(build_demucs_args(source_media, output_dir))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start Demucs: {}", error))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to capture Demucs stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture Demucs stderr.".to_string())?;
    demucs_children()
        .lock()
        .map_err(|_| "Unable to lock Demucs processes".to_string())?
        .insert(clip_id.to_string(), child);

    let lines = Arc::new(Mutex::new(Vec::<String>::new()));
    let readers = vec![
        spawn_demucs_reader(stdout, app.clone(), clip_id.to_string(), Arc::clone(&lines)),
        spawn_demucs_reader(stderr, app.clone(), clip_id.to_string(), Arc::clone(&lines)),
    ];
    for reader in readers {
        let _ = reader.join();
    }

    let maybe_child = demucs_children()
        .lock()
        .ok()
        .and_then(|mut children| children.remove(clip_id));
    if is_demucs_canceled(clip_id) || maybe_child.is_none() {
        clear_demucs_canceled(clip_id);
        emit_progress(app, clip_id, 0.0);
        return Err("Demucs separation canceled.".to_string());
    }
    let mut child = maybe_child.expect("checked above");
    let status = child.wait().map_err(|error| error.to_string())?;
    if status.success() {
        clear_demucs_canceled(clip_id);
        return Ok(());
    }
    clear_demucs_canceled(clip_id);
    let tail = lines
        .lock()
        .map(|items| items.iter().rev().take(20).cloned().collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");
    Err(format!("Demucs exited with status {}.\n{}", status, tail))
}

fn build_demucs_args(source_media: &Path, output_dir: &Path) -> Vec<String> {
    vec![
        "--two-stems".to_string(),
        "vocals".to_string(),
        "-o".to_string(),
        normalize_path(output_dir),
        normalize_path(source_media),
    ]
}

fn spawn_demucs_reader<R: Read + Send + 'static>(
    reader: R,
    app: AppHandle,
    clip_id: String,
    lines: Arc<Mutex<Vec<String>>>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            if let Ok(mut items) = lines.lock() {
                if items.len() >= 20 {
                    items.remove(0);
                }
                items.push(line.clone());
            }
            if let Some(progress) = parse_demucs_progress(&line) {
                emit_progress(&app, &clip_id, 0.05 + progress * 0.9);
            }
        }
    })
}

#[derive(Debug, Clone, PartialEq)]
struct DemucsOutputPaths {
    vocals: PathBuf,
    accompaniment: PathBuf,
}

fn find_demucs_outputs(output_dir: &Path, source_media: &Path) -> Option<DemucsOutputPaths> {
    candidate_demucs_output_paths(output_dir, source_media)
        .into_iter()
        .find(|paths| paths.vocals.exists() && paths.accompaniment.exists())
        .or_else(|| scan_demucs_outputs(output_dir))
}

fn candidate_demucs_output_paths(output_dir: &Path, source_media: &Path) -> Vec<DemucsOutputPaths> {
    let stem = source_media
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    vec![
        DemucsOutputPaths {
            vocals: output_dir.join("htdemucs").join(stem).join("vocals.wav"),
            accompaniment: output_dir.join("htdemucs").join(stem).join("no_vocals.wav"),
        },
        DemucsOutputPaths {
            vocals: output_dir.join(stem).join("vocals.wav"),
            accompaniment: output_dir.join(stem).join("no_vocals.wav"),
        },
    ]
}

fn scan_demucs_outputs(output_dir: &Path) -> Option<DemucsOutputPaths> {
    let mut wavs = Vec::new();
    collect_wavs(output_dir, &mut wavs);
    let vocals = wavs
        .iter()
        .find(|path| file_name_eq(path, "vocals.wav"))?
        .clone();
    let accompaniment = wavs
        .iter()
        .find(|path| {
            file_name_eq(path, "no_vocals.wav")
                || file_name_eq(path, "accompaniment.wav")
                || file_name_eq(path, "instrumental.wav")
        })?
        .clone();
    Some(DemucsOutputPaths {
        vocals,
        accompaniment,
    })
}

fn collect_wavs(path: &Path, wavs: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };
    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            collect_wavs(&entry_path, wavs);
            continue;
        }
        if entry_path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
        {
            wavs.push(entry_path);
        }
    }
}

fn file_name_eq(path: &Path, expected: &str) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(expected))
}

fn parse_demucs_progress(line: &str) -> Option<f32> {
    let percent_index = line.find('%')?;
    let before_percent = &line[..percent_index];
    let token = before_percent
        .split(|ch: char| !(ch.is_ascii_digit() || ch == '.'))
        .filter(|part| !part.is_empty())
        .next_back()?;
    let value = token.parse::<f32>().ok()?;
    Some((value / 100.0).clamp(0.0, 1.0))
}

fn emit_progress(app: &AppHandle, clip_id: &str, progress: f32) {
    let clamped = progress.clamp(0.0, 1.0);
    let _ = app.emit(
        "demucs-progress",
        DemucsProgressPayload {
            clip_id: clip_id.to_string(),
            progress: clamped,
            progress_pct: clamped * 100.0,
        },
    );
}

fn is_demucs_canceled(clip_id: &str) -> bool {
    canceled_demucs_clips()
        .lock()
        .map(|clips| clips.contains(clip_id))
        .unwrap_or(false)
}

fn clear_demucs_canceled(clip_id: &str) {
    if let Ok(mut clips) = canceled_demucs_clips().lock() {
        clips.remove(clip_id);
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

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_missing_demucs_path_before_process_launch() {
        let request = DemucsRequest {
            executable_path: String::new(),
            media_path: "C:/Media/clip.wav".to_string(),
            clip_id: "clip-a".to_string(),
        };

        assert_eq!(
            validate_demucs_request(&request).unwrap_err(),
            "Demucs executable path is not configured."
        );
    }

    #[test]
    fn builds_demucs_argument_array_without_shell_strings() {
        let args = build_demucs_args(
            Path::new(r"D:\Media\clip.mp4"),
            Path::new(r"D:\Temp\open-factory\demucs"),
        );

        assert_eq!(
            args,
            vec![
                "--two-stems",
                "vocals",
                "-o",
                "D:/Temp/open-factory/demucs",
                "D:/Media/clip.mp4"
            ]
        );
        assert!(!args
            .iter()
            .any(|arg| arg.contains("cmd /C") || arg.contains("&&")));
    }

    #[test]
    fn parses_percent_progress_from_demucs_output() {
        assert_eq!(parse_demucs_progress("Separating 25%"), Some(0.25));
        assert_eq!(parse_demucs_progress("100.0%|done"), Some(1.0));
        assert_eq!(parse_demucs_progress("no progress"), None);
    }

    #[test]
    fn checks_common_demucs_output_paths() {
        let candidates = candidate_demucs_output_paths(
            Path::new("C:/Temp/open-factory/demucs/clip-a"),
            Path::new("C:/Media/interview.mp4"),
        );

        assert_eq!(
            candidates,
            vec![
                DemucsOutputPaths {
                    vocals: PathBuf::from(
                        "C:/Temp/open-factory/demucs/clip-a/htdemucs/interview/vocals.wav"
                    ),
                    accompaniment: PathBuf::from(
                        "C:/Temp/open-factory/demucs/clip-a/htdemucs/interview/no_vocals.wav"
                    ),
                },
                DemucsOutputPaths {
                    vocals: PathBuf::from(
                        "C:/Temp/open-factory/demucs/clip-a/interview/vocals.wav"
                    ),
                    accompaniment: PathBuf::from(
                        "C:/Temp/open-factory/demucs/clip-a/interview/no_vocals.wav"
                    ),
                },
            ]
        );
    }

    #[test]
    fn scans_nested_demucs_outputs() {
        let root = std::env::temp_dir().join(format!(
            "open-factory-demucs-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ));
        let output = root.join("custom").join("take-1");
        fs::create_dir_all(&output).expect("create demucs output");
        fs::write(output.join("vocals.wav"), b"vocals").expect("write vocals");
        fs::write(output.join("accompaniment.wav"), b"music").expect("write accompaniment");

        let found = scan_demucs_outputs(&root).expect("outputs");

        assert_eq!(found.vocals, output.join("vocals.wav"));
        assert_eq!(found.accompaniment, output.join("accompaniment.wav"));
        let _ = fs::remove_dir_all(root);
    }
}
