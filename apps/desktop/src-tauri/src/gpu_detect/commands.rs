use crate::gpu_detect::detector;
use crate::gpu_detect::types::GpuInfo;

/// Detects GPU environment and returns detailed info.
#[tauri::command]
pub async fn detect_gpu() -> Result<GpuInfo, String> {
    let info = tauri::async_runtime::spawn_blocking(detector::detect_gpu)
        .await
        .map_err(|e| format!("GPU detection failed: {e}"))?;
    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_gpu_command_returns_valid_info() {
        let info = detector::detect_gpu();
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("available"));
        assert!(json.contains("recommendedPrecision"));
    }
}
