use crate::path_validator::validate_path;
use nnnoiseless::DenoiseState;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

use super::binaries::ffmpeg_binary;

static CANCELED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
fn canceled() -> &'static Mutex<HashSet<String>> { CANCELED.get_or_init(|| Mutex::new(HashSet::new())) }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoiseReductionRequest { pub media_path: String, pub clip_id: String, pub strength: f32 }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoiseReductionResult { pub output_path: String, pub original_path: String, pub duration_ms: u128, pub noise_reduction_db: f32 }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoiseReductionProgressPayload { pub clip_id: String, pub progress: f32, pub stage: String }

fn safe_name(v: &str) -> String { v.chars().map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' }).collect() }
fn norm_path(p: &Path) -> String { p.to_string_lossy().replace('\\', "/") }

#[tauri::command]
pub async fn process_audio_noise_reduction(app: AppHandle, request: NoiseReductionRequest) -> Result<NoiseReductionResult, String> {
    tauri::async_runtime::spawn_blocking(move || process_blocking(app, request)).await.map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub fn cancel_audio_noise_reduction(clip_id: String) -> Result<(), String> {
    canceled().lock().map_err(|_| "lock".to_string())?.insert(clip_id);
    Ok(())
}

fn process_blocking(app: AppHandle, req: NoiseReductionRequest) -> Result<NoiseReductionResult, String> {
    let started = Instant::now();
    if req.media_path.trim().is_empty() { return Err("Media path is missing.".into()); }
    if req.clip_id.trim().is_empty() { return Err("Clip ID is missing.".into()); }
    if !(0.0..=1.0).contains(&req.strength) { return Err("Strength must be 0.0-1.0.".into()); }
    let source = validate_path(&app, Path::new(&req.media_path))?;
    let output = create_output(&app, &req.clip_id, &source)?;
    emit_progress(&app, &req.clip_id, 0.05, "decoding");
    let pcm = decode_to_pcm(&source)?;
    if is_canceled(&req.clip_id) { clear_canceled(&req.clip_id); return Err("Canceled.".into()); }
    emit_progress(&app, &req.clip_id, 0.3, "processing");
    let processed = apply_rnnoise(&pcm, req.strength)?;
    if is_canceled(&req.clip_id) { clear_canceled(&req.clip_id); return Err("Canceled.".into()); }
    emit_progress(&app, &req.clip_id, 0.8, "encoding");
    encode_pcm(&processed, &output, &source)?;
    emit_progress(&app, &req.clip_id, 1.0, "complete");
    clear_canceled(&req.clip_id);
    Ok(NoiseReductionResult { output_path: norm_path(&output), original_path: norm_path(&source), duration_ms: started.elapsed().as_millis(), noise_reduction_db: estimate_db(&pcm, &processed) })
}

fn create_output(app: &AppHandle, clip_id: &str, src: &Path) -> Result<PathBuf, String> {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("wav");
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("noise-reduction");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{}-{}.{}", safe_name(clip_id), ms, ext)))
}

fn decode_to_pcm(src: &Path) -> Result<Vec<f32>, String> {
    let out = Command::new(ffmpeg_binary()).args(["-i", &norm_path(src), "-f", "f32le", "-acodec", "pcm_f32le", "-ar", "48000", "-ac", "1", "-"])
        .stdout(Stdio::piped()).stderr(Stdio::piped()).output().map_err(|e| format!("FFmpeg: {}", e))?;
    if !out.status.success() { return Err(format!("FFmpeg decode: {}", String::from_utf8_lossy(&out.stderr))); }
    let bytes = out.stdout;
    let mut pcm = Vec::with_capacity(bytes.len() / 4);
    for c in bytes.chunks_exact(4) { pcm.push(f32::from_le_bytes([c[0], c[1], c[2], c[3]])); }
    Ok(pcm)
}

fn apply_rnnoise(pcm: &[f32], strength: f32) -> Result<Vec<f32>, String> {
    let mut denoise = DenoiseState::new();
    let frame_size = 480;
    let mut out = Vec::with_capacity(pcm.len());
    for chunk in pcm.chunks(frame_size) {
        if chunk.len() == frame_size {
            let mut frame = [0.0f32; 480];
            let mut denoised = [0.0f32; 480];
            frame.copy_from_slice(chunk);
            denoise.process_frame(&mut denoised, &frame);
            for i in 0..frame_size { out.push(frame[i] * (1.0 - strength) + denoised[i] * strength); }
        } else { out.extend_from_slice(chunk); }
    }
    Ok(out)
}

fn encode_pcm(pcm: &[f32], output: &Path, src: &Path) -> Result<(), String> {
    let mut child = Command::new(ffmpeg_binary()).args(["-y", "-f", "f32le", "-acodec", "pcm_f32le", "-ar", "48000", "-ac", "1", "-i", "pipe:0", "-i", &norm_path(src), "-map", "0:a", "-map", "1:v?", "-c:v", "copy", &norm_path(output)])
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().map_err(|e| format!("FFmpeg: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        let bytes: Vec<u8> = pcm.iter().flat_map(|s| s.to_le_bytes().to_vec()).collect();
        stdin.write_all(&bytes).map_err(|e| format!("write: {}", e))?;
    }
    let out = child.wait_with_output().map_err(|e| format!("FFmpeg: {}", e))?;
    if !out.status.success() { return Err(format!("FFmpeg encode: {}", String::from_utf8_lossy(&out.stderr))); }
    Ok(())
}

fn estimate_db(orig: &[f32], proc: &[f32]) -> f32 {
    if orig.is_empty() || proc.is_empty() { return 0.0; }
    let o = (orig.iter().map(|x| x * x).sum::<f32>() / orig.len() as f32).sqrt();
    let p = (proc.iter().map(|x| x * x).sum::<f32>() / proc.len() as f32).sqrt();
    if p > 0.0 && o > 0.0 { 20.0 * (o / p).log10() } else { 0.0 }
}

fn emit_progress(app: &AppHandle, id: &str, progress: f32, stage: &str) {
    let _ = app.emit("noise-reduction-progress", NoiseReductionProgressPayload { clip_id: id.into(), progress: progress.clamp(0.0, 1.0), stage: stage.into() });
}
fn is_canceled(id: &str) -> bool { canceled().lock().map(|c| c.contains(id)).unwrap_or(false) }
fn clear_canceled(id: &str) { if let Ok(mut c) = canceled().lock() { c.remove(id); } }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_empty_media_path() { assert_eq!(validate_args("", "t", 0.5).unwrap_err(), "Media path is missing."); }
    #[test]
    fn validates_empty_clip_id() { assert_eq!(validate_args("/a.wav", "", 0.5).unwrap_err(), "Clip ID is missing."); }
    #[test]
    fn validates_strength() { assert!(validate_args("/a.wav", "t", -0.1).is_err()); assert!(validate_args("/a.wav", "t", 1.5).is_err()); }
    #[test]
    fn safe_names() { assert_eq!(safe_name("clip-123"), "clip-123"); assert_eq!(safe_name("a b"), "a_b"); }
    #[test]
    fn norms_paths() { assert_eq!(norm_path(Path::new(r"C:\a\b.wav")), "C:/a/b.wav"); }
    #[test]
    fn estimates_db() { assert!((estimate_db(&vec![0.5; 1000], &vec![0.25; 1000]) - 6.02).abs() < 0.1); }
    fn validate_args(mp: &str, ci: &str, s: f32) -> Result<(), String> {
        if mp.trim().is_empty() { return Err("Media path is missing.".into()); }
        if ci.trim().is_empty() { return Err("Clip ID is missing.".into()); }
        if !(0.0..=1.0).contains(&s) { return Err("Strength must be 0.0-1.0.".into()); }
        Ok(())
    }
}
