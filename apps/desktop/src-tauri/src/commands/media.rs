use crate::path_validator::validate_path;
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use tauri::AppHandle;

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
}

#[tauri::command]
pub fn probe_media(app: AppHandle, path: String) -> Result<MediaProbe, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    let input_path = normalize_path(&safe_path);
    let output = Command::new(if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    })
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
    })
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

pub(crate) fn analyze_rms_path(path: &Path, samples_per_sec: u32) -> Result<Vec<RmsSample>, String> {
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
    let max_rms = ordered.iter().map(|sample| sample.rms).fold(0.0_f64, f64::max);
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

fn ffmpeg_binary() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
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
    fn detect_beat_peaks_respects_sensitivity_threshold_and_spacing() {
        let samples = [
            RmsSample { time: 0.0, rms: 0.1 },
            RmsSample { time: 0.25, rms: 0.8 },
            RmsSample { time: 0.5, rms: 0.2 },
            RmsSample { time: 0.52, rms: 0.7 },
            RmsSample { time: 0.9, rms: 0.1 },
            RmsSample { time: 1.2, rms: 0.6 },
            RmsSample { time: 1.45, rms: 0.1 },
        ];

        assert_eq!(detect_beat_peaks_from_rms(&samples, "medium"), vec![0.25, 0.52, 1.2]);
        assert_eq!(detect_beat_peaks_from_rms(&samples, "low"), vec![0.25, 1.2]);
        assert_eq!(detect_beat_peaks_from_rms(&samples, "unknown"), vec![0.25, 0.52, 1.2]);
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
