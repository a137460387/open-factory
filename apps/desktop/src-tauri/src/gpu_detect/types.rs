use serde::{Deserialize, Serialize};

/// GPU environment information detected from the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub available: bool,
    pub gpu_name: Option<String>,
    pub driver_version: Option<String>,
    pub cuda_version: Option<String>,
    pub vram_total_mb: Option<u64>,
    pub vram_free_mb: Option<u64>,
    pub recommended_precision: Precision,
    pub pytorch_compatible: bool,
    pub error_message: Option<String>,
}

/// Inference precision options.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Precision {
    Fp16,
    Fp32,
    Bf16,
}

/// Result of nvidia-smi query.
#[derive(Debug, Clone)]
pub struct NvidiaSmiInfo {
    pub gpu_name: String,
    pub driver_version: String,
    pub cuda_version: String,
    pub vram_total_mb: u64,
    pub vram_free_mb: u64,
}

impl Default for GpuInfo {
    fn default() -> Self {
        Self {
            available: false,
            gpu_name: None,
            driver_version: None,
            cuda_version: None,
            vram_total_mb: None,
            vram_free_mb: None,
            recommended_precision: Precision::Fp32,
            pytorch_compatible: false,
            error_message: None,
        }
    }
}

impl GpuInfo {
    /// Returns a human-readable summary of the GPU environment.
    pub fn summary(&self) -> String {
        if !self.available {
            return self
                .error_message
                .clone()
                .unwrap_or_else(|| "No compatible GPU detected.".to_string());
        }

        let name = self.gpu_name.as_deref().unwrap_or("Unknown GPU");
        let vram = self
            .vram_total_mb
            .map(|v| format!("{} MB VRAM", v))
            .unwrap_or_else(|| "VRAM unknown".to_string());
        let cuda = self
            .cuda_version
            .as_deref()
            .map(|v| format!("CUDA {}", v))
            .unwrap_or_else(|| "CUDA unknown".to_string());

        format!(
            "{} | {} | {} | Precision: {:?}",
            name, vram, cuda, self.recommended_precision
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gpu_info_default_unavailable() {
        let info = GpuInfo::default();
        assert!(!info.available);
        assert_eq!(info.recommended_precision, Precision::Fp32);
        assert!(!info.pytorch_compatible);
    }

    #[test]
    fn gpu_info_summary_no_gpu() {
        let info = GpuInfo::default();
        assert_eq!(info.summary(), "No compatible GPU detected.");
    }

    #[test]
    fn gpu_info_summary_with_error() {
        let info = GpuInfo {
            available: false,
            error_message: Some("nvidia-smi not found".to_string()),
            ..Default::default()
        };
        assert_eq!(info.summary(), "nvidia-smi not found");
    }

    #[test]
    fn gpu_info_summary_with_details() {
        let info = GpuInfo {
            available: true,
            gpu_name: Some("RTX 4090".to_string()),
            driver_version: Some("535.129.03".to_string()),
            cuda_version: Some("12.2".to_string()),
            vram_total_mb: Some(24564),
            vram_free_mb: Some(20000),
            recommended_precision: Precision::Fp16,
            pytorch_compatible: true,
            error_message: None,
        };
        let summary = info.summary();
        assert!(summary.contains("RTX 4090"));
        assert!(summary.contains("24564 MB VRAM"));
        assert!(summary.contains("CUDA 12.2"));
        assert!(summary.contains("Fp16"));
    }

    #[test]
    fn precision_serializes_lowercase() {
        assert_eq!(
            serde_json::to_string(&Precision::Fp16).unwrap(),
            "\"fp16\""
        );
        assert_eq!(
            serde_json::to_string(&Precision::Fp32).unwrap(),
            "\"fp32\""
        );
        assert_eq!(
            serde_json::to_string(&Precision::Bf16).unwrap(),
            "\"bf16\""
        );
    }
}
