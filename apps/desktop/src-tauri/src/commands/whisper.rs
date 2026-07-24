use super::binaries::ffmpeg_binary;
use crate::path_validator::validate_path;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperRequest {
    executable_path: String,
    model_path: String,
    audio_path: String,
    clip_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperResult {
    srt_path: String,
    contents: String,
    duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WhisperProgressPayload {
    clip_id: String,
    progress: f32,
    progress_pct: f32,
}

#[tauri::command]
pub async fn run_whisper(app: AppHandle, request: WhisperRequest) -> Result<WhisperResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_whisper_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

fn run_whisper_blocking(app: AppHandle, request: WhisperRequest) -> Result<WhisperResult, String> {
    validate_whisper_request(&request)?;
    let executable = validate_path(&app, Path::new(&request.executable_path))?;
    let model = validate_path(&app, Path::new(&request.model_path))?;
    let source_media = validate_path(&app, Path::new(&request.audio_path))?;
    let output_dir = create_whisper_output_dir(&app, &request.clip_id)?;
    let started = Instant::now();
    emit_progress(&app, &request.clip_id, 0.02);
    let audio_path = prepare_whisper_audio(&source_media, &output_dir)?;
    emit_progress(&app, &request.clip_id, 0.2);
    run_whisper_process(
        &app,
        &request.clip_id,
        &executable,
        &model,
        &audio_path,
        &output_dir,
    )?;
    let srt_path = find_srt_output(&output_dir, &audio_path).ok_or_else(|| {
        format!(
            "Whisper did not create an SRT file in {}",
            normalize_path(&output_dir)
        )
    })?;
    let contents = fs::read_to_string(&srt_path).map_err(|error| {
        format!(
            "Unable to read Whisper SRT {}: {}",
            normalize_path(&srt_path),
            error
        )
    })?;
    emit_progress(&app, &request.clip_id, 1.0);
    Ok(WhisperResult {
        srt_path: normalize_path(&srt_path),
        contents,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn validate_whisper_request(request: &WhisperRequest) -> Result<(), String> {
    if request.executable_path.trim().is_empty() {
        return Err("Whisper executable path is not configured.".to_string());
    }
    if request.model_path.trim().is_empty() {
        return Err("Whisper model path is not configured.".to_string());
    }
    if request.audio_path.trim().is_empty() {
        return Err("Whisper audio path is missing.".to_string());
    }
    Ok(())
}

fn create_whisper_output_dir(app: &AppHandle, clip_id: &str) -> Result<PathBuf, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let output_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("whisper")
        .join(format!("{}-{}", safe_file_name(clip_id), millis));
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;
    Ok(output_dir)
}

fn prepare_whisper_audio(source_media: &Path, output_dir: &Path) -> Result<PathBuf, String> {
    let output_path = output_dir.join("audio.wav");
    if source_media
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
    {
        fs::copy(source_media, &output_path).map_err(|error| {
            format!(
                "Unable to stage Whisper audio {}: {}",
                normalize_path(source_media),
                error
            )
        })?;
        return Ok(output_path);
    }

    let args = build_audio_extract_args(source_media, &output_path);
    let output = Command::new(ffmpeg_binary())
        .args(&args)
        .output()
        .map_err(|error| format!("Unable to start FFmpeg audio extraction: {}", error))?;
    if !output.status.success() {
        return Err(format!(
            "FFmpeg audio extraction failed with status {}.\n{}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(output_path)
}

fn build_audio_extract_args(input_path: &Path, output_path: &Path) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-i".to_string(),
        normalize_path(input_path),
        "-vn".to_string(),
        "-ac".to_string(),
        "1".to_string(),
        "-ar".to_string(),
        "16000".to_string(),
        normalize_path(output_path),
    ]
}

fn run_whisper_process(
    app: &AppHandle,
    clip_id: &str,
    executable: &Path,
    model: &Path,
    audio_path: &Path,
    output_dir: &Path,
) -> Result<(), String> {
    let mut child = Command::new(executable)
        .args(build_whisper_args(model, audio_path))
        .current_dir(output_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start Whisper: {}", error))?;
    let lines = Arc::new(Mutex::new(Vec::<String>::new()));
    let mut readers = Vec::new();
    if let Some(stdout) = child.stdout.take() {
        readers.push(spawn_whisper_reader(
            stdout,
            app.clone(),
            clip_id.to_string(),
            Arc::clone(&lines),
        ));
    }
    if let Some(stderr) = child.stderr.take() {
        readers.push(spawn_whisper_reader(
            stderr,
            app.clone(),
            clip_id.to_string(),
            Arc::clone(&lines),
        ));
    }
    let status = child.wait().map_err(|error| error.to_string())?;
    for reader in readers {
        let _ = reader.join();
    }
    if status.success() {
        return Ok(());
    }
    let tail = lines
        .lock()
        .map(|items| items.iter().rev().take(20).cloned().collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");
    Err(format!("Whisper exited with status {}.\n{}", status, tail))
}

fn spawn_whisper_reader<R: Read + Send + 'static>(
    reader: R,
    app: AppHandle,
    clip_id: String,
    lines: Arc<Mutex<Vec<String>>>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines().map_while(Result::ok) {
            if let Ok(mut items) = lines.lock() {
                items.push(line.clone());
            }
            if let Some(progress) = parse_whisper_progress(&line) {
                emit_progress(&app, &clip_id, 0.2 + progress * 0.75);
            }
        }
    })
}

fn build_whisper_args(model: &Path, audio_path: &Path) -> Vec<String> {
    vec![
        "-m".to_string(),
        normalize_path(model),
        "-f".to_string(),
        normalize_path(audio_path),
        "-o".to_string(),
        "srt".to_string(),
    ]
}

fn parse_whisper_progress(line: &str) -> Option<f32> {
    let percent_index = line.find('%')?;
    let before_percent = &line[..percent_index];
    let token = before_percent
        .split(|ch: char| !(ch.is_ascii_digit() || ch == '.'))
        .rfind(|part| !part.is_empty())?;
    let value = token.parse::<f32>().ok()?;
    Some((value / 100.0).clamp(0.0, 1.0))
}

fn find_srt_output(output_dir: &Path, audio_path: &Path) -> Option<PathBuf> {
    candidate_srt_paths(output_dir, audio_path)
        .into_iter()
        .find(|path| path.exists())
        .or_else(|| {
            fs::read_dir(output_dir)
                .ok()?
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .find(|path| {
                    path.extension()
                        .and_then(|value| value.to_str())
                        .is_some_and(|extension| extension.eq_ignore_ascii_case("srt"))
                })
        })
}

fn candidate_srt_paths(output_dir: &Path, audio_path: &Path) -> Vec<PathBuf> {
    let stem = audio_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    let file_name = audio_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("audio.wav");
    vec![
        output_dir.join(format!("{stem}.srt")),
        output_dir.join(format!("{file_name}.srt")),
    ]
}

fn emit_progress(app: &AppHandle, clip_id: &str, progress: f32) {
    let clamped = progress.clamp(0.0, 1.0);
    let _ = app.emit(
        "whisper-progress",
        WhisperProgressPayload {
            clip_id: clip_id.to_string(),
            progress: clamped,
            progress_pct: clamped * 100.0,
        },
    );
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
    fn builds_whisper_argument_array_without_shell_strings() {
        let args = build_whisper_args(
            Path::new(r"C:\Models\base.bin"),
            Path::new(r"C:\Temp\audio.wav"),
        );

        assert_eq!(
            args,
            vec![
                "-m",
                "C:/Models/base.bin",
                "-f",
                "C:/Temp/audio.wav",
                "-o",
                "srt"
            ]
        );
        assert!(!args
            .iter()
            .any(|arg| arg.contains("cmd /C") || arg.contains("&&")));
    }

    #[test]
    fn validates_missing_whisper_paths_before_process_launch() {
        let request = WhisperRequest {
            executable_path: String::new(),
            model_path: "C:/Models/base.bin".to_string(),
            audio_path: "C:/Media/audio.wav".to_string(),
            clip_id: "clip-a".to_string(),
        };

        assert_eq!(
            validate_whisper_request(&request).unwrap_err(),
            "Whisper executable path is not configured."
        );
    }

    #[test]
    fn parses_percent_progress_from_whisper_output() {
        assert_eq!(parse_whisper_progress("progress = 25%"), Some(0.25));
        assert_eq!(parse_whisper_progress("[00:01] 100.0% done"), Some(1.0));
        assert_eq!(parse_whisper_progress("no progress"), None);
    }

    #[test]
    fn stages_non_wav_media_with_ffmpeg_argument_arrays() {
        let args = build_audio_extract_args(
            Path::new(r"D:\Media\clip.mp4"),
            Path::new(r"D:\Temp\audio.wav"),
        );

        assert_eq!(
            args,
            vec![
                "-y",
                "-i",
                "D:/Media/clip.mp4",
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "D:/Temp/audio.wav"
            ]
        );
    }

    #[test]
    fn checks_common_srt_output_names() {
        let candidates = candidate_srt_paths(
            Path::new("C:/Temp/whisper"),
            Path::new("C:/Temp/whisper/audio.wav"),
        );

        assert_eq!(
            candidates,
            vec![
                PathBuf::from("C:/Temp/whisper/audio.srt"),
                PathBuf::from("C:/Temp/whisper/audio.wav.srt")
            ]
        );
    }
}
