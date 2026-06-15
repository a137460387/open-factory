use crate::path_validator::{validate_path, validate_path_for_write};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

const DEFAULT_EXPORT_TASK_ID: &str = "__default_export__";
static EXPORT_CHILDREN: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
static MOTION_TRACKING_CHILDREN: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
static QUALITY_EVALUATION_CHILDREN: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
static EXPORT_TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);
static HARDWARE_ENCODER_CACHE: OnceLock<Mutex<Option<HardwareEncoderProbe>>> = OnceLock::new();
pub const EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES: u64 = 2 * 1024 * 1024 * 1024;

fn export_children() -> &'static Mutex<HashMap<String, Child>> {
    EXPORT_CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
}

fn motion_tracking_children() -> &'static Mutex<HashMap<String, Child>> {
    MOTION_TRACKING_CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
}

fn quality_evaluation_children() -> &'static Mutex<HashMap<String, Child>> {
    QUALITY_EVALUATION_CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
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
    has_arnndn: bool,
    has_libvmaf: bool,
    hardware_encoder_available: bool,
    hardware_encoder: Option<String>,
    drawtext_warning: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemResourceSnapshot {
    cpu_usage: f32,
    total_memory_bytes: u64,
    available_memory_bytes: u64,
    used_memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareEncoderProbe {
    available: bool,
    encoder: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
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
struct CustomShaderSequenceManifest {
    kind: String,
    clip_id: String,
    preset: Option<String>,
    media_path: String,
    clip_type: String,
    trim_start: f64,
    source_duration: f64,
    duration: f64,
    speed: f64,
    width: u32,
    height: u32,
    fps: f64,
    frame_count: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathTextSequenceManifest {
    kind: String,
    clip_id: String,
    width: u32,
    height: u32,
    fps: f64,
    frame_count: u32,
    font_size: f64,
    font_color: String,
    font_path: Option<String>,
    frames: Vec<PathTextFrameManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathTextFrameManifest {
    chars: Vec<PathTextCharManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathTextCharManifest {
    char: String,
    x: f64,
    y: f64,
    #[allow(dead_code)]
    angle: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegExportPlanDto {
    #[serde(default)]
    project_name: Option<String>,
    full_args: Vec<String>,
    warnings: Vec<String>,
    text_artifacts: Vec<TextArtifactDto>,
    #[serde(default)]
    passes: Vec<FfmpegExportPassDto>,
    #[serde(default)]
    nested_plans: Vec<NestedFfmpegExportPlanDto>,
    duration: f64,
    #[serde(default)]
    post_export_script: Option<PostExportScriptDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostExportScriptDto {
    command: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegExportPassDto {
    name: String,
    full_args: Vec<String>,
    duration: f64,
    #[serde(default)]
    kind: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
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
    report: ExportReport,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreviewSampleDto {
    id: String,
    kind: String,
    label: String,
    time: f64,
    output_path: String,
    plan: FfmpegExportPlanDto,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreviewSamplesRequest {
    samples: Vec<ExportPreviewSampleDto>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreviewSampleResult {
    id: String,
    kind: String,
    label: String,
    time: f64,
    path: String,
    duration_ms: u128,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreviewSamplesResult {
    samples: Vec<ExportPreviewSampleResult>,
    duration_ms: u128,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportReport {
    #[serde(skip_serializing_if = "Option::is_none")]
    loudness: Option<LoudnessReport>,
    #[serde(skip_serializing_if = "Option::is_none")]
    post_export_script: Option<PostExportScriptResult>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoudnessReport {
    integrated_loudness: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PostExportScriptResult {
    command: String,
    resolved_command: String,
    program: String,
    args: Vec<String>,
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgressPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    task_id: Option<String>,
    progress: f32,
    progress_pct: f32,
    out_time_us: Option<u64>,
    expected_duration_us: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportStartedPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    task_id: Option<String>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeMotionTrackRequest {
    clip_id: String,
    media_path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MotionTrackPointDto {
    time: f64,
    dx: f64,
    dy: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeMotionTrackResult {
    clip_id: String,
    points: Vec<MotionTrackPointDto>,
    duration_ms: u128,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityEvaluationRequest {
    task_id: String,
    source_path: String,
    output_path: String,
    duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QualityEvaluationProgressPayload {
    task_id: String,
    progress: f32,
    progress_pct: f32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QualityEvaluationResult {
    task_id: String,
    ssim: Option<f64>,
    psnr: Option<f64>,
    vmaf: Option<f64>,
    vmaf_available: bool,
    duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClipAnalysisProgressPayload {
    clip_id: String,
    progress: f32,
    progress_pct: f32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MotionTrackProgressPayload {
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
    let has_drawtext = filter_list_contains(&filters, "drawtext");
    let has_minterpolate = filter_list_contains(&filters, "minterpolate");
    let has_arnndn = filter_list_contains(&filters, "arnndn");
    let has_libvmaf = ffmpeg_supports_libvmaf(&filters);
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
        has_arnndn,
        has_libvmaf,
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

fn filter_list_contains(filters: &str, filter_name: &str) -> bool {
    filters
        .lines()
        .filter_map(|line| {
            let mut tokens = line.split_whitespace();
            let _flags = tokens.next()?;
            tokens.next()
        })
        .any(|token| token == filter_name)
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

#[tauri::command(rename_all = "camelCase")]
pub fn cancel_export(task_id: Option<String>) -> Result<(), String> {
    let slot_id = export_slot_id(task_id.as_deref());
    if let Some(mut child) = export_children()
        .lock()
        .map_err(|_| "Unable to lock export process".to_string())?
        .remove(&slot_id)
    {
        child.kill().map_err(|error| error.to_string())?;
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn cancel_motion_tracking(clip_id: String) -> Result<(), String> {
    if let Some(mut child) = motion_tracking_children()
        .lock()
        .map_err(|_| "Unable to lock motion tracking process".to_string())?
        .remove(&clip_id)
    {
        child.kill().map_err(|error| error.to_string())?;
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn cancel_quality_evaluation(task_id: String) -> Result<(), String> {
    if let Some(mut child) = quality_evaluation_children()
        .lock()
        .map_err(|_| "Unable to lock quality evaluation process".to_string())?
        .remove(&task_id)
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
pub async fn analyze_motion_track(
    app: AppHandle,
    request: AnalyzeMotionTrackRequest,
) -> Result<AnalyzeMotionTrackResult, String> {
    tauri::async_runtime::spawn_blocking(move || analyze_motion_track_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn evaluate_export_quality(
    app: AppHandle,
    request: QualityEvaluationRequest,
) -> Result<QualityEvaluationResult, String> {
    tauri::async_runtime::spawn_blocking(move || evaluate_export_quality_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn run_export(
    app: AppHandle,
    plan: FfmpegExportPlanDto,
    task_id: Option<String>,
) -> Result<ExportResult, String> {
    let mut plan = plan;
    if plan.full_args.is_empty() {
        return Err("FFmpeg argument list is empty.".to_string());
    }
    let slot_id = export_slot_id(task_id.as_deref());
    let log_path = initialize_export_log(&app, &slot_id)?;
    let nested_dir = if plan.nested_plans.is_empty() {
        None
    } else {
        Some(create_nested_export_dir()?)
    };
    let nested_result = if let Some(dir) = nested_dir.as_deref() {
        run_nested_export_plans(&app, &mut plan, dir, &slot_id, &log_path, None)
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
    let progress_task_id = task_id.clone();
    let emit_progress: ProgressEmitter = Arc::new(move |mut progress| {
        progress.task_id = progress_task_id.clone();
        let _ = progress_app.emit("export-progress", progress);
    });
    let started_app = app.clone();
    let started_task_id = task_id.clone();
    let emit_started: StartedEmitter = Arc::new(move || {
        let _ = started_app.emit(
            "export-started",
            ExportStartedPayload {
                task_id: started_task_id.clone(),
            },
        );
    });
    let result = with_temp_export_artifacts(&plan, |materialized, _temp_dir| {
        run_materialized_export_plan(
            &app,
            materialized,
            plan.duration,
            nested_dir.as_deref(),
            _temp_dir,
            &slot_id,
            Some(&log_path),
            emit_progress,
            emit_started,
            None,
        )
    });

    match result {
        Ok(mut report) => {
            if let Some(dir) = nested_dir.as_deref() {
                fs::remove_dir_all(dir).map_err(|error| {
                    format!(
                        "Unable to clean nested export temporary directory {}: {}",
                        normalize_path(dir),
                        error
                    )
                })?;
            }
            if let Some(script_result) = run_post_export_script(
                plan.post_export_script.as_ref(),
                PostExportScriptContext {
                    output_path: &output_path,
                    project_name: plan.project_name.as_deref().unwrap_or_default(),
                    duration_seconds: plan.duration,
                    now: SystemTime::now(),
                },
            ) {
                let _ = append_post_export_script_log(&log_path, &script_result);
                report.post_export_script = Some(script_result);
            }
            Ok(ExportResult {
                success: true,
                output_path,
                duration_ms: started.elapsed().as_millis(),
                warnings: plan.warnings,
                report,
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

#[tauri::command(rename_all = "camelCase")]
pub async fn run_export_preview_samples(
    app: AppHandle,
    request: ExportPreviewSamplesRequest,
) -> Result<ExportPreviewSamplesResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_export_preview_samples_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

fn run_export_preview_samples_blocking(
    app: AppHandle,
    request: ExportPreviewSamplesRequest,
) -> Result<ExportPreviewSamplesResult, String> {
    validate_export_preview_sample_count(&request.samples)?;
    let timeout = export_preview_timeout(request.timeout_ms);
    let started = Instant::now();
    let runner_app = app.clone();
    let runner: PreviewSampleRunner = Arc::new(move |sample| {
        run_export_preview_sample_blocking(&runner_app, sample, timeout)
    });
    let samples = run_export_preview_samples_parallel(request.samples, runner)?;
    Ok(ExportPreviewSamplesResult {
        samples,
        duration_ms: started.elapsed().as_millis(),
    })
}

type PreviewSampleRunner =
    Arc<dyn Fn(ExportPreviewSampleDto) -> Result<ExportPreviewSampleResult, String> + Send + Sync>;

fn run_export_preview_samples_parallel(
    samples: Vec<ExportPreviewSampleDto>,
    runner: PreviewSampleRunner,
) -> Result<Vec<ExportPreviewSampleResult>, String> {
    let handles = samples
        .into_iter()
        .map(|sample| {
            let runner = Arc::clone(&runner);
            std::thread::spawn(move || runner(sample))
        })
        .collect::<Vec<_>>();
    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
        results.push(
            handle
                .join()
                .map_err(|_| "Export preview worker panicked.".to_string())??,
        );
    }
    Ok(results)
}

fn run_export_preview_sample_blocking(
    app: &AppHandle,
    sample: ExportPreviewSampleDto,
    timeout: Duration,
) -> Result<ExportPreviewSampleResult, String> {
    if sample.plan.full_args.is_empty() {
        return Err(format!("Export preview sample {} has empty FFmpeg args.", sample.id));
    }
    let output_path = export_preview_sample_output_path(&sample)?;
    let mut plan = sample.plan;
    if let Some(parent) = Path::new(&output_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Unable to create export preview directory {}: {}",
                    normalize_path(parent),
                    error
                )
            })?;
        }
    }
    let nested_dir = if plan.nested_plans.is_empty() {
        None
    } else {
        Some(create_nested_export_dir()?)
    };
    let slot_id = export_slot_id(Some(&format!("export-preview-{}", sample.id)));
    let started = Instant::now();
    let nested_log_path = nested_dir.as_ref().map(|dir| dir.join("preview-nested.log"));
    if let Some(log_path) = nested_log_path.as_deref() {
        fs::write(log_path, "open-factory export preview nested log\n").map_err(|error| {
            format!(
                "Unable to write export preview nested log {}: {}",
                normalize_path(log_path),
                error
            )
        })?;
    }
    if let (Some(dir), Some(log_path)) = (nested_dir.as_deref(), nested_log_path.as_deref()) {
        run_nested_export_plans(app, &mut plan, dir, &slot_id, log_path, Some(timeout))?;
    }
    let result = with_temp_export_artifacts(&plan, |materialized, temp_dir| {
        run_materialized_export_plan(
            app,
            materialized,
            plan.duration,
            nested_dir.as_deref(),
            temp_dir,
            &slot_id,
            None,
            Arc::new(|_| {}),
            Arc::new(|| {}),
            Some(timeout),
        )
    });
    if let Some(dir) = nested_dir.as_deref() {
        let _ = fs::remove_dir_all(dir);
    }
    result?;
    Ok(ExportPreviewSampleResult {
        id: sample.id,
        kind: sample.kind,
        label: sample.label,
        time: sample.time,
        path: output_path,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn validate_export_preview_sample_count(samples: &[ExportPreviewSampleDto]) -> Result<(), String> {
    if samples.len() == 3 {
        return Ok(());
    }
    Err("Export preview requires exactly three sample plans.".to_string())
}

fn export_preview_timeout(timeout_ms: Option<u64>) -> Duration {
    Duration::from_millis(timeout_ms.unwrap_or(10_000).clamp(1, 60_000))
}

fn export_preview_sample_output_path(sample: &ExportPreviewSampleDto) -> Result<String, String> {
    let output_path = sample
        .plan
        .full_args
        .last()
        .cloned()
        .ok_or_else(|| format!("Export preview sample {} is missing output path.", sample.id))?;
    if sample.output_path != output_path {
        return Err(format!(
            "Export preview sample {} output path does not match its plan.",
            sample.id
        ));
    }
    Ok(output_path)
}

fn evaluate_export_quality_blocking(
    app: AppHandle,
    request: QualityEvaluationRequest,
) -> Result<QualityEvaluationResult, String> {
    if request.task_id.trim().is_empty() {
        return Err("Quality evaluation task id is required.".to_string());
    }
    let safe_source = validate_path(&app, Path::new(&request.source_path))?;
    let safe_output = validate_path(&app, Path::new(&request.output_path))?;
    let filters = command_text(&["-filters"]).unwrap_or_default();
    let include_vmaf = ffmpeg_supports_libvmaf(&filters);
    let args = build_quality_evaluation_args(&safe_source, &safe_output, include_vmaf);
    let started = Instant::now();
    let emit_task_id = request.task_id.clone();
    let progress_app = app.clone();
    let stderr_text = spawn_and_capture_quality_evaluation(
        &request.task_id,
        args,
        request.duration.unwrap_or(0.0),
        move |progress| {
            let _ = progress_app.emit(
                "quality-evaluation-progress",
                QualityEvaluationProgressPayload {
                    task_id: emit_task_id.clone(),
                    progress: progress.progress,
                    progress_pct: progress.progress_pct,
                },
            );
        },
    )?;
    let metrics = parse_quality_metrics(&stderr_text);
    Ok(QualityEvaluationResult {
        task_id: request.task_id,
        ssim: metrics.ssim,
        psnr: metrics.psnr,
        vmaf: metrics.vmaf,
        vmaf_available: include_vmaf,
        duration_ms: started.elapsed().as_millis(),
    })
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

fn analyze_motion_track_blocking(
    app: AppHandle,
    request: AnalyzeMotionTrackRequest,
) -> Result<AnalyzeMotionTrackResult, String> {
    let safe_input = validate_path(&app, Path::new(&request.media_path))?;
    let args = build_motion_track_args(&safe_input);
    let started = Instant::now();
    let slot_clip_id = request.clip_id.clone();
    let emit_clip_id = request.clip_id.clone();
    let progress_app = app.clone();
    let stderr_text = spawn_and_capture_motion_tracking(
        &slot_clip_id,
        args,
        request.duration,
        move |progress| {
            let _ = progress_app.emit(
                "motion-track-progress",
                MotionTrackProgressPayload {
                    clip_id: emit_clip_id.clone(),
                    progress: progress.progress,
                    progress_pct: progress.progress_pct,
                },
            );
        },
    )?;
    Ok(AnalyzeMotionTrackResult {
        clip_id: request.clip_id,
        points: parse_motion_vectors_from_mestimate_output(&stderr_text),
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

fn run_nested_export_plans(
    app: &AppHandle,
    plan: &mut FfmpegExportPlanDto,
    nested_dir: &Path,
    slot_id: &str,
    log_path: &Path,
    timeout: Option<Duration>,
) -> Result<(), String> {
    for nested in &mut plan.nested_plans {
        let output_path = nested_dir.join(safe_file_name(&nested.placeholder));
        run_nested_export_plans(app, &mut nested.plan, nested_dir, slot_id, log_path, timeout)?;
        replace_placeholder(
            &mut nested.plan.full_args,
            &nested.placeholder,
            &normalize_path(&output_path),
        );
        with_temp_export_artifacts(&nested.plan, |materialized, _temp_dir| {
            run_materialized_export_plan(
                app,
                materialized,
                nested.plan.duration,
                Some(nested_dir),
                _temp_dir,
                slot_id,
                Some(log_path),
                Arc::new(|_| {}),
                Arc::new(|| {}),
                timeout,
            )
        })
        .map_err(|error| {
            format!(
                "Nested sequence {} export failed: {}",
                nested.sequence_id, error
            )
        })?;
        replace_placeholder(
            &mut plan.full_args,
            &nested.placeholder,
            &normalize_path(&output_path),
        );
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
    kind: Option<String>,
}

#[tauri::command]
pub fn get_available_memory_bytes() -> u64 {
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    system.available_memory()
}

#[tauri::command]
pub fn get_system_resource_snapshot() -> SystemResourceSnapshot {
    let mut system = sysinfo::System::new_all();
    system.refresh_cpu();
    system.refresh_memory();
    let total_memory_bytes = system.total_memory();
    let available_memory_bytes = system.available_memory();
    SystemResourceSnapshot {
        cpu_usage: system.global_cpu_info().cpu_usage(),
        total_memory_bytes,
        available_memory_bytes,
        used_memory_bytes: total_memory_bytes.saturating_sub(available_memory_bytes),
    }
}

pub fn should_pause_export_for_memory(available_memory_bytes: u64) -> bool {
    available_memory_bytes < EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES
}

fn run_materialized_export_plan(
    app: &AppHandle,
    materialized: MaterializedFfmpegExportPlan,
    fallback_duration: f64,
    nested_dir: Option<&Path>,
    artifact_dir: &Path,
    slot_id: &str,
    log_path: Option<&Path>,
    emit_progress: ProgressEmitter,
    emit_started: StartedEmitter,
    timeout: Option<Duration>,
) -> Result<ExportReport, String> {
    if materialized.passes.is_empty() {
        let mut args = materialized.full_args;
        validate_export_paths(app, &mut args, nested_dir, Some(artifact_dir), true)?;
        spawn_and_wait_with_progress(
            slot_id,
            args,
            fallback_duration,
            log_path,
            emit_progress,
            emit_started,
            timeout,
        )?;
        return Ok(ExportReport::default());
    }

    let mut report = ExportReport::default();
    let mut loudness_measurement: Option<LoudnormMeasurement> = None;
    for pass in materialized.passes {
        let mut args = pass.full_args;
        if requires_loudnorm_measurement(&args) {
            let measurement = loudness_measurement.as_ref().ok_or_else(|| {
                "Loudness render pass is missing analysis measurements.".to_string()
            })?;
            replace_loudnorm_placeholders(&mut args, measurement);
        }
        let is_loudness_analysis = pass.kind.as_deref() == Some("loudness-analysis");
        validate_export_paths(
            app,
            &mut args,
            nested_dir,
            Some(artifact_dir),
            !is_loudness_analysis,
        )?;
        let output = spawn_and_wait_with_progress(
            slot_id,
            args,
            pass.duration,
            log_path,
            Arc::clone(&emit_progress),
            Arc::clone(&emit_started),
            timeout,
        )
        .map_err(|error| format!("FFmpeg pass {} failed: {}", pass.name, error))?;
        if is_loudness_analysis {
            let measurement = parse_loudnorm_measurement(&output.stderr).ok_or_else(|| {
                format!(
                    "Unable to parse FFmpeg loudnorm analysis output for pass {}.",
                    pass.name
                )
            })?;
            report.loudness = Some(LoudnessReport {
                integrated_loudness: measurement.measured_i,
            });
            loudness_measurement = Some(measurement);
        }
    }
    Ok(report)
}

#[derive(Debug, Clone, PartialEq)]
struct FfmpegRunOutput {
    stdout: String,
    stderr: String,
}

#[derive(Debug, Clone, PartialEq)]
struct LoudnormMeasurement {
    measured_i: f64,
    measured_tp: f64,
    measured_lra: f64,
    measured_thresh: f64,
    offset: f64,
}

fn requires_loudnorm_measurement(args: &[String]) -> bool {
    args.iter().any(|arg| {
        arg.contains("__LOUDNORM_MEASURED_I__")
            || arg.contains("__LOUDNORM_MEASURED_TP__")
            || arg.contains("__LOUDNORM_MEASURED_LRA__")
            || arg.contains("__LOUDNORM_MEASURED_THRESH__")
            || arg.contains("__LOUDNORM_OFFSET__")
    })
}

fn replace_loudnorm_placeholders(args: &mut [String], measurement: &LoudnormMeasurement) {
    for arg in args {
        *arg = arg
            .replace(
                "__LOUDNORM_MEASURED_I__",
                &format_loudnorm_number(measurement.measured_i),
            )
            .replace(
                "__LOUDNORM_MEASURED_TP__",
                &format_loudnorm_number(measurement.measured_tp),
            )
            .replace(
                "__LOUDNORM_MEASURED_LRA__",
                &format_loudnorm_number(measurement.measured_lra),
            )
            .replace(
                "__LOUDNORM_MEASURED_THRESH__",
                &format_loudnorm_number(measurement.measured_thresh),
            )
            .replace(
                "__LOUDNORM_OFFSET__",
                &format_loudnorm_number(measurement.offset),
            );
    }
}

fn parse_loudnorm_measurement(stderr: &str) -> Option<LoudnormMeasurement> {
    parse_loudnorm_json_measurement(stderr).or_else(|| parse_loudnorm_key_value_measurement(stderr))
}

fn parse_loudnorm_json_measurement(stderr: &str) -> Option<LoudnormMeasurement> {
    let start = stderr.find('{')?;
    let end = stderr.rfind('}')?;
    if end <= start {
        return None;
    }
    let value: Value = serde_json::from_str(&stderr[start..=end]).ok()?;
    Some(LoudnormMeasurement {
        measured_i: json_number(&value, &["measured_I", "input_i"])?,
        measured_tp: json_number(&value, &["measured_TP", "input_tp"])?,
        measured_lra: json_number(&value, &["measured_LRA", "input_lra"])?,
        measured_thresh: json_number(&value, &["measured_thresh", "input_thresh"])?,
        offset: json_number(&value, &["offset", "target_offset"])?,
    })
}

fn parse_loudnorm_key_value_measurement(stderr: &str) -> Option<LoudnormMeasurement> {
    Some(LoudnormMeasurement {
        measured_i: stderr_number(stderr, &["measured_I", "input_i"])?,
        measured_tp: stderr_number(stderr, &["measured_TP", "input_tp"])?,
        measured_lra: stderr_number(stderr, &["measured_LRA", "input_lra"])?,
        measured_thresh: stderr_number(stderr, &["measured_thresh", "input_thresh"])?,
        offset: stderr_number(stderr, &["offset", "target_offset"])?,
    })
}

fn json_number(value: &Value, keys: &[&str]) -> Option<f64> {
    for key in keys {
        let Some(item) = value.get(*key) else {
            continue;
        };
        if let Some(number) = item.as_f64() {
            return Some(number);
        }
        if let Some(number) = item.as_str().and_then(parse_loudnorm_number) {
            return Some(number);
        }
    }
    None
}

fn stderr_number(stderr: &str, keys: &[&str]) -> Option<f64> {
    for line in stderr.lines() {
        let trimmed = line.trim().trim_matches(',').trim_matches('"');
        for key in keys {
            if let Some(rest) = trimmed.strip_prefix(key) {
                let value = rest
                    .trim_start_matches(|ch: char| ch == ':' || ch == '=' || ch.is_whitespace());
                if let Some(number) = parse_loudnorm_number(value) {
                    return Some(number);
                }
            }
        }
    }
    None
}

fn parse_loudnorm_number(value: &str) -> Option<f64> {
    let token = value
        .trim()
        .trim_matches(',')
        .trim_matches('"')
        .split_whitespace()
        .next()?
        .trim_matches(',')
        .trim_matches('"');
    let number = token.parse::<f64>().ok()?;
    number.is_finite().then_some(number)
}

fn format_loudnorm_number(value: f64) -> String {
    let mut text = format!("{:.3}", value);
    while text.contains('.') && text.ends_with('0') {
        text.pop();
    }
    if text.ends_with('.') {
        text.pop();
    }
    text
}

fn stderr_tail(stderr: &str, count: usize) -> String {
    let lines = stderr.lines().collect::<Vec<_>>();
    let start = lines.len().saturating_sub(count);
    lines[start..].join("\n")
}

fn initialize_export_log(app: &AppHandle, slot_id: &str) -> Result<PathBuf, String> {
    let log_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("export-logs");
    fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;
    let log_path = log_dir.join(format!("{}.log", safe_file_name(slot_id)));
    fs::write(
        &log_path,
        format!(
            "open-factory export log\nstarted_at_ms={}\ntask_id={}\n\n",
            unix_time_millis(),
            slot_id
        ),
    )
    .map_err(|error| {
        format!(
            "Unable to write export log {}: {}",
            normalize_path(&log_path),
            error
        )
    })?;
    Ok(log_path)
}

fn append_export_log(
    log_path: &Path,
    args: &[String],
    stdout: &str,
    stderr: &str,
    status: &str,
) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|error| {
            format!(
                "Unable to append export log {}: {}",
                normalize_path(log_path),
                error
            )
        })?;
    writeln!(file, "ffmpeg {}", args.join(" ")).map_err(|error| error.to_string())?;
    writeln!(file, "status={}", status).map_err(|error| error.to_string())?;
    writeln!(file, "\n[stdout]\n{}", stdout).map_err(|error| error.to_string())?;
    writeln!(file, "\n[stderr]\n{}\n", stderr).map_err(|error| error.to_string())?;
    Ok(())
}

fn append_post_export_script_log(
    log_path: &Path,
    result: &PostExportScriptResult,
) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|error| {
            format!(
                "Unable to append export log {}: {}",
                normalize_path(log_path),
                error
            )
        })?;
    writeln!(file, "\n[post-export-script]").map_err(|error| error.to_string())?;
    writeln!(file, "command={}", result.command).map_err(|error| error.to_string())?;
    writeln!(file, "resolved={}", result.resolved_command)
        .map_err(|error| error.to_string())?;
    writeln!(file, "program={}", result.program).map_err(|error| error.to_string())?;
    writeln!(file, "args={:?}", result.args).map_err(|error| error.to_string())?;
    writeln!(file, "exitCode={:?}", result.exit_code).map_err(|error| error.to_string())?;
    writeln!(file, "success={}", result.success).map_err(|error| error.to_string())?;
    if let Some(error) = result.error.as_deref() {
        writeln!(file, "error={}", error).map_err(|error| error.to_string())?;
    }
    writeln!(file, "\n[post-export-stdout]\n{}", result.stdout)
        .map_err(|error| error.to_string())?;
    writeln!(file, "\n[post-export-stderr]\n{}\n", result.stderr)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[derive(Clone, Copy)]
struct PostExportScriptContext<'a> {
    output_path: &'a str,
    project_name: &'a str,
    duration_seconds: f64,
    now: SystemTime,
}

fn run_post_export_script(
    script: Option<&PostExportScriptDto>,
    context: PostExportScriptContext<'_>,
) -> Option<PostExportScriptResult> {
    let command = script?.command.trim();
    if command.is_empty() {
        return None;
    }
    let resolved_command = expand_post_export_script_command(command, &context);
    let tokens = match split_command_line(&resolved_command) {
        Ok(tokens) if !tokens.is_empty() => tokens,
        Ok(_) => return None,
        Err(error) => {
            return Some(PostExportScriptResult {
                command: command.to_string(),
                resolved_command,
                program: String::new(),
                args: vec![],
                stdout: String::new(),
                stderr: String::new(),
                exit_code: None,
                success: false,
                error: Some(error),
            });
        }
    };
    let program = tokens[0].clone();
    let args = tokens[1..].to_vec();
    match Command::new(&program).args(&args).output() {
        Ok(output) => {
            let success = output.status.success();
            let exit_code = output.status.code();
            Some(PostExportScriptResult {
                command: command.to_string(),
                resolved_command,
                program,
                args,
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                exit_code,
                success,
                error: if success {
                    None
                } else {
                    Some(format!("Post-export script exited with status {}.", output.status))
                },
            })
        }
        Err(error) => Some(PostExportScriptResult {
            command: command.to_string(),
            resolved_command,
            program,
            args,
            stdout: String::new(),
            stderr: String::new(),
            exit_code: None,
            success: false,
            error: Some(format!("Unable to start post-export script: {}", error)),
        }),
    }
}

fn expand_post_export_script_command(
    command: &str,
    context: &PostExportScriptContext<'_>,
) -> String {
    command
        .replace("{output}", context.output_path)
        .replace("{project}", context.project_name)
        .replace(
            "{duration}",
            &format_post_export_duration(context.duration_seconds),
        )
        .replace("{date}", &format_post_export_date(context.now))
}

fn split_command_line(command: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::<String>::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut chars = command.chars().peekable();
    while let Some(ch) = chars.next() {
        if let Some(active_quote) = quote {
            if ch == active_quote {
                quote = None;
            } else if active_quote == '"' && ch == '\\' {
                match chars.peek().copied() {
                    Some('"') | Some('\\') => {
                        if let Some(next) = chars.next() {
                            current.push(next);
                        }
                    }
                    _ => current.push(ch),
                }
            } else {
                current.push(ch);
            }
            continue;
        }
        if ch == '"' || ch == '\'' {
            quote = Some(ch);
        } else if ch.is_whitespace() {
            if !current.is_empty() {
                tokens.push(current);
                current = String::new();
            }
        } else {
            current.push(ch);
        }
    }
    if let Some(active_quote) = quote {
        return Err(format!(
            "Post-export script command has an unclosed {} quote.",
            active_quote
        ));
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    Ok(tokens)
}

fn format_post_export_duration(duration_seconds: f64) -> String {
    if !duration_seconds.is_finite() || duration_seconds <= 0.0 {
        return "0".to_string();
    }
    let rounded = format!("{:.3}", duration_seconds);
    rounded.trim_end_matches('0').trim_end_matches('.').to_string()
}

fn format_post_export_date(now: SystemTime) -> String {
    let seconds = now
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0);
    let days = seconds.div_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    format!("{:04}{:02}{:02}", year, month, day)
}

fn civil_from_days(days_since_unix_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_unix_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 }.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096).div_euclid(365);
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2).div_euclid(153);
    let day = doy - (153 * mp + 2).div_euclid(5) + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    if month <= 2 {
        year += 1;
    }
    (year as i32, month as u32, day as u32)
}

fn maybe_cancel_timed_out_export(
    slot_id: &str,
    started_at: Instant,
    timeout: Option<Duration>,
) -> Result<bool, String> {
    let Some(timeout) = timeout else {
        return Ok(false);
    };
    if started_at.elapsed() < timeout {
        return Ok(false);
    }
    if let Some(mut child) = export_children()
        .lock()
        .map_err(|_| "Unable to lock export process".to_string())?
        .remove(slot_id)
    {
        child.kill().map_err(|error| error.to_string())?;
        let _ = child.wait();
    }
    Ok(true)
}

fn unix_time_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn spawn_and_wait_with_progress(
    slot_id: &str,
    args: Vec<String>,
    duration: f64,
    log_path: Option<&Path>,
    emit_progress: ProgressEmitter,
    emit_started: StartedEmitter,
    timeout: Option<Duration>,
) -> Result<FfmpegRunOutput, String> {
    let mut child = Command::new(ffmpeg_binary())
        .args(&args)
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg: {}", error))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg stderr.".to_string())?;
    {
        let mut children = export_children()
            .lock()
            .map_err(|_| "Unable to lock export process".to_string())?;
        children.insert(slot_id.to_string(), child);
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
    let stdout_bytes = Arc::new(Mutex::new(Vec::<u8>::new()));
    let stdout_for_thread = Arc::clone(&stdout_bytes);
    let stdout_thread = std::thread::spawn(move || {
        let mut reader = stdout;
        let mut bytes = Vec::new();
        let _ = reader.read_to_end(&mut bytes);
        if let Ok(mut output) = stdout_for_thread.lock() {
            *output = bytes;
        }
    });

    let started_at = Instant::now();
    let status_result = loop {
        let maybe_status = {
            let mut children = export_children()
                .lock()
                .map_err(|_| "Unable to lock export process".to_string())?;
            let Some(child) = children.get_mut(slot_id) else {
                break Err("Export canceled.".to_string());
            };
            child.try_wait().map_err(|error| error.to_string())?
        };
        if let Some(status) = maybe_status {
            let _ = export_children()
                .lock()
                .map_err(|_| "Unable to lock export process".to_string())?
                .remove(slot_id);
            break Ok(status);
        }
        if maybe_cancel_timed_out_export(slot_id, started_at, timeout)? {
            break Err("Export preview sample timed out.".to_string());
        }
        std::thread::sleep(Duration::from_millis(100));
    };

    let _ = progress_thread.join();
    let _ = stdout_thread.join();
    let stdout_text = stdout_bytes
        .lock()
        .map(|bytes| String::from_utf8_lossy(&bytes).to_string())
        .unwrap_or_default();
    let stderr_text = stderr_lines
        .lock()
        .map(|lines| lines.join("\n"))
        .unwrap_or_default();
    if let Some(path) = log_path {
        let _ = append_export_log(
            path,
            &args,
            &stdout_text,
            &stderr_text,
            status_result
                .as_ref()
                .map(|status| status.to_string())
                .unwrap_or_else(|error| error.clone())
                .as_str(),
        );
    }
    match status_result {
        Ok(status) if status.success() => {
            emit_progress(ExportProgressPayload::complete(duration));
            Ok(FfmpegRunOutput {
                stdout: stdout_text,
                stderr: stderr_text,
            })
        }
        Ok(status) => Err(format!(
            "FFmpeg exited with status {}.\n{}",
            status,
            stderr_tail(&stderr_text, 20)
        )),
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

fn spawn_and_capture_motion_tracking(
    clip_id: &str,
    args: Vec<String>,
    duration: f64,
    emit_progress: impl Fn(ExportProgressPayload) + Send + Sync + 'static,
) -> Result<String, String> {
    let mut child = Command::new(ffmpeg_binary())
        .args(&args)
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg motion tracking analysis: {}", error))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg motion tracking stderr.".to_string())?;
    {
        let mut children = motion_tracking_children()
            .lock()
            .map_err(|_| "Unable to lock motion tracking process".to_string())?;
        children.insert(clip_id.to_string(), child);
    }
    let stderr_lines = Arc::new(Mutex::new(Vec::<String>::new()));
    let stderr_for_thread = Arc::clone(&stderr_lines);
    let emit_progress = Arc::new(emit_progress);
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
            let mut children = motion_tracking_children()
                .lock()
                .map_err(|_| "Unable to lock motion tracking process".to_string())?;
            let Some(child) = children.get_mut(clip_id) else {
                break Err("Motion tracking canceled.".to_string());
            };
            child.try_wait().map_err(|error| error.to_string())?
        };
        if let Some(status) = maybe_status {
            let _ = motion_tracking_children()
                .lock()
                .map_err(|_| "Unable to lock motion tracking process".to_string())?
                .remove(clip_id);
            break Ok(status);
        }
        std::thread::sleep(Duration::from_millis(100));
    };
    let _ = progress_thread.join();
    let stderr_text = stderr_lines
        .lock()
        .map(|lines| lines.join("\n"))
        .unwrap_or_default();
    match status_result {
        Ok(status) if status.success() => {
            emit_progress(ExportProgressPayload::complete(duration));
            Ok(stderr_text)
        }
        Ok(status) => Err(format!(
            "FFmpeg motion tracking analysis failed with status {}.\n{}",
            status,
            stderr_tail(&stderr_text, 20)
        )),
        Err(error) => Err(error),
    }
}

fn spawn_and_capture_quality_evaluation(
    task_id: &str,
    args: Vec<String>,
    duration: f64,
    emit_progress: impl Fn(ExportProgressPayload) + Send + Sync + 'static,
) -> Result<String, String> {
    let mut child = Command::new(ffmpeg_binary())
        .args(&args)
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg quality evaluation: {}", error))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg quality evaluation stderr.".to_string())?;
    {
        let mut children = quality_evaluation_children()
            .lock()
            .map_err(|_| "Unable to lock quality evaluation process".to_string())?;
        children.insert(task_id.to_string(), child);
    }
    let stderr_lines = Arc::new(Mutex::new(Vec::<String>::new()));
    let stderr_for_thread = Arc::clone(&stderr_lines);
    let emit_progress = Arc::new(emit_progress);
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
    emit_progress(ExportProgressPayload::from_out_time_us(
        0,
        expected_duration_us(duration),
    ));
    let status_result = loop {
        let maybe_status = {
            let mut children = quality_evaluation_children()
                .lock()
                .map_err(|_| "Unable to lock quality evaluation process".to_string())?;
            let Some(child) = children.get_mut(task_id) else {
                break Err("Quality evaluation canceled.".to_string());
            };
            child.try_wait().map_err(|error| error.to_string())?
        };
        if let Some(status) = maybe_status {
            let _ = quality_evaluation_children()
                .lock()
                .map_err(|_| "Unable to lock quality evaluation process".to_string())?
                .remove(task_id);
            break Ok(status);
        }
        std::thread::sleep(Duration::from_millis(100));
    };
    let _ = progress_thread.join();
    let stderr_text = stderr_lines
        .lock()
        .map(|lines| lines.join("\n"))
        .unwrap_or_default();
    match status_result {
        Ok(status) if status.success() => {
            emit_progress(ExportProgressPayload::complete(duration));
            Ok(stderr_text)
        }
        Ok(status) => Err(format!(
            "FFmpeg quality evaluation failed with status {}.\n{}",
            status,
            stderr_tail(&stderr_text, 20)
        )),
        Err(error) => Err(error),
    }
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

fn build_motion_track_args(input_path: &Path) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:2".to_string(),
        "-nostats".to_string(),
        "-i".to_string(),
        normalize_path(input_path),
        "-vf".to_string(),
        "cropdetect=round=2,mestimate=method=esa".to_string(),
        "-an".to_string(),
        "-f".to_string(),
        "null".to_string(),
        "-".to_string(),
    ]
}

fn build_quality_evaluation_args(
    source_path: &Path,
    output_path: &Path,
    include_vmaf: bool,
) -> Vec<String> {
    let filter_complex = build_quality_filter_complex(include_vmaf);
    vec![
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:2".to_string(),
        "-nostats".to_string(),
        "-i".to_string(),
        normalize_path(source_path),
        "-i".to_string(),
        normalize_path(output_path),
        "-filter_complex".to_string(),
        filter_complex,
        "-an".to_string(),
        "-f".to_string(),
        "null".to_string(),
        "-".to_string(),
    ]
}

fn build_quality_filter_complex(include_vmaf: bool) -> String {
    let split_count = if include_vmaf { 3 } else { 2 };
    let mut filter = format!(
        "[0:v]setpts=PTS-STARTPTS,split={split_count}[ref_ssim][ref_psnr]{};[1:v]setpts=PTS-STARTPTS,split={split_count}[dist_ssim][dist_psnr]{};[ref_ssim][dist_ssim]ssim[ssim_out];[ref_psnr][dist_psnr]psnr[psnr_out];[ssim_out]nullsink;[psnr_out]nullsink",
        if include_vmaf { "[ref_vmaf]" } else { "" },
        if include_vmaf { "[dist_vmaf]" } else { "" }
    );
    if include_vmaf {
        filter.push_str(";[ref_vmaf][dist_vmaf]libvmaf[vmaf_out];[vmaf_out]nullsink");
    }
    filter
}

pub fn parse_motion_vectors_from_mestimate_output(text: &str) -> Vec<MotionTrackPointDto> {
    text.lines()
        .filter_map(|line| {
            let dx = extract_named_number(line, &["dx", "motion_x", "mv_x", "x"])?;
            let dy = extract_named_number(line, &["dy", "motion_y", "mv_y", "y"])?;
            let time = extract_named_number(line, &["pts_time"])
                .or_else(|| extract_timecode_seconds(line, "time"))
                .or_else(|| extract_named_number(line, &["time"]))
                .or_else(|| extract_named_number(line, &["frame"]).map(|frame| frame / 30.0))
                .unwrap_or(0.0);
            Some(MotionTrackPointDto { time, dx, dy })
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq)]
struct QualityMetrics {
    ssim: Option<f64>,
    psnr: Option<f64>,
    vmaf: Option<f64>,
}

fn parse_quality_metrics(text: &str) -> QualityMetrics {
    let mut metrics = QualityMetrics {
        ssim: None,
        psnr: None,
        vmaf: None,
    };
    for line in text.lines() {
        if line.contains("All:") {
            metrics.ssim = parse_metric_after(line, "All:").or(metrics.ssim);
        }
        if line.contains("average:") {
            metrics.psnr = parse_metric_after(line, "average:").or(metrics.psnr);
        }
        if line.contains("VMAF score:") {
            metrics.vmaf = parse_metric_after(line, "VMAF score:").or(metrics.vmaf);
        }
    }
    metrics
}

fn parse_metric_after(line: &str, marker: &str) -> Option<f64> {
    let (_, rest) = line.split_once(marker)?;
    let value = rest
        .trim_start()
        .split(|ch: char| ch.is_whitespace() || ch == ')' || ch == ',')
        .next()?;
    if value.eq_ignore_ascii_case("inf") || value.eq_ignore_ascii_case("infinity") {
        return Some(100.0);
    }
    let parsed = value.parse::<f64>().ok()?;
    parsed.is_finite().then_some(parsed)
}

fn ffmpeg_supports_libvmaf(filters: &str) -> bool {
    filter_list_contains(filters, "libvmaf")
}

fn extract_named_number(line: &str, keys: &[&str]) -> Option<f64> {
    keys.iter().find_map(|key| {
        let equals = format!("{}=", key);
        let colon = format!("{}:", key);
        line.find(&equals)
            .map(|index| index + equals.len())
            .or_else(|| line.find(&colon).map(|index| index + colon.len()))
            .and_then(|start| parse_number_prefix(&line[start..]))
    })
}

fn extract_timecode_seconds(line: &str, key: &str) -> Option<f64> {
    let marker = format!("{}=", key);
    let start = line.find(&marker)? + marker.len();
    let value = line[start..].split_whitespace().next()?;
    parse_timecode(value)
}

fn parse_number_prefix(value: &str) -> Option<f64> {
    let token: String = value
        .trim_start()
        .chars()
        .take_while(|ch| ch.is_ascii_digit() || matches!(ch, '-' | '+' | '.'))
        .collect();
    if token.is_empty() || token == "-" || token == "+" || token == "." {
        return None;
    }
    token
        .parse::<f64>()
        .ok()
        .filter(|number| number.is_finite())
}

fn parse_timecode(value: &str) -> Option<f64> {
    let mut parts = value.split(':');
    let hours = parts.next()?.parse::<f64>().ok()?;
    let minutes = parts.next()?.parse::<f64>().ok()?;
    let seconds = parts.next()?.parse::<f64>().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

fn format_seconds_arg(value: f64) -> String {
    let clamped = if value.is_finite() {
        value.max(0.0)
    } else {
        0.0
    };
    let formatted = format!("{:.6}", clamped);
    formatted
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_string()
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
                    kind: pass.kind.clone(),
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
        if artifact.path_mode.as_deref() == Some("shader-sequence") {
            let sequence_path = materialize_custom_shader_sequence(temp_dir, artifact, &safe_name)?;
            result.push((artifact.placeholder.clone(), sequence_path));
            continue;
        }
        if artifact.path_mode.as_deref() == Some("path-text-sequence") {
            let sequence_path = materialize_path_text_sequence(temp_dir, artifact, &safe_name)?;
            result.push((artifact.placeholder.clone(), sequence_path));
            continue;
        }
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

fn materialize_custom_shader_sequence(
    temp_dir: &Path,
    artifact: &TextArtifactDto,
    safe_name: &str,
) -> Result<String, String> {
    let manifest: CustomShaderSequenceManifest =
        serde_json::from_str(&artifact.text).map_err(|error| {
            format!(
                "Unable to parse custom shader artifact {}: {}",
                artifact.clip_id, error
            )
        })?;
    if manifest.kind != "custom-shader-sequence" {
        return Err(format!(
            "Unsupported custom shader artifact kind for {}.",
            artifact.clip_id
        ));
    }
    let stem = safe_name.trim_end_matches(".json");
    let sequence_dir = temp_dir.join(stem);
    fs::create_dir_all(&sequence_dir).map_err(|error| {
        format!(
            "Unable to create custom shader sequence directory {}: {}",
            normalize_path(&sequence_dir),
            error
        )
    })?;
    let frame_pattern = sequence_dir.join("frame%04d.png");
    bake_custom_shader_sequence(&manifest, &frame_pattern)?;
    Ok(normalize_path(&frame_pattern))
}

fn materialize_path_text_sequence(
    temp_dir: &Path,
    artifact: &TextArtifactDto,
    safe_name: &str,
) -> Result<String, String> {
    let manifest: PathTextSequenceManifest =
        serde_json::from_str(&artifact.text).map_err(|error| {
            format!(
                "Unable to parse path text artifact {}: {}",
                artifact.clip_id, error
            )
        })?;
    if manifest.kind != "path-text-sequence" {
        return Err(format!(
            "Unsupported path text artifact kind for {}.",
            artifact.clip_id
        ));
    }
    let stem = safe_name.trim_end_matches(".json");
    let sequence_dir = temp_dir.join(stem);
    fs::create_dir_all(&sequence_dir).map_err(|error| {
        format!(
            "Unable to create path text sequence directory {}: {}",
            normalize_path(&sequence_dir),
            error
        )
    })?;
    let frame_pattern = sequence_dir.join("frame%04d.png");
    bake_path_text_sequence(&manifest, &sequence_dir)?;
    Ok(normalize_path(&frame_pattern))
}

fn bake_custom_shader_sequence(
    manifest: &CustomShaderSequenceManifest,
    frame_pattern: &Path,
) -> Result<(), String> {
    let mut args = vec!["-hide_banner".to_string(), "-y".to_string()];
    if manifest.clip_type == "image" {
        args.extend([
            "-loop".to_string(),
            "1".to_string(),
            "-t".to_string(),
            format_seconds_arg(manifest.duration),
        ]);
    } else {
        args.extend([
            "-ss".to_string(),
            format_seconds_arg(manifest.trim_start),
            "-t".to_string(),
            format_seconds_arg(manifest.source_duration),
        ]);
    }
    args.extend([
        "-i".to_string(),
        manifest.media_path.clone(),
        "-vf".to_string(),
        build_custom_shader_bake_filter(manifest),
        "-frames:v".to_string(),
        manifest.frame_count.max(1).to_string(),
        "-start_number".to_string(),
        "1".to_string(),
        "-f".to_string(),
        "image2".to_string(),
        normalize_path(frame_pattern),
    ]);
    let output = Command::new(ffmpeg_binary())
        .args(&args)
        .output()
        .map_err(|error| {
            format!(
                "Unable to render custom shader sequence for {}: {}",
                manifest.clip_id, error
            )
        })?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "Custom shader sequence render failed for {}: {}",
        manifest.clip_id, stderr
    ))
}

fn bake_path_text_sequence(
    manifest: &PathTextSequenceManifest,
    sequence_dir: &Path,
) -> Result<(), String> {
    let frame_count = manifest.frame_count.max(1) as usize;
    for index in 0..frame_count {
        let empty = PathTextFrameManifest { chars: Vec::new() };
        let frame = manifest.frames.get(index).unwrap_or(&empty);
        let frame_path = sequence_dir.join(format!("frame{:04}.png", index + 1));
        let frame_duration = 1.0 / manifest.fps.max(1.0);
        let args = vec![
            "-hide_banner".to_string(),
            "-y".to_string(),
            "-f".to_string(),
            "lavfi".to_string(),
            "-i".to_string(),
            format!(
                "color=c=black@0:s={}x{}:d={}",
                manifest.width.max(1),
                manifest.height.max(1),
                format_seconds_arg(frame_duration)
            ),
            "-vf".to_string(),
            build_path_text_frame_filter(manifest, frame),
            "-frames:v".to_string(),
            "1".to_string(),
            "-f".to_string(),
            "image2".to_string(),
            normalize_path(&frame_path),
        ];
        let output = Command::new(ffmpeg_binary())
            .args(&args)
            .output()
            .map_err(|error| {
                format!(
                    "Unable to render path text sequence for {}: {}",
                    manifest.clip_id, error
                )
            })?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "Path text sequence render failed for {}: {}",
                manifest.clip_id, stderr
            ));
        }
    }
    Ok(())
}

fn build_custom_shader_bake_filter(manifest: &CustomShaderSequenceManifest) -> String {
    let width = manifest.width.max(1);
    let height = manifest.height.max(1);
    let fps = manifest.fps.max(1.0);
    let mut filters = vec![
        format!(
            "scale={}:{}:force_original_aspect_ratio=decrease",
            width, height
        ),
        format!("pad={}:{}:(ow-iw)/2:(oh-ih)/2:color=black", width, height),
        "setsar=1".to_string(),
    ];
    if (manifest.speed - 1.0).abs() > 0.001 && manifest.clip_type != "image" {
        filters.push(format!(
            "setpts=(PTS-STARTPTS)/{}",
            format_seconds_arg(manifest.speed)
        ));
    }
    filters.push(custom_shader_equivalent_filter(manifest));
    filters.push(format!("fps={}", format_seconds_arg(fps)));
    filters.push("format=rgba".to_string());
    filters.join(",")
}

fn custom_shader_equivalent_filter(manifest: &CustomShaderSequenceManifest) -> String {
    match manifest.preset.as_deref() {
        Some("pixelate") => {
            let width = manifest.width.max(1);
            let height = manifest.height.max(1);
            let low_width = (width / 18).max(1);
            let low_height = (height / 18).max(1);
            format!(
                "scale={}:{}:flags=neighbor,scale={}:{}:flags=neighbor",
                low_width, low_height, width, height
            )
        }
        Some("posterize") => {
            "lutrgb=r='floor(val/52)*52':g='floor(val/52)*52':b='floor(val/52)*52'".to_string()
        }
        Some("old-film") => {
            "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,noise=alls=8:allf=t"
                .to_string()
        }
        _ => "null".to_string(),
    }
}

fn build_path_text_frame_filter(
    manifest: &PathTextSequenceManifest,
    frame: &PathTextFrameManifest,
) -> String {
    let font_size = manifest.font_size.max(1.0);
    let font_color = css_color_to_ffmpeg(&manifest.font_color);
    let font_file = manifest
        .font_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .map(|path| format!(":fontfile={}", escape_drawtext_path(path)))
        .unwrap_or_default();
    let mut filters = vec!["format=rgba".to_string()];
    for item in &frame.chars {
        if item.char.is_empty() {
            continue;
        }
        filters.push(format!(
            "drawtext=text='{}'{}:fontsize={}:fontcolor={}:x='{}-text_w/2':y='{}-{}'",
            escape_drawtext_text(&item.char),
            font_file,
            format_seconds_arg(font_size),
            font_color,
            format_seconds_arg(item.x),
            format_seconds_arg(item.y),
            format_seconds_arg(font_size / 2.0)
        ));
    }
    filters.join(",")
}

fn css_color_to_ffmpeg(value: &str) -> String {
    let trimmed = value.trim();
    if let Some(hex) = trimmed.strip_prefix('#') {
        if hex.len() == 6 && hex.chars().all(|char| char.is_ascii_hexdigit()) {
            return format!("0x{}", hex.to_ascii_lowercase());
        }
        if hex.len() == 3 && hex.chars().all(|char| char.is_ascii_hexdigit()) {
            let mut expanded = String::from("0x");
            for char in hex.chars() {
                expanded.push(char.to_ascii_lowercase());
                expanded.push(char.to_ascii_lowercase());
            }
            return expanded;
        }
    }
    "white".to_string()
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
    path.len() >= parent.len()
        && path
            .iter()
            .zip(parent.iter())
            .all(|(left, right)| left == right)
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

fn export_slot_id(task_id: Option<&str>) -> String {
    task_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(DEFAULT_EXPORT_TASK_ID)
        .to_string()
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
            task_id: None,
            progress: progress_pct / 100.0,
            progress_pct,
            out_time_us: Some(out_time_us),
            expected_duration_us,
        }
    }

    fn complete(total_duration: f64) -> Self {
        let duration_us = expected_duration_us(total_duration);
        Self {
            task_id: None,
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

fn escape_drawtext_text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace('%', "\\%")
        .replace(',', "\\,")
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
    fn parses_loudnorm_measurement_from_ffmpeg_stderr_json() {
        let stderr = r#"
[Parsed_loudnorm_0 @ 000001]
{
  "input_i" : "-18.45",
  "input_tp" : "-1.20",
  "input_lra" : "7.10",
  "input_thresh" : "-29.30",
  "target_offset" : "0.15"
}
"#;

        assert_eq!(
            parse_loudnorm_measurement(stderr),
            Some(LoudnormMeasurement {
                measured_i: -18.45,
                measured_tp: -1.2,
                measured_lra: 7.1,
                measured_thresh: -29.3,
                offset: 0.15,
            })
        );
    }

    #[test]
    fn parses_measured_i_key_values_and_injects_loudnorm_placeholders() {
        let stderr = r#"
measured_I=-20.75
measured_TP=-2.10
measured_LRA=5.25
measured_thresh=-31.60
offset=1.35
"#;
        let measurement = parse_loudnorm_measurement(stderr).expect("measurement");
        let mut args = vec![
            "-filter_complex".to_string(),
            "loudnorm=I=-14:measured_I=__LOUDNORM_MEASURED_I__:measured_TP=__LOUDNORM_MEASURED_TP__:measured_LRA=__LOUDNORM_MEASURED_LRA__:measured_thresh=__LOUDNORM_MEASURED_THRESH__:offset=__LOUDNORM_OFFSET__".to_string(),
        ];

        assert!(requires_loudnorm_measurement(&args));
        replace_loudnorm_placeholders(&mut args, &measurement);

        assert!(!requires_loudnorm_measurement(&args));
        assert!(args[1].contains("measured_I=-20.75"));
        assert!(args[1].contains("measured_TP=-2.1"));
        assert!(args[1].contains("measured_LRA=5.25"));
        assert!(args[1].contains("measured_thresh=-31.6"));
        assert!(args[1].contains("offset=1.35"));
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
    fn filter_parser_matches_exact_filter_tokens() {
        let filters = r#"
 TSC arnndn            A->A       Reduce noise from speech using Recurrent Neural Networks.
 ... minterpolate      V->V       Frame rate conversion using Motion Interpolation.
 ... libvmaf           VV->V      Calculate the VMAF between two video streams.
 ... drawtext_extra    V->V       Not the exact drawtext filter.
"#;

        assert!(filter_list_contains(filters, "arnndn"));
        assert!(filter_list_contains(filters, "minterpolate"));
        assert!(ffmpeg_supports_libvmaf(filters));
        assert!(!filter_list_contains(filters, "drawtext"));
    }

    #[test]
    fn builds_quality_evaluation_argument_array_with_ssim_psnr_and_vmaf() {
        let args = build_quality_evaluation_args(
            Path::new(r"C:\Media\original.mp4"),
            Path::new(r"C:\Exports\render.mp4"),
            true,
        );

        assert_eq!(args[0], "-y");
        assert_eq!(args.iter().filter(|arg| arg.as_str() == "-i").count(), 2);
        assert!(args.windows(2).any(|pair| pair == ["-progress", "pipe:2"]));
        let filter = args
            .windows(2)
            .find_map(|pair| (pair[0] == "-filter_complex").then_some(pair[1].as_str()))
            .expect("filter complex");
        assert!(filter.contains("ssim"));
        assert!(filter.contains("psnr"));
        assert!(filter.contains("libvmaf"));
        assert!(!args
            .iter()
            .any(|arg| arg.contains("cmd /C") || arg.contains("&&")));
    }

    #[test]
    fn parses_quality_metrics_from_ffmpeg_stderr() {
        let stderr = r#"
[Parsed_ssim_2 @ 000001] SSIM Y:0.991 U:0.992 V:0.993 All:0.99123 (20.36)
[Parsed_psnr_3 @ 000001] PSNR y:39.2 u:40.1 v:41.0 average:40.25 min:35.0 max:45.0
[Parsed_libvmaf_4 @ 000001] VMAF score: 93.456789
"#;

        assert_eq!(
            parse_quality_metrics(stderr),
            QualityMetrics {
                ssim: Some(0.99123),
                psnr: Some(40.25),
                vmaf: Some(93.456789),
            }
        );
    }

    #[test]
    fn parses_mestimate_motion_vectors_from_ffmpeg_output() {
        let output = r#"
[Parsed_mestimate_1 @ 000001] pts_time:0.033 dx=-0.125 dy=0.25
[Parsed_mestimate_1 @ 000001] time=00:00:00.50 motion_x=0.1 motion_y=-0.2
[Parsed_mestimate_1 @ 000001] frame=45 mv_x=0.3 mv_y=0.4
unrelated line
"#;

        assert_eq!(
            parse_motion_vectors_from_mestimate_output(output),
            vec![
                MotionTrackPointDto {
                    time: 0.033,
                    dx: -0.125,
                    dy: 0.25,
                },
                MotionTrackPointDto {
                    time: 0.5,
                    dx: 0.1,
                    dy: -0.2,
                },
                MotionTrackPointDto {
                    time: 1.5,
                    dx: 0.3,
                    dy: 0.4,
                },
            ]
        );
    }

    #[test]
    fn builds_motion_tracking_argument_array_without_shell_strings() {
        let args = build_motion_track_args(Path::new(r"C:\Media\clip.mp4"));

        assert_eq!(args[0], "-y");
        assert_eq!(args.iter().filter(|arg| arg.as_str() == "-i").count(), 1);
        assert!(args.windows(2).any(|pair| pair == ["-progress", "pipe:2"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-vf", "cropdetect=round=2,mestimate=method=esa"]));
        assert!(!args
            .iter()
            .any(|arg| arg.contains("cmd /C") || arg.contains("&&")));
    }

    #[test]
    fn builds_vidstabdetect_argument_array_without_shell_strings() {
        let args = build_vidstabdetect_args(
            Path::new(r"C:\Media\clip.mp4"),
            Path::new(r"C:\Temp\open factory\clip.trf"),
        );

        assert_eq!(args[0], "-y");
        assert_eq!(args.iter().filter(|arg| arg.as_str() == "-i").count(), 1);
        assert_eq!(
            args,
            vec![
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
            ]
        );
        assert!(!args
            .iter()
            .any(|arg| arg.contains("cmd /C") || arg.contains("&&")));
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
                task_id: None,
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
    fn expands_post_export_script_variables() {
        let context = PostExportScriptContext {
            output_path: "C:/Exports/final.mp4",
            project_name: "Launch Cut",
            duration_seconds: 12.5,
            now: UNIX_EPOCH + Duration::from_secs(1_781_395_200),
        };

        assert_eq!(
            expand_post_export_script_command(
                "tool --file \"{output}\" --project \"{project}\" --duration {duration} --date {date}",
                &context
            ),
            "tool --file \"C:/Exports/final.mp4\" --project \"Launch Cut\" --duration 12.5 --date 20260614"
        );
    }

    #[test]
    fn skips_empty_post_export_script_command() {
        let context = PostExportScriptContext {
            output_path: "C:/Exports/final.mp4",
            project_name: "Launch Cut",
            duration_seconds: 12.5,
            now: UNIX_EPOCH,
        };

        assert!(run_post_export_script(None, context).is_none());
        assert!(run_post_export_script(
            Some(&PostExportScriptDto {
                command: "   ".to_string()
            }),
            context
        )
        .is_none());
    }

    #[test]
    fn post_export_script_failure_is_returned_as_report_data() {
        let context = PostExportScriptContext {
            output_path: "C:/Exports/final.mp4",
            project_name: "Launch Cut",
            duration_seconds: 12.5,
            now: UNIX_EPOCH,
        };

        let result = run_post_export_script(
            Some(&PostExportScriptDto {
                command: "__open_factory_missing_post_export_command__ {output}".to_string(),
            }),
            context,
        )
        .expect("failed script should still produce a result");

        assert!(!result.success);
        assert!(result.error.unwrap_or_default().contains("Unable to start post-export script"));
        assert_eq!(result.exit_code, None);
    }

    #[test]
    fn command_line_split_preserves_quoted_paths_without_shell_operators() {
        assert_eq!(
            split_command_line("tool \"C:/Exports/final cut.mp4\" --flag 'two words'").unwrap(),
            vec!["tool", "C:/Exports/final cut.mp4", "--flag", "two words"]
        );
        assert!(split_command_line("tool \"unterminated").is_err());
    }

    #[test]
    fn cancel_export_is_ok_when_idle() {
        export_children().lock().expect("export child lock").clear();
        cancel_export(None).expect("idle cancellation should not fail");
    }

    #[test]
    fn export_memory_threshold_pauses_below_two_gb() {
        assert!(should_pause_export_for_memory(
            EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES - 1
        ));
        assert!(!should_pause_export_for_memory(
            EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES
        ));
        assert!(!should_pause_export_for_memory(
            EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES + 1
        ));
    }

    #[test]
    fn cancel_export_clears_running_child_slot() {
        let child = spawn_long_running_child();
        export_children()
            .lock()
            .expect("export child lock")
            .insert(DEFAULT_EXPORT_TASK_ID.to_string(), child);

        cancel_export(None).expect("running cancellation should not fail");

        assert!(export_children()
            .lock()
            .expect("export child lock")
            .is_empty());
    }

    #[test]
    fn cancel_export_clears_only_requested_child_slot() {
        export_children().lock().expect("export child lock").clear();
        let child_a = spawn_long_running_child();
        let child_b = spawn_long_running_child();
        {
            let mut children = export_children().lock().expect("export child lock");
            children.insert("task-a".to_string(), child_a);
            children.insert("task-b".to_string(), child_b);
        }

        cancel_export(Some("task-a".to_string())).expect("task-a cancellation should not fail");

        {
            let children = export_children().lock().expect("export child lock");
            assert!(!children.contains_key("task-a"));
            assert!(children.contains_key("task-b"));
        }
        cancel_export(Some("task-b".to_string())).expect("task-b cleanup should not fail");
    }

    #[test]
    fn export_preview_samples_run_three_frame_args_in_parallel() {
        let samples = vec![
            preview_sample("start", "C:/Previews/start.png", "0"),
            preview_sample("middle", "C:/Previews/middle.png", "3"),
            preview_sample("end", "C:/Previews/end.png", "6"),
        ];
        let active = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let max_active = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let barrier = Arc::new(std::sync::Barrier::new(4));
        let seen_args = Arc::new(Mutex::new(Vec::<Vec<String>>::new()));
        let runner: PreviewSampleRunner = {
            let active = Arc::clone(&active);
            let max_active = Arc::clone(&max_active);
            let barrier = Arc::clone(&barrier);
            let seen_args = Arc::clone(&seen_args);
            Arc::new(move |sample| {
                let current = active.fetch_add(1, Ordering::SeqCst) + 1;
                let mut observed = max_active.load(Ordering::SeqCst);
                while current > observed
                    && max_active
                        .compare_exchange(observed, current, Ordering::SeqCst, Ordering::SeqCst)
                        .is_err()
                {
                    observed = max_active.load(Ordering::SeqCst);
                }
                seen_args
                    .lock()
                    .expect("seen args lock")
                    .push(sample.plan.full_args.clone());
                barrier.wait();
                active.fetch_sub(1, Ordering::SeqCst);
                Ok(ExportPreviewSampleResult {
                    id: sample.id,
                    kind: sample.kind,
                    label: sample.label,
                    time: sample.time,
                    path: sample.output_path,
                    duration_ms: 1,
                })
            })
        };

        let handle =
            std::thread::spawn(move || run_export_preview_samples_parallel(samples, runner));
        barrier.wait();
        let result = handle
            .join()
            .expect("preview worker should not panic")
            .expect("preview samples should complete");

        assert_eq!(result.len(), 3);
        assert_eq!(max_active.load(Ordering::SeqCst), 3);
        let seen = seen_args.lock().expect("seen args lock");
        assert_eq!(seen.len(), 3);
        for args in seen.iter() {
            assert!(args
                .windows(2)
                .any(|pair| pair[0] == "-frames:v" && pair[1] == "1"));
            assert!(args.iter().any(|arg| arg.ends_with(".png")));
            assert!(!args.iter().any(|arg| arg.contains("cmd /C")));
        }
    }

    #[test]
    fn timed_out_export_preview_sample_cancels_child_slot() {
        export_children().lock().expect("export child lock").clear();
        let slot_id = "preview-timeout";
        export_children()
            .lock()
            .expect("export child lock")
            .insert(slot_id.to_string(), spawn_long_running_child());

        let canceled = maybe_cancel_timed_out_export(
            slot_id,
            Instant::now() - Duration::from_secs(11),
            Some(Duration::from_secs(10)),
        )
        .expect("timeout cancel should not fail");

        assert!(canceled);
        assert!(!export_children()
            .lock()
            .expect("export child lock")
            .contains_key(slot_id));
    }

    #[test]
    fn export_preview_requires_exactly_three_samples() {
        let one_sample = vec![preview_sample("start", "C:/Previews/start.png", "0")];
        let three_samples = vec![
            preview_sample("start", "C:/Previews/start.png", "0"),
            preview_sample("middle", "C:/Previews/middle.png", "3"),
            preview_sample("end", "C:/Previews/end.png", "6"),
        ];

        assert!(validate_export_preview_sample_count(&one_sample).is_err());
        assert!(validate_export_preview_sample_count(&three_samples).is_ok());
    }

    #[test]
    fn export_preview_timeout_defaults_to_ten_seconds_and_clamps_bounds() {
        assert_eq!(export_preview_timeout(None), Duration::from_millis(10_000));
        assert_eq!(export_preview_timeout(Some(0)), Duration::from_millis(1));
        assert_eq!(
            export_preview_timeout(Some(120_000)),
            Duration::from_millis(60_000)
        );
    }

    #[test]
    fn export_preview_sample_rejects_output_path_mismatch() {
        let mut sample = preview_sample("start", "C:/Previews/start.png", "0");
        sample.output_path = "C:/Previews/other.png".to_string();

        let error = export_preview_sample_output_path(&sample)
            .expect_err("mismatched output paths should fail");

        assert!(error.contains("does not match its plan"));
    }

    #[test]
    fn temp_text_artifacts_are_removed_on_failure() {
        let plan = FfmpegExportPlanDto {
            project_name: None,
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
            post_export_script: None,
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
            project_name: None,
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
                    kind: None,
                },
                FfmpegExportPassDto {
                    name: "gif-paletteuse".to_string(),
                    full_args: vec![
                        "-i".to_string(),
                        "__GIF_PALETTE_open_factory__".to_string(),
                        "D:/Exports/out.gif".to_string(),
                    ],
                    duration: 1.0,
                    kind: None,
                },
            ],
            nested_plans: vec![],
            duration: 1.0,
            post_export_script: None,
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
            assert_eq!(
                materialized.passes[0].full_args[2],
                materialized.passes[1].full_args[1]
            );
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
    fn custom_shader_bake_filter_uses_pixelate_neighbor_scaling() {
        let manifest = CustomShaderSequenceManifest {
            kind: "custom-shader-sequence".to_string(),
            clip_id: "clip-shader".to_string(),
            preset: Some("pixelate".to_string()),
            media_path: "source.mp4".to_string(),
            clip_type: "video".to_string(),
            trim_start: 0.25,
            source_duration: 1.0,
            duration: 1.0,
            speed: 0.5,
            width: 180,
            height: 90,
            fps: 30.0,
            frame_count: 30,
        };

        let filter = build_custom_shader_bake_filter(&manifest);

        assert!(filter.contains("scale=180:90:force_original_aspect_ratio=decrease"));
        assert!(filter.contains("setpts=(PTS-STARTPTS)/0.5"));
        assert!(filter.contains("scale=10:5:flags=neighbor,scale=180:90:flags=neighbor"));
        assert!(filter.ends_with("fps=30,format=rgba"));
    }

    #[test]
    fn path_text_frame_filter_builds_escaped_drawtext_layers() {
        let manifest = PathTextSequenceManifest {
            kind: "path-text-sequence".to_string(),
            clip_id: "clip-path-text".to_string(),
            width: 320,
            height: 180,
            fps: 30.0,
            frame_count: 1,
            font_size: 42.0,
            font_color: "#ff4fd8".to_string(),
            font_path: Some(r"C:\Fonts\A:rial.ttf".to_string()),
            frames: vec![PathTextFrameManifest {
                chars: vec![PathTextCharManifest {
                    char: "A:".to_string(),
                    x: 120.0,
                    y: 80.0,
                    angle: -12.0,
                }],
            }],
        };

        let filter = build_path_text_frame_filter(&manifest, &manifest.frames[0]);

        assert!(filter.starts_with("format=rgba,drawtext="));
        assert!(filter.contains("text='A\\:'"));
        assert!(filter.contains(r"fontfile=C\\:/Fonts/A\\:rial.ttf"));
        assert!(filter.contains("fontcolor=0xff4fd8"));
        assert!(filter.contains("x='120-text_w/2':y='80-21'"));
    }

    #[test]
    fn custom_shader_sequence_artifact_materializes_frames_and_replaces_placeholder() {
        if !detect_ffmpeg() {
            return;
        }
        let source_dir = create_export_temp_dir().expect("source temp dir should be created");
        let source_path = source_dir.join("shader-source.ppm");
        fs::write(
            &source_path,
            [
                b"P6\n2 2\n255\n".as_slice(),
                &[255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0],
            ]
            .concat(),
        )
        .expect("source image should be written");
        let artifact_text = serde_json::json!({
            "kind": "custom-shader-sequence",
            "clipId": "clip-shader",
            "preset": "pixelate",
            "mediaPath": normalize_path(&source_path),
            "clipType": "image",
            "trimStart": 0,
            "sourceDuration": 0.1,
            "duration": 0.1,
            "speed": 1,
            "width": 32,
            "height": 32,
            "fps": 10,
            "frameCount": 1
        })
        .to_string();
        let plan = FfmpegExportPlanDto {
            project_name: None,
            full_args: vec![
                "-i".to_string(),
                "__CUSTOM_SHADER_SEQUENCE_clip_shader__".to_string(),
                "D:/Exports/out.mp4".to_string(),
            ],
            warnings: vec![],
            text_artifacts: vec![TextArtifactDto {
                clip_id: "clip-shader:custom-shader".to_string(),
                text: artifact_text,
                file_name: "custom-shader-clip-shader.json".to_string(),
                placeholder: "__CUSTOM_SHADER_SEQUENCE_clip_shader__".to_string(),
                path_mode: Some("shader-sequence".to_string()),
            }],
            passes: vec![],
            nested_plans: vec![],
            duration: 1.0,
            post_export_script: None,
        };

        with_temp_export_artifacts(&plan, |materialized, _temp_dir| {
            let pattern = &materialized.full_args[1];
            assert!(!pattern.contains("__CUSTOM_SHADER_SEQUENCE_clip_shader__"));
            assert!(pattern.ends_with("frame%04d.png"));
            assert!(Path::new(&pattern.replace("%04d", "0001")).exists());
            Ok(())
        })
        .expect("custom shader artifact should materialize");

        fs::remove_dir_all(source_dir).expect("source temp dir should be removed");
    }

    #[test]
    fn path_text_sequence_artifact_materializes_frames_and_replaces_placeholder() {
        if !detect_ffmpeg()
            || !command_text(&["-hide_banner", "-filters"])
                .map(|filters| filter_list_contains(&filters, "drawtext"))
                .unwrap_or(false)
        {
            return;
        }
        let font_path = if cfg!(windows) {
            "C:/Windows/Fonts/arial.ttf"
        } else {
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        };
        if !Path::new(font_path).exists() {
            return;
        }
        let artifact_text = serde_json::json!({
            "kind": "path-text-sequence",
            "clipId": "clip-path-text",
            "width": 160,
            "height": 90,
            "fps": 10,
            "frameCount": 1,
            "fontSize": 24,
            "fontColor": "#ff4fd8",
            "fontPath": font_path,
            "frames": [
                { "time": 0, "chars": [{ "char": "A", "x": 80, "y": 45, "angle": 0 }] }
            ]
        })
        .to_string();
        let plan = FfmpegExportPlanDto {
            project_name: None,
            full_args: vec![
                "-i".to_string(),
                "__PATH_TEXT_SEQUENCE_clip_path_text__".to_string(),
                "D:/Exports/out.mp4".to_string(),
            ],
            warnings: vec![],
            text_artifacts: vec![TextArtifactDto {
                clip_id: "clip-path-text:path-text".to_string(),
                text: artifact_text,
                file_name: "path-text-clip-path-text.json".to_string(),
                placeholder: "__PATH_TEXT_SEQUENCE_clip_path_text__".to_string(),
                path_mode: Some("path-text-sequence".to_string()),
            }],
            passes: vec![],
            nested_plans: vec![],
            duration: 1.0,
            post_export_script: None,
        };

        with_temp_export_artifacts(&plan, |materialized, _temp_dir| {
            let pattern = &materialized.full_args[1];
            assert!(!pattern.contains("__PATH_TEXT_SEQUENCE_clip_path_text__"));
            assert!(pattern.ends_with("frame%04d.png"));
            assert!(Path::new(&pattern.replace("%04d", "0001")).exists());
            Ok(())
        })
        .expect("path text artifact should materialize");
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
            DEFAULT_EXPORT_TASK_ID,
            vec!["-this-option-does-not-exist".to_string()],
            1.0,
            None,
            Arc::new(move |progress| {
                progress_values_for_emit
                    .lock()
                    .expect("progress lock")
                    .push(progress);
            }),
            Arc::new(|| {}),
            None,
        );

        let error = result.expect_err("invalid ffmpeg args should fail");
        assert!(error.contains("FFmpeg exited with status"), "{error}");
        assert!(export_children()
            .lock()
            .expect("export child lock")
            .is_empty());
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

    fn preview_sample(id: &str, output_path: &str, seek: &str) -> ExportPreviewSampleDto {
        ExportPreviewSampleDto {
            id: id.to_string(),
            kind: id.to_string(),
            label: id.to_string(),
            time: seek.parse().unwrap_or(0.0),
            output_path: output_path.to_string(),
            plan: FfmpegExportPlanDto {
                project_name: None,
                full_args: vec![
                    "-y".to_string(),
                    "-i".to_string(),
                    "C:/Media/source.mp4".to_string(),
                    "-ss".to_string(),
                    seek.to_string(),
                    "-frames:v".to_string(),
                    "1".to_string(),
                    "-f".to_string(),
                    "image2".to_string(),
                    output_path.to_string(),
                ],
                warnings: vec![],
                text_artifacts: vec![],
                passes: vec![],
                nested_plans: vec![],
                duration: 1.0 / 30.0,
                post_export_script: None,
            },
        }
    }
}
