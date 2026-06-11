use crate::path_validator::{validate_path, validate_path_for_write};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

static EXPORT_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
static EXPORT_TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);
static HARDWARE_ENCODER_CACHE: OnceLock<Mutex<Option<HardwareEncoderProbe>>> = OnceLock::new();

fn export_child() -> &'static Mutex<Option<Child>> {
    EXPORT_CHILD.get_or_init(|| Mutex::new(None))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegCapabilities {
    available: bool,
    version: Option<String>,
    has_libx264: bool,
    has_aac: bool,
    has_drawtext: bool,
    has_libfreetype: bool,
    has_minterpolate: bool,
    hardware_encoder_available: bool,
    hardware_encoder: Option<String>,
    drawtext_warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareEncoderProbe {
    available: bool,
    encoder: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextArtifactDto {
    clip_id: String,
    text: String,
    file_name: String,
    placeholder: String,
    path_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegExportPlanDto {
    full_args: Vec<String>,
    warnings: Vec<String>,
    text_artifacts: Vec<TextArtifactDto>,
    #[serde(default)]
    passes: Vec<FfmpegExportPassDto>,
    #[serde(default)]
    nested_plans: Vec<NestedFfmpegExportPlanDto>,
    duration: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegExportPassDto {
    name: String,
    full_args: Vec<String>,
    duration: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NestedFfmpegExportPlanDto {
    sequence_id: String,
    placeholder: String,
    plan: Box<FfmpegExportPlanDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    success: bool,
    output_path: String,
    duration_ms: u128,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgressPayload {
    progress: f32,
    progress_pct: f32,
    out_time_us: Option<u64>,
    expected_duration_us: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeClipRequest {
    clip_id: String,
    media_path: String,
    duration: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeClipResult {
    clip_id: String,
    trf_path: String,
    duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClipAnalysisProgressPayload {
    clip_id: String,
    progress: f32,
    progress_pct: f32,
}

#[tauri::command]
pub fn detect_ffmpeg() -> bool {
    Command::new(ffmpeg_binary())
        .arg("-version")
        .output()
        .is_ok()
}

#[tauri::command]
pub fn get_ffmpeg_capabilities() -> FfmpegCapabilities {
    let version_output = command_text(&["-version"]);
    let available = version_output.is_some();
    let filters = command_text(&["-filters"]).unwrap_or_default();
    let buildconf = command_text(&["-buildconf"]).unwrap_or_default();
    let encoders = command_text(&["-encoders"]).unwrap_or_default();
    let has_drawtext = filters.contains("drawtext");
    let has_minterpolate = filters.contains("minterpolate");
    let has_libfreetype =
        buildconf.contains("enable-libfreetype") || buildconf.contains("libfreetype");
    let hardware_encoder = detect_hardware_encoder(&encoders);

    FfmpegCapabilities {
        available,
        version: version_output
            .as_deref()
            .and_then(|text| text.lines().next())
            .map(ToOwned::to_owned),
        has_libx264: encoders.contains("libx264"),
        has_aac: encoders.to_lowercase().contains(" aac"),
        has_drawtext,
        has_libfreetype,
        has_minterpolate,
        hardware_encoder_available: hardware_encoder.available,
        hardware_encoder: hardware_encoder.encoder,
        drawtext_warning: if available && (!has_drawtext || !has_libfreetype) {
            Some("Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export text overlays.".to_string())
        } else {
            None
        },
    }
}

fn detect_hardware_encoder(encoders: &str) -> HardwareEncoderProbe {
    let cache = HARDWARE_ENCODER_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cache.lock() {
        if let Some(cached) = guard.clone() {
            return cached;
        }
    }
    let probe = parse_hardware_encoder_for_os(encoders, std::env::consts::OS);
    if let Ok(mut guard) = cache.lock() {
        *guard = Some(probe.clone());
    }
    probe
}

fn parse_hardware_encoder_for_os(encoders: &str, os: &str) -> HardwareEncoderProbe {
    let target = preferred_hardware_encoder_for_os(os);
    let encoder = target.filter(|name| encoder_list_contains(encoders, name));
    HardwareEncoderProbe {
        available: encoder.is_some(),
        encoder: encoder.map(ToOwned::to_owned),
    }
}

fn preferred_hardware_encoder_for_os(os: &str) -> Option<&'static str> {
    match os {
        "windows" => Some("h264_nvenc"),
        "macos" => Some("h264_videotoolbox"),
        _ => None,
    }
}

fn encoder_list_contains(encoders: &str, encoder: &str) -> bool {
    encoders
        .lines()
        .any(|line| line.split_whitespace().any(|token| token == encoder))
}

#[tauri::command]
pub fn cancel_export() -> Result<(), String> {
    if let Some(mut child) = export_child()
        .lock()
        .map_err(|_| "Unable to lock export process".to_string())?
        .take()
    {
        child.kill().map_err(|error| error.to_string())?;
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command]
pub async fn analyze_clip(
    app: AppHandle,
    request: AnalyzeClipRequest,
) -> Result<AnalyzeClipResult, String> {
    tauri::async_runtime::spawn_blocking(move || analyze_clip_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn run_export(app: AppHandle, plan: FfmpegExportPlanDto) -> Result<ExportResult, String> {
    let mut plan = plan;
    if plan.full_args.is_empty() {
        return Err("FFmpeg argument list is empty.".to_string());
    }
    let nested_dir = if plan.nested_plans.is_empty() {
        None
    } else {
        Some(create_nested_export_dir()?)
    };
    let nested_result = if let Some(dir) = nested_dir.as_deref() {
        run_nested_export_plans(&app, &mut plan, dir)
    } else {
        Ok(())
    };
    if let Err(error) = nested_result {
        if let Some(dir) = nested_dir.as_deref() {
            let _ = fs::remove_dir_all(dir);
        }
        return Err(error);
    }
    let output_path = plan
        .full_args
        .last()
        .cloned()
        .ok_or_else(|| "Export plan is missing output path.".to_string())?;
    if let Some(parent) = Path::new(&output_path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(format!(
                "Export output directory does not exist: {}",
                normalize_path(parent)
            ));
        }
    }
    let output_existed_before = Path::new(&output_path).exists();

    let started = Instant::now();
    let progress_app = app.clone();
    let emit_progress: ProgressEmitter = Arc::new(move |progress| {
        let _ = progress_app.emit("export-progress", progress);
    });
    let started_app = app.clone();
    let emit_started: StartedEmitter = Arc::new(move || {
        let _ = started_app.emit("export-started", ());
    });
    let result = with_temp_export_artifacts(&plan, |materialized, _temp_dir| {
        run_materialized_export_plan(
            &app,
            materialized,
            plan.duration,
            nested_dir.as_deref(),
            _temp_dir,
            emit_progress,
            emit_started,
        )
    });

    match result {
        Ok(()) => {
            if let Some(dir) = nested_dir.as_deref() {
                fs::remove_dir_all(dir).map_err(|error| {
                    format!(
                        "Unable to clean nested export temporary directory {}: {}",
                        normalize_path(dir),
                        error
                    )
                })?;
            }
            Ok(ExportResult {
                success: true,
                output_path,
                duration_ms: started.elapsed().as_millis(),
                warnings: plan.warnings,
            })
        }
        Err(error) => {
            if let Some(dir) = nested_dir.as_deref() {
                let _ = fs::remove_dir_all(dir);
            }
            cleanup_incomplete_output(Path::new(&output_path), output_existed_before)?;
            Err(error)
        }
    }
}

fn analyze_clip_blocking(
    app: AppHandle,
    request: AnalyzeClipRequest,
) -> Result<AnalyzeClipResult, String> {
    let safe_input = validate_path(&app, Path::new(&request.media_path))?;
    let output_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("stabilization");
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let output_path = output_dir.join(format!(
        "{}-{}.trf",
        safe_file_name(&request.clip_id),
        millis
    ));
    let args = build_vidstabdetect_args(&safe_input, &output_path);
    let started = Instant::now();
    let clip_id = request.clip_id.clone();
    let progress_app = app.clone();
    spawn_and_wait_for_clip_analysis(args, request.duration, move |progress| {
        let _ = progress_app.emit(
            "clip-analysis-progress",
            ClipAnalysisProgressPayload {
                clip_id: clip_id.clone(),
                progress: progress.progress,
                progress_pct: progress.progress_pct,
            },
        );
    })?;
    Ok(AnalyzeClipResult {
        clip_id: request.clip_id,
        trf_path: normalize_path(&output_path),
        duration_ms: started.elapsed().as_millis(),
    })
}

fn validate_export_paths(
    app: &AppHandle,
    args: &mut [String],
    nested_dir: Option<&Path>,
    artifact_dir: Option<&Path>,
    validate_output: bool,
) -> Result<(), String> {
    let mut index = 0;
    while index + 1 < args.len() {
        if args[index] == "-i" {
            let input = Path::new(&args[index + 1]);
            if nested_dir.is_some_and(|dir| is_path_inside(input, dir))
                || artifact_dir.is_some_and(|dir| is_path_inside(input, dir))
            {
                args[index + 1] = normalize_path(input);
            } else {
                let safe_input = validate_path(app, input)?;
                args[index + 1] = normalize_path(&safe_input);
            }
            index += 2;
        } else {
            index += 1;
        }
    }
    if !validate_output {
        return Ok(());
    }
    let output_index = args
        .len()
        .checked_sub(1)
        .ok_or_else(|| "FFmpeg argument list is empty.".to_string())?;
    let output = Path::new(&args[output_index]);
    if nested_dir.is_some_and(|dir| is_path_inside(output, dir))
        || artifact_dir.is_some_and(|dir| is_path_inside(output, dir))
    {
        args[output_index] = normalize_path(output);
        return Ok(());
    }
    let safe_output = validate_path_for_write(app, Path::new(&args[output_index]))?;
    args[output_index] = normalize_path(&safe_output);
    Ok(())
}

fn run_nested_export_plans(app: &AppHandle, plan: &mut FfmpegExportPlanDto, nested_dir: &Path) -> Result<(), String> {
    for nested in &mut plan.nested_plans {
        let output_path = nested_dir.join(safe_file_name(&nested.placeholder));
        run_nested_export_plans(app, &mut nested.plan, nested_dir)?;
        replace_placeholder(&mut nested.plan.full_args, &nested.placeholder, &normalize_path(&output_path));
        with_temp_export_artifacts(&nested.plan, |materialized, _temp_dir| {
            run_materialized_export_plan(
                app,
                materialized,
                nested.plan.duration,
                Some(nested_dir),
                _temp_dir,
                Arc::new(|_| {}),
                Arc::new(|| {}),
            )
        })
        .map_err(|error| format!("Nested sequence {} export failed: {}", nested.sequence_id, error))?;
        replace_placeholder(&mut plan.full_args, &nested.placeholder, &normalize_path(&output_path));
    }
    Ok(())
}

type ProgressEmitter = Arc<dyn Fn(ExportProgressPayload) + Send + Sync + 'static>;
type StartedEmitter = Arc<dyn Fn() + Send + Sync + 'static>;

#[derive(Debug, Clone)]
struct MaterializedFfmpegExportPlan {
    full_args: Vec<String>,
    passes: Vec<MaterializedFfmpegExportPass>,
}

#[derive(Debug, Clone)]
struct MaterializedFfmpegExportPass {
    name: String,
    full_args: Vec<String>,
    duration: f64,
}

fn run_materialized_export_plan(
    app: &AppHandle,
    materialized: MaterializedFfmpegExportPlan,
    fallback_duration: f64,
    nested_dir: Option<&Path>,
    artifact_dir: &Path,
    emit_progress: ProgressEmitter,
    emit_started: StartedEmitter,
) -> Result<(), String> {
    if materialized.passes.is_empty() {
        let mut args = materialized.full_args;
        validate_export_paths(app, &mut args, nested_dir, Some(artifact_dir), true)?;
        return spawn_and_wait_with_progress(args, fallback_duration, emit_progress, emit_started);
    }

    for pass in materialized.passes {
        let mut args = pass.full_args;
        validate_export_paths(app, &mut args, nested_dir, Some(artifact_dir), true)?;
        spawn_and_wait_with_progress(
            args,
            pass.duration,
            Arc::clone(&emit_progress),
            Arc::clone(&emit_started),
        )
        .map_err(|error| format!("FFmpeg pass {} failed: {}", pass.name, error))?;
    }
    Ok(())
}

fn spawn_and_wait_with_progress(
    args: Vec<String>,
    duration: f64,
    emit_progress: ProgressEmitter,
    emit_started: StartedEmitter,
) -> Result<(), String> {
    let mut child = Command::new(ffmpeg_binary())
        .args(&args)
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg: {}", error))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg stderr.".to_string())?;
    {
        let mut slot = export_child()
            .lock()
            .map_err(|_| "Unable to lock export process".to_string())?;
        *slot = Some(child);
    }
    emit_started();

    let stderr_lines = Arc::new(Mutex::new(Vec::<String>::new()));
    let stderr_for_thread = Arc::clone(&stderr_lines);
    let emit_from_thread = Arc::clone(&emit_progress);
    let progress_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            if let Ok(mut lines) = stderr_for_thread.lock() {
                lines.push(line.clone());
            }
            if let Some(progress) = parse_progress(&line, duration) {
                emit_from_thread(progress);
            }
        }
    });

    let status_result = loop {
        let maybe_status = {
            let mut slot = export_child()
                .lock()
                .map_err(|_| "Unable to lock export process".to_string())?;
            let Some(child) = slot.as_mut() else {
                break Err("Export canceled.".to_string());
            };
            child.try_wait().map_err(|error| error.to_string())?
        };
        if let Some(status) = maybe_status {
            let _ = export_child()
                .lock()
                .map_err(|_| "Unable to lock export process".to_string())?
                .take();
            break Ok(status);
        }
        std::thread::sleep(Duration::from_millis(100));
    };

    let _ = progress_thread.join();
    match status_result {
        Ok(status) if status.success() => {
            emit_progress(ExportProgressPayload::complete(duration));
            Ok(())
        }
        Ok(status) => {
            let stderr = stderr_lines
                .lock()
                .map(|lines| {
                    lines
                        .iter()
                        .rev()
                        .take(20)
                        .cloned()
                        .collect::<Vec<_>>()
                        .into_iter()
                        .rev()
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_default();
            Err(format!("FFmpeg exited with status {}.\n{}", status, stderr))
        }
        Err(error) => Err(error),
    }
}

fn spawn_and_wait_for_clip_analysis(
    args: Vec<String>,
    duration: f64,
    emit_progress: impl Fn(ExportProgressPayload) + Send + 'static,
) -> Result<(), String> {
    let mut child = Command::new(ffmpeg_binary())
        .args(&args)
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg stabilization analysis: {}", error))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg stabilization stderr.".to_string())?;
    let reader = BufReader::new(stderr);
    let mut stderr_tail = Vec::<String>::new();
    for line in reader.lines().map_while(Result::ok) {
        if stderr_tail.len() >= 20 {
            stderr_tail.remove(0);
        }
        stderr_tail.push(line.clone());
        if let Some(progress) = parse_progress(&line, duration) {
            emit_progress(progress);
        }
    }
    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        return Err(format!(
            "FFmpeg stabilization analysis failed with status {}.\n{}",
            status,
            stderr_tail.join("\n")
        ));
    }
    emit_progress(ExportProgressPayload::complete(duration));
    Ok(())
}

fn build_vidstabdetect_args(input_path: &Path, output_path: &Path) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:2".to_string(),
        "-nostats".to_string(),
        "-i".to_string(),
        normalize_path(input_path),
        "-vf".to_string(),
        format!("vidstabdetect=result={}", escape_filter_path(output_path)),
        "-f".to_string(),
        "null".to_string(),
        "-".to_string(),
    ]
}

fn with_temp_export_artifacts<T>(
    plan: &FfmpegExportPlanDto,
    run: impl FnOnce(MaterializedFfmpegExportPlan, &Path) -> Result<T, String>,
) -> Result<T, String> {
    let temp_dir = create_export_temp_dir()?;
    let result = write_text_artifacts(&temp_dir, &plan.text_artifacts).and_then(|artifact_paths| {
        let mut full_args = plan.full_args.clone();
        replace_text_placeholders(&mut full_args, &artifact_paths);
        let passes = plan
            .passes
            .iter()
            .map(|pass| {
                let mut full_args = pass.full_args.clone();
                replace_text_placeholders(&mut full_args, &artifact_paths);
                MaterializedFfmpegExportPass {
                    name: pass.name.clone(),
                    full_args,
                    duration: pass.duration,
                }
            })
            .collect();
        run(
            MaterializedFfmpegExportPlan { full_args, passes },
            &temp_dir,
        )
    });
    let cleanup = fs::remove_dir_all(&temp_dir).map_err(|error| {
        format!(
            "Unable to clean export temporary directory {}: {}",
            normalize_path(&temp_dir),
            error
        )
    });
    match (result, cleanup) {
        (Ok(value), Ok(())) => Ok(value),
        (Err(error), _) => Err(error),
        (Ok(_), Err(error)) => Err(error),
    }
}

fn write_text_artifacts(
    temp_dir: &Path,
    artifacts: &[TextArtifactDto],
) -> Result<Vec<(String, String)>, String> {
    let mut result = Vec::new();
    for artifact in artifacts {
        let safe_name = safe_file_name(&artifact.file_name);
        let path = temp_dir.join(safe_name);
        fs::write(&path, artifact.text.as_bytes()).map_err(|error| {
            format!(
                "Unable to write text artifact {}: {}",
                artifact.clip_id, error
            )
        })?;
        result.push((
            artifact.placeholder.clone(),
            artifact_path_for_mode(&path, artifact.path_mode.as_deref()),
        ));
    }
    Ok(result)
}

fn artifact_path_for_mode(path: &Path, path_mode: Option<&str>) -> String {
    let normalized = normalize_path(path);
    match path_mode {
        Some("argument") => normalized,
        _ => escape_drawtext_path(&normalized),
    }
}

fn replace_text_placeholders(args: &mut [String], artifacts: &[(String, String)]) {
    for arg in args {
        for (placeholder, path) in artifacts {
            *arg = arg.replace(placeholder, path);
        }
    }
}

fn create_export_temp_dir() -> Result<PathBuf, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let counter = EXPORT_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!(
        "open-factory-export-{}-{}-{}",
        std::process::id(),
        millis,
        counter
    ));
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn create_nested_export_dir() -> Result<PathBuf, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let counter = EXPORT_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir()
        .join("open-factory")
        .join("nested")
        .join(format!("{}-{}-{}", std::process::id(), millis, counter));
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn replace_placeholder(args: &mut [String], placeholder: &str, value: &str) {
    for arg in args {
        *arg = arg.replace(placeholder, value);
    }
}

fn is_path_inside(path: &Path, parent: &Path) -> bool {
    let path = path.components().collect::<Vec<_>>();
    let parent = parent.components().collect::<Vec<_>>();
    path.len() >= parent.len() && path.iter().zip(parent.iter()).all(|(left, right)| left == right)
}

fn cleanup_incomplete_output(output_path: &Path, existed_before: bool) -> Result<(), String> {
    if existed_before || !output_path.exists() {
        return Ok(());
    }
    fs::remove_file(output_path).map_err(|error| {
        format!(
            "Unable to remove incomplete export output {}: {}",
            normalize_path(output_path),
            error
        )
    })
}

fn command_text(args: &[&str]) -> Option<String> {
    let output = Command::new(ffmpeg_binary()).args(args).output().ok()?;
    let mut text = String::from_utf8_lossy(&output.stdout).to_string();
    text.push_str(&String::from_utf8_lossy(&output.stderr));
    Some(text)
}

fn ffmpeg_binary() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

fn parse_progress(line: &str, total_duration: f64) -> Option<ExportProgressPayload> {
    if let Some(value) = line.strip_prefix("out_time_us=") {
        let out_time_us = value.trim().parse::<u64>().ok()?;
        return Some(ExportProgressPayload::from_out_time_us(
            out_time_us,
            expected_duration_us(total_duration),
        ));
    }
    let (_, rest) = line.split_once("time=")?;
    let time = rest.split_whitespace().next()?;
    let seconds = parse_ffmpeg_time(time)?;
    Some(ExportProgressPayload::from_out_time_us(
        seconds_to_us(seconds),
        expected_duration_us(total_duration),
    ))
}

fn parse_ffmpeg_time(value: &str) -> Option<f64> {
    let mut parts = value.split(':');
    let hours = parts.next()?.parse::<f64>().ok()?;
    let minutes = parts.next()?.parse::<f64>().ok()?;
    let seconds = parts.next()?.parse::<f64>().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
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

fn expected_duration_us(total_duration: f64) -> u64 {
    if total_duration.is_finite() && total_duration > 0.0 {
        seconds_to_us(total_duration)
    } else {
        0
    }
}

fn seconds_to_us(seconds: f64) -> u64 {
    (seconds.max(0.0) * 1_000_000.0).round() as u64
}

fn calculate_progress_pct(out_time_us: u64, expected_duration_us: u64) -> f32 {
    if expected_duration_us == 0 {
        return 0.0;
    }
    (((out_time_us as f64 / expected_duration_us as f64) * 100.0).clamp(0.0, 100.0)) as f32
}

impl ExportProgressPayload {
    fn from_out_time_us(out_time_us: u64, expected_duration_us: u64) -> Self {
        let progress_pct = calculate_progress_pct(out_time_us, expected_duration_us);
        Self {
            progress: progress_pct / 100.0,
            progress_pct,
            out_time_us: Some(out_time_us),
            expected_duration_us,
        }
    }

    fn complete(total_duration: f64) -> Self {
        let duration_us = expected_duration_us(total_duration);
        Self {
            progress: 1.0,
            progress_pct: 100.0,
            out_time_us: Some(duration_us),
            expected_duration_us: duration_us,
        }
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn escape_drawtext_path(path: &str) -> String {
    path.replace('\\', "/")
        .replace(':', "\\\\:")
        .replace('\'', "\\'")
        .replace('%', "\\%")
}

fn escape_filter_path(path: &Path) -> String {
    normalize_path(path)
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace('%', "\\%")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ffmpeg_progress_lines() {
        assert_eq!(
            parse_progress(
                "frame=10 fps=0.0 q=-1.0 time=00:00:02.50 bitrate=1.0kbits/s",
                10.0
            ),
            Some(ExportProgressPayload::from_out_time_us(
                2_500_000, 10_000_000
            ))
        );
        assert_eq!(
            parse_progress("out_time_us=2500000", 10.0),
            Some(ExportProgressPayload::from_out_time_us(
                2_500_000, 10_000_000
            ))
        );
        assert_eq!(
            parse_progress("frame=10 time=00:00:12.00", 10.0),
            Some(ExportProgressPayload::from_out_time_us(
                12_000_000, 10_000_000
            ))
        );
        assert_eq!(parse_progress("frame=10 speed=1x", 10.0), None);
    }

    #[test]
    fn parses_preferred_hardware_encoders_by_platform() {
        let encoders = r#"
 Encoders:
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder
 V....D h264_nvenc_extra     Not the exact encoder token
"#;

        assert_eq!(
            parse_hardware_encoder_for_os(encoders, "windows"),
            HardwareEncoderProbe {
                available: true,
                encoder: Some("h264_nvenc".to_string()),
            }
        );
        assert_eq!(
            parse_hardware_encoder_for_os(encoders, "macos"),
            HardwareEncoderProbe {
                available: true,
                encoder: Some("h264_videotoolbox".to_string()),
            }
        );
        assert_eq!(
            parse_hardware_encoder_for_os(encoders, "linux"),
            HardwareEncoderProbe {
                available: false,
                encoder: None,
            }
        );
    }

    #[test]
    fn hardware_encoder_parser_requires_exact_encoder_token() {
        let encoders = " V....D h264_nvenc_extra Not exact";

        assert_eq!(
            parse_hardware_encoder_for_os(encoders, "windows"),
            HardwareEncoderProbe {
                available: false,
                encoder: None,
            }
        );
    }

    #[test]
    fn builds_vidstabdetect_argument_array_without_shell_strings() {
        let args = build_vidstabdetect_args(
            Path::new(r"C:\Media\clip.mp4"),
            Path::new(r"C:\Temp\open factory\clip.trf"),
        );

        assert_eq!(args[0], "-y");
        assert_eq!(args.iter().filter(|arg| arg.as_str() == "-i").count(), 1);
        assert_eq!(args, vec![
            "-y",
            "-progress",
            "pipe:2",
            "-nostats",
            "-i",
            "C:/Media/clip.mp4",
            "-vf",
            r"vidstabdetect=result=C\:/Temp/open factory/clip.trf",
            "-f",
            "null",
            "-"
        ]);
        assert!(!args.iter().any(|arg| arg.contains("cmd /C") || arg.contains("&&")));
    }

    #[test]
    fn calculates_progress_pct_with_clamped_boundaries() {
        assert_eq!(calculate_progress_pct(0, 10_000_000), 0.0);
        assert_eq!(calculate_progress_pct(2_500_000, 10_000_000), 25.0);
        assert_eq!(calculate_progress_pct(12_000_000, 10_000_000), 100.0);
        assert_eq!(calculate_progress_pct(1_000_000, 0), 0.0);
    }

    #[test]
    fn completion_progress_payload_converges_to_one_hundred_percent() {
        assert_eq!(
            ExportProgressPayload::complete(1.5),
            ExportProgressPayload {
                progress: 1.0,
                progress_pct: 100.0,
                out_time_us: Some(1_500_000),
                expected_duration_us: 1_500_000,
            }
        );
    }

    #[test]
    fn parses_ffmpeg_time_values_defensively() {
        assert_eq!(parse_ffmpeg_time("01:02:03.50"), Some(3723.5));
        assert_eq!(parse_ffmpeg_time("not-a-time"), None);
        assert_eq!(parse_ffmpeg_time("00:bad:01.00"), None);
    }

    #[test]
    fn safe_file_name_removes_path_and_filter_delimiters() {
        assert_eq!(safe_file_name("../clip:text 01.txt"), ".._clip_text_01.txt");
        assert_eq!(safe_file_name("标题%clip.txt"), "___clip.txt");
    }

    #[test]
    fn cancel_export_is_ok_when_idle() {
        *export_child().lock().expect("export child lock") = None;
        cancel_export().expect("idle cancellation should not fail");
    }

    #[test]
    fn cancel_export_clears_running_child_slot() {
        let child = spawn_long_running_child();
        *export_child().lock().expect("export child lock") = Some(child);

        cancel_export().expect("running cancellation should not fail");

        assert!(export_child().lock().expect("export child lock").is_none());
    }

    #[test]
    fn temp_text_artifacts_are_removed_on_failure() {
        let plan = FfmpegExportPlanDto {
            full_args: vec![
                "-filter_complex".to_string(),
                "drawtext=textfile=__TEXTFILE_clip_text__".to_string(),
                "out.mp4".to_string(),
            ],
            warnings: vec![],
            text_artifacts: vec![TextArtifactDto {
                clip_id: "clip-text".to_string(),
                text: "hello from a text artifact".to_string(),
                file_name: "../clip:text.txt".to_string(),
                placeholder: "__TEXTFILE_clip_text__".to_string(),
                path_mode: None,
            }],
            passes: vec![],
            nested_plans: vec![],
            duration: 1.0,
        };
        let mut observed_temp_dir: Option<PathBuf> = None;

        let result: Result<(), String> =
            with_temp_export_artifacts(&plan, |materialized, temp_dir| {
                let args = materialized.full_args;
                let safe_artifact = temp_dir.join(".._clip_text.txt");
                assert!(temp_dir.exists());
                assert!(safe_artifact.exists());
                assert!(args.iter().any(|arg| arg.contains("drawtext=textfile=")
                    && !arg.contains("__TEXTFILE_clip_text__")));
                observed_temp_dir = Some(temp_dir.to_path_buf());
                Err("forced export failure".to_string())
            });

        assert_eq!(result.unwrap_err(), "forced export failure");
        let temp_dir = observed_temp_dir.expect("temp dir should be observed");
        assert!(
            !temp_dir.exists(),
            "temporary export dir should be removed after failure"
        );
    }

    #[test]
    fn temp_artifacts_are_materialized_for_multi_pass_exports() {
        let plan = FfmpegExportPlanDto {
            full_args: vec![
                "-i".to_string(),
                "__GIF_PALETTE_open_factory__".to_string(),
                "D:/Exports/out.gif".to_string(),
            ],
            warnings: vec![],
            text_artifacts: vec![TextArtifactDto {
                clip_id: "gif-palette".to_string(),
                text: "".to_string(),
                file_name: "gif-palette.png".to_string(),
                placeholder: "__GIF_PALETTE_open_factory__".to_string(),
                path_mode: Some("argument".to_string()),
            }],
            passes: vec![
                FfmpegExportPassDto {
                    name: "gif-palettegen".to_string(),
                    full_args: vec![
                        "-f".to_string(),
                        "image2".to_string(),
                        "__GIF_PALETTE_open_factory__".to_string(),
                    ],
                    duration: 1.0,
                },
                FfmpegExportPassDto {
                    name: "gif-paletteuse".to_string(),
                    full_args: vec![
                        "-i".to_string(),
                        "__GIF_PALETTE_open_factory__".to_string(),
                        "D:/Exports/out.gif".to_string(),
                    ],
                    duration: 1.0,
                },
            ],
            nested_plans: vec![],
            duration: 1.0,
        };
        let mut observed_temp_dir: Option<PathBuf> = None;

        with_temp_export_artifacts(&plan, |materialized, temp_dir| {
            observed_temp_dir = Some(temp_dir.to_path_buf());
            assert_eq!(materialized.passes.len(), 2);
            assert!(!materialized
                .passes
                .iter()
                .flat_map(|pass| pass.full_args.iter())
                .any(|arg| arg.contains("__GIF_PALETTE_open_factory__")));
            assert!(materialized.passes[0].full_args[2].ends_with("gif-palette.png"));
            assert_eq!(materialized.passes[0].full_args[2], materialized.passes[1].full_args[1]);
            assert!(Path::new(&materialized.passes[0].full_args[2]).exists());
            Ok(())
        })
        .expect("multi-pass artifacts should materialize");

        let temp_dir = observed_temp_dir.expect("temp dir should be observed");
        assert!(
            !temp_dir.exists(),
            "temporary export dir should be removed after multi-pass materialization"
        );
    }

    #[test]
    fn drawtext_paths_are_escaped_for_filter_graph_parsing() {
        let cases = [
            (
                "Windows drive, backslashes, and spaces",
                r"C:\Media Files\clip title.txt",
                r"C\\:/Media Files/clip title.txt",
            ),
            (
                "Windows path with nested colon and quote",
                r"D:\Fonts\A:rial's.ttf",
                r"D\\:/Fonts/A\\:rial\'s.ttf",
            ),
            (
                "Windows path with percent signs",
                r"E:\Exports\100% ready\text.txt",
                r"E\\:/Exports/100\% ready/text.txt",
            ),
            (
                "macOS absolute path with spaces and parentheses",
                "/Users/editor/Video Text (Final).txt",
                "/Users/editor/Video Text (Final).txt",
            ),
            (
                "Linux absolute path with a single quote",
                "/home/editor/it's ready/text.txt",
                r"/home/editor/it\'s ready/text.txt",
            ),
            (
                "Linux absolute path with equals and ampersand",
                "/tmp/filter=a&b/title.txt",
                "/tmp/filter=a&b/title.txt",
            ),
            (
                "path with Chinese characters",
                r"C:\素材\标题 文本.txt",
                r"C\\:/素材/标题 文本.txt",
            ),
            (
                "mixed path with percent, ampersand, equals, and quote",
                "/mnt/media/标题 100%/a&b='yes'.txt",
                r"/mnt/media/标题 100\%/a&b=\'yes\'.txt",
            ),
        ];

        for (name, input, expected) in cases {
            assert_eq!(escape_drawtext_path(input), expected, "{name}");
        }
    }

    #[test]
    fn artifact_argument_paths_are_not_filter_escaped() {
        let path = Path::new(r"C:\Temp\subtitle file.srt");

        assert_eq!(
            artifact_path_for_mode(path, Some("argument")),
            "C:/Temp/subtitle file.srt"
        );
        assert_eq!(
            artifact_path_for_mode(path, Some("filter")),
            r"C\\:/Temp/subtitle file.srt"
        );
    }

    #[test]
    fn incomplete_output_cleanup_removes_only_new_files() {
        let temp_dir = create_export_temp_dir().expect("temp dir");
        let new_output = temp_dir.join("new-output.mp4");
        fs::write(&new_output, b"partial").expect("partial output");

        cleanup_incomplete_output(&new_output, false).expect("new partial cleanup");
        assert!(!new_output.exists());

        let existing_output = temp_dir.join("existing-output.mp4");
        fs::write(&existing_output, b"existing").expect("existing output");
        cleanup_incomplete_output(&existing_output, true).expect("existing output preserved");
        assert!(existing_output.exists());

        fs::remove_dir_all(&temp_dir).expect("temp dir cleanup");
    }

    #[test]
    fn real_ffmpeg_failure_is_reported_and_child_slot_is_cleared() {
        if !detect_ffmpeg() {
            return;
        }
        let progress_values = Arc::new(Mutex::new(Vec::<ExportProgressPayload>::new()));
        let progress_values_for_emit = Arc::clone(&progress_values);

        let result = spawn_and_wait_with_progress(
            vec!["-this-option-does-not-exist".to_string()],
            1.0,
            Arc::new(move |progress| {
                progress_values_for_emit
                    .lock()
                    .expect("progress lock")
                    .push(progress);
            }),
            Arc::new(|| {}),
        );

        let error = result.expect_err("invalid ffmpeg args should fail");
        assert!(error.contains("FFmpeg exited with status"), "{error}");
        assert!(export_child().lock().expect("export child lock").is_none());
    }

    #[cfg(windows)]
    fn spawn_long_running_child() -> Child {
        Command::new("cmd")
            .args(["/C", "ping -n 30 127.0.0.1 >NUL"])
            .spawn()
            .expect("spawn long running child")
    }

    #[cfg(not(windows))]
    fn spawn_long_running_child() -> Child {
        Command::new("sh")
            .args(["-c", "sleep 30"])
            .spawn()
            .expect("spawn long running child")
    }
}
