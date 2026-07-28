use crate::gpu_detect::types::{GpuInfo, NvidiaSmiInfo, Precision};
use std::process::Command;

/// Detects GPU environment by running nvidia-smi and parsing its output.
pub fn detect_gpu() -> GpuInfo {
    // Try nvidia-smi first
    match run_nvidia_smi() {
        Ok(info) => {
            let (precision, compatible) = recommend_precision(info.vram_total_mb);
            GpuInfo {
                available: true,
                gpu_name: Some(info.gpu_name),
                driver_version: Some(info.driver_version),
                cuda_version: Some(info.cuda_version),
                vram_total_mb: Some(info.vram_total_mb),
                vram_free_mb: Some(info.vram_free_mb),
                recommended_precision: precision,
                pytorch_compatible: compatible,
                error_message: None,
            }
        }
        Err(e) => {
            // Try Vulkan as fallback
            match detect_vulkan_gpu() {
                Some(name) => GpuInfo {
                    available: true,
                    gpu_name: Some(name),
                    driver_version: None,
                    cuda_version: None,
                    vram_total_mb: None,
                    vram_free_mb: None,
                    recommended_precision: Precision::Fp32,
                    pytorch_compatible: false,
                    error_message: Some(
                        "GPU detected via Vulkan but CUDA not available. PyTorch inference may not work.".to_string(),
                    ),
                },
                None => GpuInfo {
                    available: false,
                    error_message: Some(format!("No GPU detected: {}", e)),
                    ..Default::default()
                },
            }
        }
    }
}

/// Runs nvidia-smi and parses the output for GPU info.
fn run_nvidia_smi() -> Result<NvidiaSmiInfo, String> {
    let output = Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,driver_version,memory.total,memory.free",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .map_err(|e| format!("failed to run nvidia-smi: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("nvidia-smi failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout
        .lines()
        .next()
        .ok_or_else(|| "nvidia-smi returned empty output".to_string())?;

    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
    if parts.len() < 4 {
        return Err(format!(
            "nvidia-smi output has {} fields, expected 4",
            parts.len()
        ));
    }

    let gpu_name = parts[0].to_string();
    let driver_version = parts[1].to_string();
    let vram_total_mb: u64 = parts[2]
        .parse()
        .map_err(|e| format!("parse vram total: {e}"))?;
    let vram_free_mb: u64 = parts[3]
        .parse()
        .map_err(|e| format!("parse vram free: {e}"))?;

    // Get CUDA version separately
    let cuda_version = get_cuda_version().unwrap_or_else(|| "unknown".to_string());

    Ok(NvidiaSmiInfo {
        gpu_name,
        driver_version,
        cuda_version,
        vram_total_mb,
        vram_free_mb,
    })
}

/// Extracts CUDA version from nvidia-smi full output.
fn get_cuda_version() -> Option<String> {
    let output = Command::new("nvidia-smi").output().ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        if line.contains("CUDA Version") {
            // Format: "CUDA Version: 12.2"
            if let Some(pos) = line.find("CUDA Version:") {
                let rest = &line[pos + "CUDA Version:".len()..];
                let version = rest.trim().split_whitespace().next()?;
                return Some(version.to_string());
            }
        }
    }

    None
}

/// Tries to detect GPU via Vulkan (vulkaninfo).
fn detect_vulkan_gpu() -> Option<String> {
    let output = Command::new("vulkaninfo")
        .args(["--summary"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains("deviceName") {
            if let Some(pos) = line.find('=') {
                return Some(line[pos + 1..].trim().to_string());
            }
        }
    }

    None
}

/// Recommends inference precision based on available VRAM.
/// Returns (precision, pytorch_compatible).
fn recommend_precision(vram_mb: u64) -> (Precision, bool) {
    if vram_mb >= 16_000 {
        // 16GB+ VRAM: can run fp16 comfortably
        (Precision::Fp16, true)
    } else if vram_mb >= 8_000 {
        // 8-16GB: fp16 with potential memory pressure
        (Precision::Fp16, true)
    } else if vram_mb >= 4_000 {
        // 4-8GB: fp32 may be too large, bf16 if supported
        (Precision::Bf16, true)
    } else {
        // <4GB: very limited
        (Precision::Fp32, false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recommend_precision_high_vram() {
        let (prec, compat) = recommend_precision(24_000);
        assert_eq!(prec, Precision::Fp16);
        assert!(compat);
    }

    #[test]
    fn recommend_precision_medium_vram() {
        let (prec, compat) = recommend_precision(12_000);
        assert_eq!(prec, Precision::Fp16);
        assert!(compat);
    }

    #[test]
    fn recommend_precision_low_vram() {
        let (prec, compat) = recommend_precision(6_000);
        assert_eq!(prec, Precision::Bf16);
        assert!(compat);
    }

    #[test]
    fn recommend_precision_very_low_vram() {
        let (prec, compat) = recommend_precision(2_000);
        assert_eq!(prec, Precision::Fp32);
        assert!(!compat);
    }

    #[test]
    fn detect_gpu_returns_structured_info() {
        let info = detect_gpu();
        // This test just verifies the function returns without panicking
        // Actual GPU detection depends on the system
        assert!(info.recommended_precision == Precision::Fp16
            || info.recommended_precision == Precision::Fp32
            || info.recommended_precision == Precision::Bf16);
    }
}
