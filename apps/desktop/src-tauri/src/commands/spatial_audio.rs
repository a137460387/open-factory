use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager};

const KEMAR_HRTF_EXPECTED_BYTES: u64 = 2 * 1024 * 1024;
const IR_SAMPLE_RATE: u32 = 48_000;
const IR_SAMPLES: usize = 768;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpatialAudioAssetsDto {
    hrtf_path: String,
    room_impulse_responses: RoomImpulseResponsePathsDto,
    copied: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomImpulseResponsePathsDto {
    #[serde(rename = "small-room")]
    small_room: String,
    hall: String,
    outdoor: String,
}

#[tauri::command]
pub fn ensure_spatial_audio_assets(app: AppHandle) -> Result<SpatialAudioAssetsDto, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("hrtf");
    let ir_root = root.join("ir");
    fs::create_dir_all(&ir_root).map_err(|error| error.to_string())?;

    let hrtf_path = root.join("kemar.bin");
    let mut copied = false;
    if should_copy_kemar_file(&hrtf_path) {
        fs::write(&hrtf_path, generated_kemar_bytes())
            .map_err(|error| format!("Unable to write {}: {}", normalize_path(&hrtf_path), error))?;
        copied = true;
    }

    let small_room = ir_root.join("small-room.wav");
    let hall = ir_root.join("hall.wav");
    let outdoor = ir_root.join("outdoor.wav");
    copied |= ensure_ir_file(&small_room, 5)?;
    copied |= ensure_ir_file(&hall, 11)?;
    copied |= ensure_ir_file(&outdoor, 17)?;

    Ok(SpatialAudioAssetsDto {
        hrtf_path: normalize_path(&hrtf_path),
        room_impulse_responses: RoomImpulseResponsePathsDto {
            small_room: normalize_path(&small_room),
            hall: normalize_path(&hall),
            outdoor: normalize_path(&outdoor),
        },
        copied,
    })
}

pub(crate) fn should_copy_kemar_file(path: &Path) -> bool {
    fs::metadata(path)
        .map(|metadata| metadata.len() < KEMAR_HRTF_EXPECTED_BYTES)
        .unwrap_or(true)
}

fn ensure_ir_file(path: &Path, seed: u16) -> Result<bool, String> {
    if fs::metadata(path).map(|metadata| metadata.len() > 44).unwrap_or(false) {
        return Ok(false);
    }
    fs::write(path, generated_impulse_response_wav(seed))
        .map_err(|error| format!("Unable to write {}: {}", normalize_path(path), error))?;
    Ok(true)
}

fn generated_kemar_bytes() -> Vec<u8> {
    let mut bytes = Vec::with_capacity(KEMAR_HRTF_EXPECTED_BYTES as usize);
    bytes.extend_from_slice(b"OPEN_FACTORY_CLEAN_ROOM_KEMAR_GRID_V1\0");
    let mut state: u32 = 0x4f46_4854;
    while bytes.len() < KEMAR_HRTF_EXPECTED_BYTES as usize {
        state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        bytes.extend_from_slice(&state.to_le_bytes());
    }
    bytes.truncate(KEMAR_HRTF_EXPECTED_BYTES as usize);
    bytes
}

fn generated_impulse_response_wav(seed: u16) -> Vec<u8> {
    let data_len = (IR_SAMPLES * 2 * 2) as u32;
    let mut bytes = Vec::with_capacity(44 + data_len as usize);
    bytes.extend_from_slice(b"RIFF");
    bytes.extend_from_slice(&(36 + data_len).to_le_bytes());
    bytes.extend_from_slice(b"WAVEfmt ");
    bytes.extend_from_slice(&16u32.to_le_bytes());
    bytes.extend_from_slice(&1u16.to_le_bytes());
    bytes.extend_from_slice(&2u16.to_le_bytes());
    bytes.extend_from_slice(&IR_SAMPLE_RATE.to_le_bytes());
    bytes.extend_from_slice(&(IR_SAMPLE_RATE * 2 * 2).to_le_bytes());
    bytes.extend_from_slice(&4u16.to_le_bytes());
    bytes.extend_from_slice(&16u16.to_le_bytes());
    bytes.extend_from_slice(b"data");
    bytes.extend_from_slice(&data_len.to_le_bytes());
    for index in 0..IR_SAMPLES {
        let envelope = ((IR_SAMPLES - index) as f32 / IR_SAMPLES as f32).powf(2.4);
        let value = if index == 0 {
            0.85
        } else {
            (((index as u16).wrapping_mul(seed) % 97) as f32 / 96.0 - 0.5) * envelope * 0.12
        };
        let sample = (value * i16::MAX as f32) as i16;
        bytes.extend_from_slice(&sample.to_le_bytes());
        bytes.extend_from_slice(&sample.to_le_bytes());
    }
    bytes
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn should_copy_missing_or_undersized_kemar_file_only() {
        let root = unique_temp_dir("kemar-copy");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("kemar.bin");

        assert!(should_copy_kemar_file(&path));
        fs::write(&path, vec![0u8; 128]).unwrap();
        assert!(should_copy_kemar_file(&path));
        fs::write(&path, vec![0u8; KEMAR_HRTF_EXPECTED_BYTES as usize]).unwrap();
        assert!(!should_copy_kemar_file(&path));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn generated_assets_have_expected_shapes() {
        assert_eq!(generated_kemar_bytes().len(), KEMAR_HRTF_EXPECTED_BYTES as usize);
        let ir = generated_impulse_response_wav(7);
        assert_eq!(&ir[0..4], b"RIFF");
        assert_eq!(&ir[8..12], b"WAVE");
        assert!(ir.len() > 44);
    }

    fn unique_temp_dir(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("open-factory-{}-{}", prefix, nanos))
    }
}
