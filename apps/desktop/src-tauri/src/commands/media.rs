use super::binaries::{ffmpeg_binary, ffprobe_binary};
use crate::path_validator::{validate_path, validate_path_for_write};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

const WAVEFORM_SAMPLE_RATE: u32 = 48_000;
const BEAT_RMS_SAMPLE_RATE: u32 = 48_000;
const BEAT_RMS_SAMPLES_PER_SEC: u32 = 40;

#[derive(Debug, Clone, Copy)]
pub(crate) struct RmsSample {
    time: f64,
    rms: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbe {
    has_audio: bool,
    audio_channels: Option<u32>,
    audio_sample_rate: Option<u32>,
    audio_codec: Option<String>,
    video_codec: Option<String>,
    frame_rate: Option<f64>,
    avg_frame_rate: Option<String>,
    real_frame_rate: Option<String>,
    variable_frame_rate: bool,
    field_order: Option<String>,
    color_space: Option<String>,
    color_transfer: Option<String>,
    color_primaries: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAnalysis {
    path: String,
    file_size: Option<u64>,
    created_time_ms: Option<u64>,
    format: MediaFormatInfo,
    video_streams: Vec<VideoStreamInfo>,
    audio_streams: Vec<AudioStreamInfo>,
    bitrate_points: Vec<BitratePoint>,
    loudness_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioSpectrumStats {
    integrated_lufs: Option<f64>,
    dynamic_range_lu: Option<f64>,
    true_peak_dbfs: Option<f64>,
    peak_db: Option<f64>,
    rms_db: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSpectrumAnalysis {
    path: String,
    spectrogram_path: Option<String>,
    spectrogram_error: Option<String>,
    stats: AudioSpectrumStats,
    stats_error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind")]
pub enum GapFillMediaRequest {
    #[serde(rename = "freeze-frame")]
    FreezeFrame {
        #[serde(rename = "sourcePath")]
        source_path: String,
        #[serde(rename = "sourceTime")]
        source_time: f64,
        width: u32,
        height: u32,
    },
    #[serde(rename = "solid-color")]
    SolidColor {
        color: String,
        width: u32,
        height: u32,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GapFillMediaResult {
    path: String,
    name: String,
    width: u32,
    height: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CoverFrameExtractionMode {
    IFrame,
    Interval,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverFrameExtractionRequest {
    clip_id: String,
    source_path: String,
    output_dir: String,
    output_stem: String,
    mode: CoverFrameExtractionMode,
    count: Option<u32>,
    timestamps: Option<Vec<f64>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverFrameBatchTaskRequest {
    asset_id: String,
    source_path: String,
    output_file_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverFrameBatchRequest {
    output_dir: String,
    tasks: Vec<CoverFrameBatchTaskRequest>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoverFrameResult {
    index: u32,
    path: String,
    timestamp: Option<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoverFrameExtractionResult {
    clip_id: String,
    frames: Vec<CoverFrameResult>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoverFrameBatchTaskResult {
    asset_id: String,
    source_path: String,
    output_path: Option<String>,
    status: String,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoverFrameBatchResult {
    results: Vec<CoverFrameBatchTaskResult>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoverFrameProgressPayload {
    task_id: String,
    status: String,
    current: u32,
    total: u32,
    progress: f32,
    progress_pct: u32,
    output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MediaFormatInfo {
    format_name: Option<String>,
    format_long_name: Option<String>,
    duration: Option<f64>,
    bit_rate: Option<u64>,
    size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoStreamInfo {
    index: u32,
    codec_name: Option<String>,
    codec_long_name: Option<String>,
    duration: Option<f64>,
    width: Option<u32>,
    height: Option<u32>,
    frame_rate: Option<f64>,
    bit_rate: Option<u64>,
    color_space: Option<String>,
    color_transfer: Option<String>,
    color_primaries: Option<String>,
    pixel_format: Option<String>,
    field_order: Option<String>,
    hdr_metadata: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStreamInfo {
    index: u32,
    codec_name: Option<String>,
    codec_long_name: Option<String>,
    duration: Option<f64>,
    sample_rate: Option<u32>,
    channels: Option<u32>,
    channel_layout: Option<String>,
    bit_rate: Option<u64>,
    integrated_lufs: Option<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BitratePoint {
    time: f64,
    bit_rate: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaIntegrityScanResult {
    path: String,
    ok: bool,
    error_output: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeRoot {
    streams: Option<Vec<FfprobeStream>>,
    format: Option<FfprobeFormat>,
    packets: Option<Vec<FfprobePacket>>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    format_name: Option<String>,
    format_long_name: Option<String>,
    duration: Option<String>,
    bit_rate: Option<String>,
    size: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    index: Option<u32>,
    codec_name: Option<String>,
    codec_long_name: Option<String>,
    codec_type: Option<String>,
    duration: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    avg_frame_rate: Option<String>,
    r_frame_rate: Option<String>,
    bit_rate: Option<String>,
    color_space: Option<String>,
    color_transfer: Option<String>,
    color_primaries: Option<String>,
    pix_fmt: Option<String>,
    field_order: Option<String>,
    sample_rate: Option<String>,
    channels: Option<u32>,
    channel_layout: Option<String>,
    side_data_list: Option<Vec<FfprobeSideData>>,
}

#[derive(Debug, Deserialize)]
struct FfprobeSideData {
    side_data_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobePacket {
    pts_time: Option<String>,
    dts_time: Option<String>,
    duration_time: Option<String>,
    size: Option<String>,
}

#[tauri::command]
pub fn probe_media(app: AppHandle, path: String) -> Result<MediaProbe, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    let input_path = normalize_path(&safe_path);
    let output = Command::new(ffprobe_binary())
        .args(["-v", "error", "-show_streams", "-of", "json", &input_path])
        .output()
        .map_err(|error| format!("Unable to run ffprobe: {}", error))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let json: Value = serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
    let audio = json
        .get("streams")
        .and_then(Value::as_array)
        .and_then(|streams| {
            streams.iter().find(|stream| {
                stream
                    .get("codec_type")
                    .and_then(Value::as_str)
                    .is_some_and(|kind| kind == "audio")
            })
        });
    let video = json
        .get("streams")
        .and_then(Value::as_array)
        .and_then(|streams| {
            streams.iter().find(|stream| {
                stream
                    .get("codec_type")
                    .and_then(Value::as_str)
                    .is_some_and(|kind| kind == "video")
            })
        });
    let avg_frame_rate = video
        .and_then(|stream| stream.get("avg_frame_rate"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let real_frame_rate = video
        .and_then(|stream| stream.get("r_frame_rate"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);

    Ok(MediaProbe {
        has_audio: audio.is_some(),
        audio_channels: audio
            .and_then(|stream| stream.get("channels"))
            .and_then(Value::as_u64)
            .map(|value| value as u32),
        audio_sample_rate: audio
            .and_then(|stream| stream.get("sample_rate"))
            .and_then(Value::as_str)
            .and_then(|value| value.parse::<u32>().ok()),
        audio_codec: audio
            .and_then(|stream| stream.get("codec_name"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        video_codec: video
            .and_then(|stream| stream.get("codec_name"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        frame_rate: parse_frame_rate(avg_frame_rate.as_deref())
            .or_else(|| parse_frame_rate(real_frame_rate.as_deref())),
        variable_frame_rate: is_variable_frame_rate(
            avg_frame_rate.as_deref(),
            real_frame_rate.as_deref(),
        ),
        avg_frame_rate,
        real_frame_rate,
        field_order: video
            .and_then(|stream| stream.get("field_order"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        color_space: video
            .and_then(|stream| stream.get("color_space"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        color_transfer: video
            .and_then(|stream| stream.get("color_transfer"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        color_primaries: video
            .and_then(|stream| stream.get("color_primaries"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
    })
}

#[tauri::command]
pub fn analyze_media(app: AppHandle, path: String) -> Result<MediaAnalysis, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    analyze_media_path(&safe_path)
}

#[tauri::command]
pub fn scan_media_integrity(
    app: AppHandle,
    path: String,
) -> Result<MediaIntegrityScanResult, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    scan_media_integrity_path(&safe_path)
}

#[tauri::command]
pub fn analyze_audio_spectrum(
    app: AppHandle,
    path: String,
) -> Result<AudioSpectrumAnalysis, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    Ok(analyze_audio_spectrum_path(&safe_path))
}

pub(crate) fn analyze_media_path(path: &Path) -> Result<MediaAnalysis, String> {
    let input_path = normalize_path(path);
    let metadata = fs::metadata(path).ok();
    let output = Command::new(ffprobe_binary())
        .args(build_ffprobe_media_analysis_args(&input_path))
        .output()
        .map_err(|error| format!("Unable to run ffprobe: {}", error))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let mut analysis = parse_ffprobe_media_analysis(&input_path, &output.stdout)?;
    analysis.file_size = metadata.as_ref().map(|value| value.len());
    analysis.created_time_ms = metadata
        .as_ref()
        .and_then(|value| value.created().ok())
        .and_then(system_time_ms);
    if !analysis.audio_streams.is_empty() {
        match analyze_loudness_path(path) {
            Ok(lufs) => {
                if let Some(stream) = analysis.audio_streams.first_mut() {
                    stream.integrated_lufs = Some(lufs);
                }
            }
            Err(error) => {
                analysis.loudness_error = Some(error);
            }
        }
    }
    Ok(analysis)
}

pub(crate) fn scan_media_integrity_path(path: &Path) -> Result<MediaIntegrityScanResult, String> {
    let input_path = normalize_path(path);
    let output = Command::new(ffmpeg_binary())
        .args(build_media_integrity_scan_args(&input_path))
        .output()
        .map_err(|error| format!("Unable to run FFmpeg media scan: {}", error))?;
    let error_output = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let ok = output.status.success() && error_output.is_empty();
    Ok(MediaIntegrityScanResult {
        path: input_path,
        ok,
        error_output: if error_output.is_empty() {
            None
        } else {
            Some(error_output)
        },
    })
}

pub(crate) fn analyze_audio_spectrum_path(path: &Path) -> AudioSpectrumAnalysis {
    let input_path = normalize_path(path);
    let output_path = spectrogram_output_path(path);
    let output_path_text = normalize_path(&output_path);
    let spectrogram_result = generate_spectrogram_png(&input_path, &output_path_text);
    let stats_result = analyze_ebur128_stats(&input_path);
    AudioSpectrumAnalysis {
        path: input_path,
        spectrogram_path: spectrogram_result.as_ref().ok().map(|_| output_path_text),
        spectrogram_error: spectrogram_result.err(),
        stats: stats_result.clone().unwrap_or_default(),
        stats_error: stats_result.err(),
    }
}

pub(crate) fn build_ffprobe_media_analysis_args(input_path: &str) -> [&str; 8] {
    [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        "-show_packets",
        input_path,
    ]
}

pub(crate) fn build_media_integrity_scan_args(input_path: &str) -> [&str; 7] {
    ["-v", "error", "-i", input_path, "-f", "null", "-"]
}

pub(crate) fn build_loudnorm_analysis_args(input_path: &str) -> [&str; 9] {
    [
        "-hide_banner",
        "-nostats",
        "-i",
        input_path,
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f",
        "null",
        "-",
    ]
}

pub(crate) fn build_spectrogram_png_args(input_path: &str, output_path: &str) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-nostats".to_string(),
        "-i".to_string(),
        input_path.to_string(),
        "-lavfi".to_string(),
        "showspectrumpic=s=1280x512:mode=combined".to_string(),
        "-frames:v".to_string(),
        "1".to_string(),
        output_path.to_string(),
    ]
}

pub(crate) fn build_ebur128_stats_args(input_path: &str) -> Vec<String> {
    vec![
        "-hide_banner".to_string(),
        "-nostats".to_string(),
        "-i".to_string(),
        input_path.to_string(),
        "-af".to_string(),
        "ebur128=peak=true,astats=metadata=1:reset=0".to_string(),
        "-f".to_string(),
        "null".to_string(),
        "-".to_string(),
    ]
}

pub(crate) fn parse_ffprobe_media_analysis(
    path: &str,
    bytes: &[u8],
) -> Result<MediaAnalysis, String> {
    let root: FfprobeRoot = serde_json::from_slice(bytes).map_err(|error| error.to_string())?;
    let format = root.format.map(parse_format).unwrap_or_default();
    let mut video_streams = Vec::new();
    let mut audio_streams = Vec::new();
    for stream in root.streams.unwrap_or_default() {
        let index = stream.index.unwrap_or(0);
        match stream.codec_type.as_deref() {
            Some("video") => video_streams.push(parse_video_stream(index, &stream)),
            Some("audio") => audio_streams.push(parse_audio_stream(index, &stream)),
            _ => {}
        }
    }
    Ok(MediaAnalysis {
        path: path.to_string(),
        file_size: None,
        created_time_ms: None,
        format,
        video_streams,
        audio_streams,
        bitrate_points: build_bitrate_points(&root.packets.unwrap_or_default()),
        loudness_error: None,
    })
}

fn parse_format(format: FfprobeFormat) -> MediaFormatInfo {
    MediaFormatInfo {
        format_name: format.format_name,
        format_long_name: format.format_long_name,
        duration: parse_f64(format.duration.as_deref()),
        bit_rate: parse_u64(format.bit_rate.as_deref()),
        size: parse_u64(format.size.as_deref()),
    }
}

fn parse_video_stream(index: u32, stream: &FfprobeStream) -> VideoStreamInfo {
    VideoStreamInfo {
        index,
        codec_name: stream.codec_name.clone(),
        codec_long_name: stream.codec_long_name.clone(),
        duration: parse_f64(stream.duration.as_deref()),
        width: stream.width,
        height: stream.height,
        frame_rate: parse_frame_rate(stream.avg_frame_rate.as_deref())
            .or_else(|| parse_frame_rate(stream.r_frame_rate.as_deref())),
        bit_rate: parse_u64(stream.bit_rate.as_deref()),
        color_space: stream.color_space.clone(),
        color_transfer: stream.color_transfer.clone(),
        color_primaries: stream.color_primaries.clone(),
        pixel_format: stream.pix_fmt.clone(),
        field_order: stream.field_order.clone(),
        hdr_metadata: stream
            .side_data_list
            .as_deref()
            .unwrap_or_default()
            .iter()
            .flat_map(|side_data| side_data.side_data_type.clone())
            .filter(|value| {
                value.contains("Mastering display")
                    || value.contains("Content light")
                    || value.to_lowercase().contains("hdr")
            })
            .collect(),
    }
}

fn parse_audio_stream(index: u32, stream: &FfprobeStream) -> AudioStreamInfo {
    AudioStreamInfo {
        index,
        codec_name: stream.codec_name.clone(),
        codec_long_name: stream.codec_long_name.clone(),
        duration: parse_f64(stream.duration.as_deref()),
        sample_rate: parse_u64(stream.sample_rate.as_deref()).map(|value| value as u32),
        channels: stream.channels,
        channel_layout: stream.channel_layout.clone(),
        bit_rate: parse_u64(stream.bit_rate.as_deref()),
        integrated_lufs: None,
    }
}

fn build_bitrate_points(packets: &[FfprobePacket]) -> Vec<BitratePoint> {
    let mut buckets = std::collections::BTreeMap::<u64, u64>::new();
    for packet in packets {
        let time = parse_f64(packet.pts_time.as_deref())
            .or_else(|| parse_f64(packet.dts_time.as_deref()))
            .unwrap_or(0.0);
        if !time.is_finite() || time < 0.0 {
            continue;
        }
        let bucket = time.floor() as u64;
        let size = parse_u64(packet.size.as_deref()).unwrap_or(0);
        let duration = parse_f64(packet.duration_time.as_deref()).unwrap_or(0.0);
        let duration_scale = if duration.is_finite() && duration > 1.0 {
            duration
        } else {
            1.0
        };
        let bits = ((size as f64 * 8.0) / duration_scale).round() as u64;
        *buckets.entry(bucket).or_default() += bits;
    }
    buckets
        .into_iter()
        .map(|(time, bit_rate)| BitratePoint {
            time: time as f64,
            bit_rate,
        })
        .collect()
}

fn analyze_loudness_path(path: &Path) -> Result<f64, String> {
    let input_path = normalize_path(path);
    let output = Command::new(ffmpeg_binary())
        .args(build_loudnorm_analysis_args(&input_path))
        .output()
        .map_err(|error| format!("Unable to run FFmpeg loudness analysis: {}", error))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    parse_loudnorm_integrated_lufs(&output.stderr)
        .or_else(|| parse_loudnorm_integrated_lufs(&output.stdout))
        .ok_or_else(|| "Unable to parse loudnorm integrated LUFS.".to_string())
}

fn generate_spectrogram_png(input_path: &str, output_path: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(output_path).parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let args = build_spectrogram_png_args(input_path, output_path);
    let output = Command::new(ffmpeg_binary())
        .args(&args)
        .output()
        .map_err(|error| format!("Unable to run FFmpeg spectrum analysis: {}", error))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn analyze_ebur128_stats(input_path: &str) -> Result<AudioSpectrumStats, String> {
    let args = build_ebur128_stats_args(input_path);
    let output = Command::new(ffmpeg_binary())
        .args(&args)
        .output()
        .map_err(|error| format!("Unable to run FFmpeg ebur128 analysis: {}", error))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(parse_ebur128_stats(&output.stderr)
        .or_else(|| parse_ebur128_stats(&output.stdout))
        .unwrap_or_default())
}

pub(crate) fn parse_ebur128_stats(bytes: &[u8]) -> Option<AudioSpectrumStats> {
    let text = String::from_utf8_lossy(bytes);
    let mut stats = AudioSpectrumStats::default();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("I:") && trimmed.contains("LUFS") {
            stats.integrated_lufs = parse_first_number(trimmed);
        } else if trimmed.starts_with("LRA:") && trimmed.contains("LU") {
            stats.dynamic_range_lu = parse_first_number(trimmed);
        } else if trimmed.starts_with("Peak:") && trimmed.contains("dBFS") {
            stats.true_peak_dbfs = parse_first_number(trimmed);
        } else if let Some(value) = parse_number_after(trimmed, "Peak level dB:") {
            stats.peak_db = Some(value);
        } else if let Some(value) = parse_number_after(trimmed, "RMS level dB:") {
            stats.rms_db = Some(value);
        }
    }
    if stats.integrated_lufs.is_some()
        || stats.dynamic_range_lu.is_some()
        || stats.true_peak_dbfs.is_some()
        || stats.peak_db.is_some()
        || stats.rms_db.is_some()
    {
        Some(stats)
    } else {
        None
    }
}

fn parse_loudnorm_integrated_lufs(bytes: &[u8]) -> Option<f64> {
    let text = String::from_utf8_lossy(bytes);
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    let json: Value = serde_json::from_str(&text[start..=end]).ok()?;
    json.get("input_i")
        .and_then(Value::as_str)
        .and_then(|value| value.parse::<f64>().ok())
}

fn parse_number_after(line: &str, key: &str) -> Option<f64> {
    let (_, value) = line.split_once(key)?;
    parse_first_number(value)
}

fn parse_first_number(value: &str) -> Option<f64> {
    value
        .split_whitespace()
        .find_map(|token| {
            token
                .trim_matches(|c: char| c == ':' || c == ',')
                .parse::<f64>()
                .ok()
        })
        .filter(|number| number.is_finite())
        .map(round_seconds)
}

fn spectrogram_output_path(path: &Path) -> PathBuf {
    let mut hasher = Sha256::new();
    hasher.update(normalize_path(path).as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    std::env::temp_dir()
        .join("open-factory-spectrum")
        .join(format!("{}.png", &hash[..16]))
}

fn parse_u64(value: Option<&str>) -> Option<u64> {
    value?.trim().parse::<u64>().ok()
}

fn parse_f64(value: Option<&str>) -> Option<f64> {
    value?
        .trim()
        .parse::<f64>()
        .ok()
        .filter(|number| number.is_finite())
}

fn parse_frame_rate(value: Option<&str>) -> Option<f64> {
    let raw = value?.trim();
    if raw.is_empty() || raw == "0/0" {
        return None;
    }
    if let Some((numerator, denominator)) = raw.split_once('/') {
        let numerator = numerator.parse::<f64>().ok()?;
        let denominator = denominator.parse::<f64>().ok()?;
        if denominator <= 0.0 {
            return None;
        }
        return Some(round_seconds(numerator / denominator));
    }
    parse_f64(Some(raw)).map(round_seconds)
}

fn is_variable_frame_rate(avg_frame_rate: Option<&str>, real_frame_rate: Option<&str>) -> bool {
    let avg = parse_frame_rate(avg_frame_rate);
    let real = parse_frame_rate(real_frame_rate);
    match (avg, real) {
        (Some(avg), Some(real)) => (avg - real).abs() > 0.001,
        _ => false,
    }
}

fn system_time_ms(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

#[tauri::command]
pub fn analyze_waveform(
    app: AppHandle,
    path: String,
    samples_per_sec: u32,
) -> Result<Vec<f32>, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    analyze_waveform_path(&safe_path, samples_per_sec)
}

#[tauri::command]
pub fn detect_silence(
    app: AppHandle,
    path: String,
    threshold_db: f64,
    min_gap_ms: f64,
) -> Result<Vec<[f64; 2]>, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    detect_silence_path(&safe_path, threshold_db, min_gap_ms)
}

#[tauri::command]
pub fn detect_beats(app: AppHandle, path: String, sensitivity: String) -> Result<Vec<f64>, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    detect_beats_path(&safe_path, &sensitivity)
}

#[tauri::command]
pub fn generate_gap_fill_media(
    app: AppHandle,
    request: GapFillMediaRequest,
) -> Result<GapFillMediaResult, String> {
    let output_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("media-cache")
        .join("gap-fill");
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Unable to create gap fill cache: {}", error))?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);

    match request {
        GapFillMediaRequest::FreezeFrame {
            source_path,
            source_time,
            width,
            height,
        } => {
            let safe_source = validate_path(&app, Path::new(&source_path))?;
            let name = format!("gap-freeze-{}.png", stamp);
            let output = output_dir.join(&name);
            let args = build_freeze_frame_args(
                &normalize_path(&safe_source),
                &normalize_path(&output),
                source_time,
            );
            run_gap_fill_ffmpeg(&args, "freeze frame")?;
            Ok(GapFillMediaResult {
                path: normalize_path(&output),
                name,
                width: width.max(16),
                height: height.max(16),
            })
        }
        GapFillMediaRequest::SolidColor {
            color,
            width,
            height,
        } => {
            let safe_width = width.max(16);
            let safe_height = height.max(16);
            let name = format!("gap-solid-{}.png", stamp);
            let output = output_dir.join(&name);
            let args = build_solid_color_frame_args(
                &normalize_path(&output),
                &color,
                safe_width,
                safe_height,
            );
            run_gap_fill_ffmpeg(&args, "solid color frame")?;
            Ok(GapFillMediaResult {
                path: normalize_path(&output),
                name,
                width: safe_width,
                height: safe_height,
            })
        }
    }
}

#[tauri::command]
pub async fn extract_cover_frames(
    app: AppHandle,
    request: CoverFrameExtractionRequest,
) -> Result<CoverFrameExtractionResult, String> {
    tauri::async_runtime::spawn_blocking(move || extract_cover_frames_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn batch_extract_cover_frames(
    app: AppHandle,
    request: CoverFrameBatchRequest,
) -> Result<CoverFrameBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || batch_extract_cover_frames_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

fn extract_cover_frames_blocking(
    app: AppHandle,
    request: CoverFrameExtractionRequest,
) -> Result<CoverFrameExtractionResult, String> {
    let safe_source = validate_path(&app, Path::new(&request.source_path))?;
    let safe_output_dir = validate_path_for_write(&app, Path::new(&request.output_dir))?;
    fs::create_dir_all(&safe_output_dir)
        .map_err(|error| format!("Unable to create cover frame directory: {}", error))?;
    emit_cover_frame_progress(&app, &request.clip_id, "running", 0, 1, None);
    let source_path = normalize_path(&safe_source);
    let stem = normalize_cover_file_stem(&request.output_stem);
    let frames = match request.mode {
        CoverFrameExtractionMode::IFrame => {
            let count = request.count.unwrap_or(6).clamp(1, 24);
            let output_pattern = safe_output_dir.join(format!("{}-i-%03d.png", stem));
            let args = build_i_frame_cover_args(
                &source_path,
                &normalize_path(&output_pattern),
                Some(count),
            );
            run_cover_ffmpeg(&args, "I-frame cover extraction")?;
            collect_generated_cover_frames(&safe_output_dir, &format!("{}-i-", stem), None)?
        }
        CoverFrameExtractionMode::Interval => {
            let timestamps =
                normalize_cover_timestamps(request.timestamps, request.count.unwrap_or(6));
            let mut frames = Vec::new();
            for (index, timestamp) in timestamps.iter().enumerate() {
                let output =
                    safe_output_dir.join(format!("{}-interval-{:03}.png", stem, index + 1));
                let args =
                    build_interval_cover_args(&source_path, &normalize_path(&output), *timestamp);
                run_cover_ffmpeg(&args, "interval cover extraction")?;
                frames.push(CoverFrameResult {
                    index: index as u32,
                    path: normalize_path(&output),
                    timestamp: Some(round_seconds(*timestamp)),
                });
                emit_cover_frame_progress(
                    &app,
                    &request.clip_id,
                    "running",
                    (index + 1) as u32,
                    timestamps.len() as u32,
                    Some(normalize_path(&output)),
                );
            }
            frames
        }
    };
    emit_cover_frame_progress(
        &app,
        &request.clip_id,
        "completed",
        1,
        1,
        frames.first().map(|frame| frame.path.clone()),
    );
    Ok(CoverFrameExtractionResult {
        clip_id: request.clip_id,
        frames,
    })
}

fn batch_extract_cover_frames_blocking(
    app: AppHandle,
    request: CoverFrameBatchRequest,
) -> Result<CoverFrameBatchResult, String> {
    let safe_output_dir = validate_path_for_write(&app, Path::new(&request.output_dir))?;
    fs::create_dir_all(&safe_output_dir)
        .map_err(|error| format!("Unable to create cover frame directory: {}", error))?;
    let total = build_cover_frame_batch_task_count(&request.tasks) as u32;
    let mut current = 0_u32;
    let mut results = Vec::new();
    for task in request.tasks {
        if task.source_path.trim().is_empty() {
            continue;
        }
        current += 1;
        emit_cover_frame_progress(
            &app,
            &task.asset_id,
            "running",
            current.saturating_sub(1),
            total,
            None,
        );
        let output = safe_output_dir.join(normalize_cover_file_name(&task.output_file_name));
        let result = match validate_path(&app, Path::new(&task.source_path)) {
            Ok(source) => {
                let args = build_first_i_frame_cover_args(
                    &normalize_path(&source),
                    &normalize_path(&output),
                );
                match run_cover_ffmpeg(&args, "batch cover extraction") {
                    Ok(()) => CoverFrameBatchTaskResult {
                        asset_id: task.asset_id.clone(),
                        source_path: normalize_path(&source),
                        output_path: Some(normalize_path(&output)),
                        status: "completed".to_string(),
                        error: None,
                    },
                    Err(error) => CoverFrameBatchTaskResult {
                        asset_id: task.asset_id.clone(),
                        source_path: task.source_path.clone(),
                        output_path: None,
                        status: "failed".to_string(),
                        error: Some(error),
                    },
                }
            }
            Err(error) => CoverFrameBatchTaskResult {
                asset_id: task.asset_id.clone(),
                source_path: task.source_path.clone(),
                output_path: None,
                status: "failed".to_string(),
                error: Some(error),
            },
        };
        emit_cover_frame_progress(
            &app,
            &task.asset_id,
            &result.status,
            current,
            total,
            result.output_path.clone(),
        );
        results.push(result);
    }
    Ok(CoverFrameBatchResult { results })
}

pub(crate) fn analyze_waveform_path(path: &Path, samples_per_sec: u32) -> Result<Vec<f32>, String> {
    let samples_per_sec = samples_per_sec.clamp(1, 1_000);
    let samples_per_bucket =
        ((WAVEFORM_SAMPLE_RATE as f64) / (samples_per_sec as f64)).ceil() as usize;
    let input_path = normalize_path(path);
    let sample_rate_arg = WAVEFORM_SAMPLE_RATE.to_string();
    let mut child = Command::new(ffmpeg_binary())
        .args([
            "-v",
            "error",
            "-i",
            &input_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            &sample_rate_arg,
            "-f",
            "f32le",
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg waveform analysis: {}", error))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg waveform output.".to_string())?;
    let mut peaks = Vec::<f32>::new();
    let mut bytes = [0_u8; 16 * 1024];
    let mut partial = Vec::<u8>::new();
    let mut bucket_peak = 0_f32;
    let mut bucket_samples = 0_usize;

    loop {
        let read = stdout.read(&mut bytes).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        let mut offset = 0_usize;
        if !partial.is_empty() {
            while partial.len() < 4 && offset < read {
                partial.push(bytes[offset]);
                offset += 1;
            }
            if partial.len() == 4 {
                process_waveform_sample(
                    f32::from_le_bytes([partial[0], partial[1], partial[2], partial[3]]),
                    samples_per_bucket,
                    &mut bucket_peak,
                    &mut bucket_samples,
                    &mut peaks,
                );
                partial.clear();
            }
        }
        while offset + 4 <= read {
            process_waveform_sample(
                f32::from_le_bytes([
                    bytes[offset],
                    bytes[offset + 1],
                    bytes[offset + 2],
                    bytes[offset + 3],
                ]),
                samples_per_bucket,
                &mut bucket_peak,
                &mut bucket_samples,
                &mut peaks,
            );
            offset += 4;
        }
        if offset < read {
            partial.extend_from_slice(&bytes[offset..read]);
        }
    }
    drop(stdout);

    if bucket_samples > 0 {
        peaks.push(round_peak(bucket_peak));
    }

    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        let mut stderr = String::new();
        if let Some(mut stream) = child.stderr.take() {
            let _ = stream.read_to_string(&mut stderr);
        }
        return Err(format!(
            "FFmpeg waveform analysis failed: {}",
            stderr.trim()
        ));
    }
    Ok(peaks)
}

pub(crate) fn detect_beats_path(path: &Path, sensitivity: &str) -> Result<Vec<f64>, String> {
    let samples = analyze_rms_path(path, BEAT_RMS_SAMPLES_PER_SEC)?;
    Ok(detect_beat_peaks_from_rms(&samples, sensitivity))
}

pub(crate) fn detect_silence_path(
    path: &Path,
    threshold_db: f64,
    min_gap_ms: f64,
) -> Result<Vec<[f64; 2]>, String> {
    let input_path = normalize_path(path);
    let threshold_db = threshold_db.clamp(-120.0, 0.0);
    let min_duration = (min_gap_ms.max(1.0) / 1_000.0).max(0.001);
    let filter = format!(
        "silencedetect=noise={}dB:d={:.3}",
        threshold_db, min_duration
    );
    let mut child = Command::new(ffmpeg_binary())
        .args([
            "-hide_banner",
            "-nostats",
            "-i",
            &input_path,
            "-af",
            &filter,
            "-f",
            "null",
            "-",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg silence detection: {}", error))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg silence output.".to_string())?;
    let reader = BufReader::new(stderr);
    let mut ranges = Vec::<[f64; 2]>::new();
    let mut current_start: Option<f64> = None;
    let mut stderr_tail = Vec::<String>::new();

    for line in reader.lines().map_while(Result::ok) {
        if stderr_tail.len() >= 20 {
            stderr_tail.remove(0);
        }
        stderr_tail.push(line.clone());
        if let Some(start) = parse_silence_number(&line, "silence_start:") {
            current_start = Some(start);
        }
        if let Some(end) = parse_silence_number(&line, "silence_end:") {
            if let Some(start) = current_start.take() {
                if end > start {
                    ranges.push([round_seconds(start), round_seconds(end)]);
                }
            }
        }
    }

    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        return Err(format!(
            "FFmpeg silence detection failed with status {}.\n{}",
            status,
            stderr_tail.join("\n")
        ));
    }
    Ok(ranges)
}

pub(crate) fn analyze_rms_path(
    path: &Path,
    samples_per_sec: u32,
) -> Result<Vec<RmsSample>, String> {
    let samples_per_sec = samples_per_sec.clamp(1, 200);
    let samples_per_bucket =
        ((BEAT_RMS_SAMPLE_RATE as f64) / (samples_per_sec as f64)).ceil() as usize;
    let input_path = normalize_path(path);
    let sample_rate_arg = BEAT_RMS_SAMPLE_RATE.to_string();
    let mut child = Command::new(ffmpeg_binary())
        .args([
            "-v",
            "error",
            "-i",
            &input_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            &sample_rate_arg,
            "-f",
            "f32le",
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg beat detection: {}", error))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to capture FFmpeg beat detection output.".to_string())?;
    let mut samples = Vec::<RmsSample>::new();
    let mut bytes = [0_u8; 16 * 1024];
    let mut partial = Vec::<u8>::new();
    let mut bucket_sum_squares = 0_f64;
    let mut bucket_samples = 0_usize;
    let mut bucket_index = 0_usize;

    loop {
        let read = stdout.read(&mut bytes).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        let mut offset = 0_usize;
        if !partial.is_empty() {
            while partial.len() < 4 && offset < read {
                partial.push(bytes[offset]);
                offset += 1;
            }
            if partial.len() == 4 {
                process_rms_sample(
                    f32::from_le_bytes([partial[0], partial[1], partial[2], partial[3]]),
                    samples_per_sec,
                    samples_per_bucket,
                    &mut bucket_sum_squares,
                    &mut bucket_samples,
                    &mut bucket_index,
                    &mut samples,
                );
                partial.clear();
            }
        }
        while offset + 4 <= read {
            process_rms_sample(
                f32::from_le_bytes([
                    bytes[offset],
                    bytes[offset + 1],
                    bytes[offset + 2],
                    bytes[offset + 3],
                ]),
                samples_per_sec,
                samples_per_bucket,
                &mut bucket_sum_squares,
                &mut bucket_samples,
                &mut bucket_index,
                &mut samples,
            );
            offset += 4;
        }
        if offset < read {
            partial.extend_from_slice(&bytes[offset..read]);
        }
    }
    drop(stdout);
    if bucket_samples > 0 {
        push_rms_bucket(
            samples_per_sec,
            &mut bucket_sum_squares,
            &mut bucket_samples,
            &mut bucket_index,
            &mut samples,
        );
    }

    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        let mut stderr = String::new();
        if let Some(mut stream) = child.stderr.take() {
            let _ = stream.read_to_string(&mut stderr);
        }
        return Err(format!("FFmpeg beat detection failed: {}", stderr.trim()));
    }
    Ok(samples)
}

pub(crate) fn detect_beat_peaks_from_rms(samples: &[RmsSample], sensitivity: &str) -> Vec<f64> {
    let mut ordered = samples
        .iter()
        .copied()
        .filter(|sample| sample.time.is_finite() && sample.rms.is_finite())
        .map(|sample| RmsSample {
            time: sample.time.max(0.0),
            rms: sample.rms.max(0.0),
        })
        .collect::<Vec<_>>();
    ordered.sort_by(|left, right| left.time.total_cmp(&right.time));
    if ordered.len() < 3 {
        return Vec::new();
    }
    let max_rms = ordered
        .iter()
        .map(|sample| sample.rms)
        .fold(0.0_f64, f64::max);
    if max_rms <= 0.0 {
        return Vec::new();
    }
    let (threshold_ratio, min_gap) = beat_sensitivity_params(sensitivity);
    let threshold = max_rms * threshold_ratio;
    let mut beats = Vec::<f64>::new();
    let mut last_beat = f64::NEG_INFINITY;
    for window in ordered.windows(3) {
        let previous = window[0];
        let current = window[1];
        let next = window[2];
        let is_local_maximum = current.rms > previous.rms && current.rms >= next.rms;
        if is_local_maximum && current.rms >= threshold && current.time - last_beat >= min_gap {
            beats.push(round_seconds(current.time));
            last_beat = current.time;
        }
    }
    beats
}

fn process_waveform_sample(
    sample: f32,
    samples_per_bucket: usize,
    bucket_peak: &mut f32,
    bucket_samples: &mut usize,
    peaks: &mut Vec<f32>,
) {
    if sample.is_finite() {
        *bucket_peak = bucket_peak.max(sample.abs().min(1.0));
    }
    *bucket_samples += 1;
    if *bucket_samples >= samples_per_bucket {
        peaks.push(round_peak(*bucket_peak));
        *bucket_peak = 0.0;
        *bucket_samples = 0;
    }
}

fn process_rms_sample(
    sample: f32,
    samples_per_sec: u32,
    samples_per_bucket: usize,
    bucket_sum_squares: &mut f64,
    bucket_samples: &mut usize,
    bucket_index: &mut usize,
    samples: &mut Vec<RmsSample>,
) {
    if sample.is_finite() {
        let clamped = (sample as f64).clamp(-1.0, 1.0);
        *bucket_sum_squares += clamped * clamped;
    }
    *bucket_samples += 1;
    if *bucket_samples >= samples_per_bucket {
        push_rms_bucket(
            samples_per_sec,
            bucket_sum_squares,
            bucket_samples,
            bucket_index,
            samples,
        );
    }
}

fn push_rms_bucket(
    samples_per_sec: u32,
    bucket_sum_squares: &mut f64,
    bucket_samples: &mut usize,
    bucket_index: &mut usize,
    samples: &mut Vec<RmsSample>,
) {
    let rms = if *bucket_samples == 0 {
        0.0
    } else {
        (*bucket_sum_squares / *bucket_samples as f64).sqrt()
    };
    samples.push(RmsSample {
        time: round_seconds(*bucket_index as f64 / samples_per_sec as f64),
        rms: round_peak(rms as f32) as f64,
    });
    *bucket_sum_squares = 0.0;
    *bucket_samples = 0;
    *bucket_index += 1;
}

fn beat_sensitivity_params(sensitivity: &str) -> (f64, f64) {
    match sensitivity {
        "low" => (0.72, 0.35),
        "high" => (0.38, 0.18),
        _ => (0.55, 0.25),
    }
}

fn parse_silence_number(line: &str, marker: &str) -> Option<f64> {
    let start = line.find(marker)? + marker.len();
    let value = line[start..]
        .trim_start()
        .split(|character: char| character.is_whitespace() || character == '|')
        .next()?;
    value.parse::<f64>().ok()
}

fn round_peak(value: f32) -> f32 {
    (value.clamp(0.0, 1.0) * 10_000.0).round() / 10_000.0
}

fn round_seconds(value: f64) -> f64 {
    (value * 1_000.0).round() / 1_000.0
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub(crate) fn build_freeze_frame_args(
    source_path: &str,
    output_path: &str,
    source_time: f64,
) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-ss".to_string(),
        format_gap_fill_seconds(source_time),
        "-i".to_string(),
        source_path.to_string(),
        "-vf".to_string(),
        "select=eq(n\\,0)".to_string(),
        "-frames:v".to_string(),
        "1".to_string(),
        output_path.to_string(),
    ]
}

pub(crate) fn build_solid_color_frame_args(
    output_path: &str,
    color: &str,
    width: u32,
    height: u32,
) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-f".to_string(),
        "lavfi".to_string(),
        "-i".to_string(),
        format!(
            "color=c={}:s={}x{}:d=0.04",
            normalize_gap_fill_color(color),
            width.max(16),
            height.max(16)
        ),
        "-frames:v".to_string(),
        "1".to_string(),
        output_path.to_string(),
    ]
}

pub(crate) fn build_i_frame_cover_args(
    source_path: &str,
    output_pattern: &str,
    frame_limit: Option<u32>,
) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-i".to_string(),
        source_path.to_string(),
        "-vf".to_string(),
        "select='eq(pict_type\\,I)'".to_string(),
        "-vsync".to_string(),
        "vfr".to_string(),
    ];
    if let Some(limit) = frame_limit {
        args.push("-frames:v".to_string());
        args.push(limit.clamp(1, 24).to_string());
    }
    args.push(output_pattern.to_string());
    args
}

pub(crate) fn build_first_i_frame_cover_args(source_path: &str, output_path: &str) -> Vec<String> {
    build_i_frame_cover_args(source_path, output_path, Some(1))
}

pub(crate) fn build_interval_cover_args(
    source_path: &str,
    output_path: &str,
    timestamp: f64,
) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-ss".to_string(),
        format_cover_seconds(timestamp),
        "-i".to_string(),
        source_path.to_string(),
        "-frames:v".to_string(),
        "1".to_string(),
        output_path.to_string(),
    ]
}

pub(crate) fn build_cover_frame_batch_task_count(tasks: &[CoverFrameBatchTaskRequest]) -> usize {
    tasks
        .iter()
        .filter(|task| !task.source_path.trim().is_empty())
        .count()
}

fn run_cover_ffmpeg(args: &[String], label: &str) -> Result<(), String> {
    let output = Command::new(ffmpeg_binary())
        .args(args)
        .output()
        .map_err(|error| format!("Unable to start FFmpeg {}: {}", label, error))?;
    if output.status.success() {
        return Ok(());
    }
    Err(format!(
        "FFmpeg {} failed: {}",
        label,
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

fn collect_generated_cover_frames(
    output_dir: &Path,
    prefix: &str,
    timestamps: Option<&[f64]>,
) -> Result<Vec<CoverFrameResult>, String> {
    let mut paths = fs::read_dir(output_dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(prefix) && name.ends_with(".png"))
        })
        .collect::<Vec<_>>();
    paths.sort();
    Ok(paths
        .into_iter()
        .enumerate()
        .map(|(index, path)| CoverFrameResult {
            index: index as u32,
            path: normalize_path(&path),
            timestamp: timestamps
                .and_then(|items| items.get(index).copied())
                .map(round_seconds),
        })
        .collect())
}

fn normalize_cover_timestamps(timestamps: Option<Vec<f64>>, count: u32) -> Vec<f64> {
    let provided = timestamps
        .unwrap_or_default()
        .into_iter()
        .filter(|value| value.is_finite() && *value >= 0.0)
        .map(round_seconds)
        .take(24)
        .collect::<Vec<_>>();
    if !provided.is_empty() {
        return provided;
    }
    (0..count.clamp(1, 24)).map(|index| index as f64).collect()
}

fn emit_cover_frame_progress(
    app: &AppHandle,
    task_id: &str,
    status: &str,
    current: u32,
    total: u32,
    output_path: Option<String>,
) {
    let total = total.max(1);
    let progress = (current as f32 / total as f32).clamp(0.0, 1.0);
    let _ = app.emit(
        "cover-frame-progress",
        CoverFrameProgressPayload {
            task_id: task_id.to_string(),
            status: status.to_string(),
            current,
            total,
            progress,
            progress_pct: (progress * 100.0).round() as u32,
            output_path,
        },
    );
}

fn run_gap_fill_ffmpeg(args: &[String], label: &str) -> Result<(), String> {
    let output = Command::new(ffmpeg_binary())
        .args(args)
        .output()
        .map_err(|error| format!("Unable to start FFmpeg {} generation: {}", label, error))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "FFmpeg {} generation failed: {}",
        label,
        stderr.trim()
    ))
}

fn normalize_gap_fill_color(color: &str) -> String {
    let trimmed = color.trim();
    if trimmed.len() == 7
        && trimmed.starts_with('#')
        && trimmed[1..].chars().all(|ch| ch.is_ascii_hexdigit())
    {
        return format!("0x{}", &trimmed[1..]);
    }
    if !trimmed.is_empty() && trimmed.chars().all(|ch| ch.is_ascii_alphabetic()) {
        return trimmed.to_ascii_lowercase();
    }
    "black".to_string()
}

fn format_gap_fill_seconds(value: f64) -> String {
    round_seconds(if value.is_finite() {
        value.max(0.0)
    } else {
        0.0
    })
    .to_string()
}

fn format_cover_seconds(value: f64) -> String {
    round_seconds(if value.is_finite() {
        value.max(0.0)
    } else {
        0.0
    })
    .to_string()
}

fn normalize_cover_file_stem(value: &str) -> String {
    let stem = value
        .trim()
        .trim_end_matches(".png")
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if stem.is_empty() {
        "cover-frame".to_string()
    } else {
        stem
    }
}

fn normalize_cover_file_name(value: &str) -> String {
    let stem = normalize_cover_file_stem(value);
    if stem.to_ascii_lowercase().ends_with(".png") {
        stem
    } else {
        format!("{}.png", stem)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn analyze_waveform_reads_test_audio_with_expected_bucket_count() {
        if !ffmpeg_available() {
            eprintln!("skipping waveform analysis test because ffmpeg is unavailable");
            return;
        }
        let dir = unique_temp_dir("open-factory-waveform-test");
        fs::create_dir_all(&dir).expect("create temp dir");
        let wav = dir.join("tone.wav");
        write_test_wav(&wav, 1.0, 8_000).expect("write wav");

        let peaks = analyze_waveform_path(&wav, 10).expect("analyze waveform");

        assert_eq!(peaks.len(), 10);
        assert!(peaks.iter().any(|peak| *peak > 0.0));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn parses_silence_detect_values() {
        assert_eq!(
            parse_silence_number("[silencedetect @ 0] silence_start: 1.234", "silence_start:"),
            Some(1.234)
        );
        assert_eq!(
            parse_silence_number(
                "[silencedetect @ 0] silence_end: 2.5 | silence_duration: 1.266",
                "silence_end:"
            ),
            Some(2.5)
        );
    }

    #[test]
    fn builds_gap_fill_media_ffmpeg_args() {
        assert_eq!(
            build_freeze_frame_args("C:/Media/source.mp4", "C:/Cache/freeze.png", 2.25),
            str_vec(&[
                "-y",
                "-hide_banner",
                "-ss",
                "2.25",
                "-i",
                "C:/Media/source.mp4",
                "-vf",
                "select=eq(n\\,0)",
                "-frames:v",
                "1",
                "C:/Cache/freeze.png"
            ])
        );
        assert_eq!(
            build_solid_color_frame_args("C:/Cache/black.png", "#000000", 1280, 720),
            str_vec(&[
                "-y",
                "-hide_banner",
                "-f",
                "lavfi",
                "-i",
                "color=c=0x000000:s=1280x720:d=0.04",
                "-frames:v",
                "1",
                "C:/Cache/black.png"
            ])
        );
    }

    #[test]
    fn builds_i_frame_cover_ffmpeg_args() {
        assert_eq!(
            build_i_frame_cover_args("C:/Media/source.mp4", "C:/Project/cover-%03d.png", Some(6)),
            str_vec(&[
                "-y",
                "-hide_banner",
                "-i",
                "C:/Media/source.mp4",
                "-vf",
                "select='eq(pict_type\\,I)'",
                "-vsync",
                "vfr",
                "-frames:v",
                "6",
                "C:/Project/cover-%03d.png"
            ])
        );
        assert_eq!(
            build_first_i_frame_cover_args("C:/Media/source.mp4", "C:/Project/cover.png"),
            str_vec(&[
                "-y",
                "-hide_banner",
                "-i",
                "C:/Media/source.mp4",
                "-vf",
                "select='eq(pict_type\\,I)'",
                "-vsync",
                "vfr",
                "-frames:v",
                "1",
                "C:/Project/cover.png"
            ])
        );
    }

    #[test]
    fn builds_interval_cover_args_and_counts_batch_tasks() {
        assert_eq!(
            build_interval_cover_args("C:/Media/source.mp4", "C:/Project/cover.png", 2.3456),
            str_vec(&[
                "-y",
                "-hide_banner",
                "-ss",
                "2.346",
                "-i",
                "C:/Media/source.mp4",
                "-frames:v",
                "1",
                "C:/Project/cover.png"
            ])
        );
        let tasks = vec![
            CoverFrameBatchTaskRequest {
                asset_id: "asset-a".to_string(),
                source_path: "C:/Media/a.mp4".to_string(),
                output_file_name: "a.png".to_string(),
            },
            CoverFrameBatchTaskRequest {
                asset_id: "asset-empty".to_string(),
                source_path: "  ".to_string(),
                output_file_name: "empty.png".to_string(),
            },
        ];
        assert_eq!(build_cover_frame_batch_task_count(&tasks), 1);
    }

    #[test]
    fn clamps_freeze_frame_time_for_gap_fill_args() {
        assert_eq!(
            build_freeze_frame_args("C:/Media/source.mp4", "C:/Cache/freeze.png", -2.5)
                .windows(2)
                .find(|pair| pair[0] == "-ss")
                .map(|pair| pair[1].as_str()),
            Some("0")
        );
        assert_eq!(
            build_freeze_frame_args("C:/Media/source.mp4", "C:/Cache/freeze.png", f64::NAN)
                .windows(2)
                .find(|pair| pair[0] == "-ss")
                .map(|pair| pair[1].as_str()),
            Some("0")
        );
    }

    #[test]
    fn normalizes_gap_fill_solid_color_names_and_invalid_values() {
        assert_eq!(normalize_gap_fill_color(" White "), "white");
        assert_eq!(normalize_gap_fill_color("#FACC15"), "0xFACC15");
        assert_eq!(normalize_gap_fill_color("rgb(0,0,0)"), "black");
    }

    #[test]
    fn clamps_gap_fill_solid_color_dimensions() {
        assert_eq!(
            build_solid_color_frame_args("C:/Cache/tiny.png", "white", 1, 0)
                .windows(2)
                .find(|pair| pair[0] == "-i")
                .map(|pair| pair[1].as_str()),
            Some("color=c=white:s=16x16:d=0.04")
        );
    }

    #[test]
    fn detect_beat_peaks_respects_sensitivity_threshold_and_spacing() {
        let samples = [
            RmsSample {
                time: 0.0,
                rms: 0.1,
            },
            RmsSample {
                time: 0.25,
                rms: 0.8,
            },
            RmsSample {
                time: 0.5,
                rms: 0.2,
            },
            RmsSample {
                time: 0.52,
                rms: 0.7,
            },
            RmsSample {
                time: 0.9,
                rms: 0.1,
            },
            RmsSample {
                time: 1.2,
                rms: 0.6,
            },
            RmsSample {
                time: 1.45,
                rms: 0.1,
            },
        ];

        assert_eq!(
            detect_beat_peaks_from_rms(&samples, "medium"),
            vec![0.25, 0.52, 1.2]
        );
        assert_eq!(detect_beat_peaks_from_rms(&samples, "low"), vec![0.25, 1.2]);
        assert_eq!(
            detect_beat_peaks_from_rms(&samples, "unknown"),
            vec![0.25, 0.52, 1.2]
        );
    }

    #[test]
    fn detect_beat_peaks_returns_empty_for_silent_or_tiny_inputs() {
        let silent = [
            RmsSample {
                time: 0.0,
                rms: 0.0,
            },
            RmsSample {
                time: 0.25,
                rms: 0.0,
            },
            RmsSample {
                time: 0.5,
                rms: 0.0,
            },
        ];
        let tiny = [
            RmsSample {
                time: 0.0,
                rms: 0.2,
            },
            RmsSample {
                time: 0.25,
                rms: 0.9,
            },
        ];

        assert!(detect_beat_peaks_from_rms(&silent, "medium").is_empty());
        assert!(detect_beat_peaks_from_rms(&tiny, "medium").is_empty());
    }

    #[test]
    fn parses_ffprobe_media_analysis_video_audio_and_hdr_fields() {
        let raw = br#"{
          "streams": [
            {
              "index": 0,
              "codec_name": "hevc",
              "codec_long_name": "H.265 / HEVC",
              "codec_type": "video",
              "duration": "12.000000",
              "width": 3840,
              "height": 2160,
              "avg_frame_rate": "30000/1001",
              "bit_rate": "45000000",
              "color_space": "bt2020nc",
              "color_transfer": "smpte2084",
              "color_primaries": "bt2020",
              "pix_fmt": "yuv420p10le",
              "field_order": "tt",
              "side_data_list": [
                { "side_data_type": "Mastering display metadata" },
                { "side_data_type": "Content light level metadata" }
              ]
            },
            {
              "index": 1,
              "codec_name": "aac",
              "codec_long_name": "AAC",
              "codec_type": "audio",
              "duration": "12.750000",
              "sample_rate": "48000",
              "channels": 2,
              "channel_layout": "stereo",
              "bit_rate": "192000"
            }
          ],
          "format": {
            "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
            "format_long_name": "QuickTime / MOV",
            "duration": "12.500000",
            "size": "72000000",
            "bit_rate": "46080000"
          },
          "packets": [
            { "pts_time": "0.000000", "duration_time": "0.033000", "size": "1000" },
            { "pts_time": "0.500000", "duration_time": "0.033000", "size": "1500" },
            { "pts_time": "1.100000", "duration_time": "0.033000", "size": "2000" }
          ]
        }"#;

        let analysis =
            parse_ffprobe_media_analysis("C:/Media/hdr.mov", raw).expect("parse ffprobe");

        assert_eq!(analysis.format.duration, Some(12.5));
        assert_eq!(
            analysis.video_streams[0].codec_name.as_deref(),
            Some("hevc")
        );
        assert_eq!(analysis.video_streams[0].width, Some(3840));
        assert_eq!(analysis.video_streams[0].height, Some(2160));
        assert_eq!(analysis.video_streams[0].duration, Some(12.0));
        assert_eq!(analysis.video_streams[0].frame_rate, Some(29.97));
        assert_eq!(
            analysis.video_streams[0].color_transfer.as_deref(),
            Some("smpte2084")
        );
        assert_eq!(
            analysis.video_streams[0].pixel_format.as_deref(),
            Some("yuv420p10le")
        );
        assert_eq!(analysis.video_streams[0].field_order.as_deref(), Some("tt"));
        assert_eq!(analysis.video_streams[0].hdr_metadata.len(), 2);
        assert_eq!(analysis.audio_streams[0].codec_name.as_deref(), Some("aac"));
        assert_eq!(analysis.audio_streams[0].duration, Some(12.75));
        assert_eq!(analysis.audio_streams[0].sample_rate, Some(48_000));
        assert_eq!(analysis.audio_streams[0].channels, Some(2));
        assert_eq!(
            analysis.bitrate_points,
            vec![
                BitratePoint {
                    time: 0.0,
                    bit_rate: 20_000
                },
                BitratePoint {
                    time: 1.0,
                    bit_rate: 16_000
                }
            ]
        );
    }

    #[test]
    fn builds_loudnorm_analysis_args_and_parses_integrated_lufs() {
        assert_eq!(
            build_loudnorm_analysis_args("C:/Media/tiny-video.mp4"),
            [
                "-hide_banner",
                "-nostats",
                "-i",
                "C:/Media/tiny-video.mp4",
                "-af",
                "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
                "-f",
                "null",
                "-"
            ]
        );
        let stderr = br#"[Parsed_loudnorm_0 @ 000]
{
  "input_i" : "-18.42",
  "input_tp" : "-2.20"
}"#;

        assert_eq!(parse_loudnorm_integrated_lufs(stderr), Some(-18.42));
    }

    #[test]
    fn builds_spectrogram_png_args() {
        assert_eq!(
            build_spectrogram_png_args("C:/Media/tiny-video.mp4", "C:/Temp/tiny-spectrum.png"),
            vec![
                "-y",
                "-hide_banner",
                "-nostats",
                "-i",
                "C:/Media/tiny-video.mp4",
                "-lavfi",
                "showspectrumpic=s=1280x512:mode=combined",
                "-frames:v",
                "1",
                "C:/Temp/tiny-spectrum.png"
            ]
        );
    }

    #[test]
    fn parses_ebur128_and_astats_summary() {
        let stderr = br#"
[Parsed_ebur128_0 @ 000] Summary:
  Integrated loudness:
    I:         -18.4 LUFS
  Loudness range:
    LRA:         7.2 LU
  True peak:
    Peak:       -1.3 dBFS
[Parsed_astats_1 @ 000] Peak level dB: -0.9
[Parsed_astats_1 @ 000] RMS level dB: -20.6
"#;

        let stats = parse_ebur128_stats(stderr).expect("parse stats");

        assert_eq!(stats.integrated_lufs, Some(-18.4));
        assert_eq!(stats.dynamic_range_lu, Some(7.2));
        assert_eq!(stats.true_peak_dbfs, Some(-1.3));
        assert_eq!(stats.peak_db, Some(-0.9));
        assert_eq!(stats.rms_db, Some(-20.6));
    }

    #[test]
    fn builds_ffprobe_media_analysis_args_with_packet_output() {
        assert_eq!(
            build_ffprobe_media_analysis_args("C:/Media/tiny-video.mp4"),
            [
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_streams",
                "-show_format",
                "-show_packets",
                "C:/Media/tiny-video.mp4"
            ]
        );
    }

    #[test]
    fn builds_media_integrity_scan_args() {
        assert_eq!(
            build_media_integrity_scan_args("C:/Media/tiny-video.mp4"),
            [
                "-v",
                "error",
                "-i",
                "C:/Media/tiny-video.mp4",
                "-f",
                "null",
                "-"
            ]
        );
    }

    #[test]
    fn detects_variable_frame_rate_from_avg_and_real_rates() {
        assert!(is_variable_frame_rate(
            Some("24000/1001"),
            Some("30000/1001")
        ));
        assert!(!is_variable_frame_rate(
            Some("30000/1001"),
            Some("30000/1001")
        ));
        assert!(!is_variable_frame_rate(Some("0/0"), Some("30000/1001")));
    }

    #[test]
    fn process_rms_sample_outputs_bucket_rms_times() {
        let mut samples = Vec::new();
        let mut sum = 0.0;
        let mut count = 0;
        let mut index = 0;

        for sample in [0.5_f32, -0.5, 1.0, -1.0] {
            process_rms_sample(sample, 2, 2, &mut sum, &mut count, &mut index, &mut samples);
        }

        assert_eq!(samples.len(), 2);
        assert_eq!(samples[0].time, 0.0);
        assert_eq!(samples[0].rms, 0.5);
        assert_eq!(samples[1].time, 0.5);
        assert_eq!(samples[1].rms, 1.0);
    }

    fn ffmpeg_available() -> bool {
        Command::new(ffmpeg_binary())
            .arg("-version")
            .output()
            .is_ok_and(|output| output.status.success())
    }

    fn unique_temp_dir(name: &str) -> std::path::PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("{name}-{id}"))
    }

    fn str_vec(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    fn write_test_wav(path: &Path, duration_secs: f64, sample_rate: u32) -> std::io::Result<()> {
        let sample_count = (duration_secs * sample_rate as f64).round() as u32;
        let data_bytes = sample_count * 2;
        let mut bytes = Vec::with_capacity((44 + data_bytes) as usize);
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + data_bytes).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16_u32.to_le_bytes());
        bytes.extend_from_slice(&1_u16.to_le_bytes());
        bytes.extend_from_slice(&1_u16.to_le_bytes());
        bytes.extend_from_slice(&sample_rate.to_le_bytes());
        bytes.extend_from_slice(&(sample_rate * 2).to_le_bytes());
        bytes.extend_from_slice(&2_u16.to_le_bytes());
        bytes.extend_from_slice(&16_u16.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&data_bytes.to_le_bytes());
        for index in 0..sample_count {
            let time = index as f64 / sample_rate as f64;
            let sample = (time * 440.0 * std::f64::consts::TAU).sin() * 0.25;
            bytes.extend_from_slice(&((sample * i16::MAX as f64) as i16).to_le_bytes());
        }
        fs::write(path, bytes)
    }
}
