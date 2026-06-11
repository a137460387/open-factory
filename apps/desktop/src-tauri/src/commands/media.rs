use crate::path_validator::validate_path;
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use tauri::AppHandle;

const WAVEFORM_SAMPLE_RATE: u32 = 48_000;

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
