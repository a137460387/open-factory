use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/// 硬件加速后端类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HardwareBackend {
    Cuda,
    Vaapi,
    QuickSync,
    VideoToolbox,
    D3d11va,
    Auto,
    Software,
}

impl std::fmt::Display for HardwareBackend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HardwareBackend::Cuda => write!(f, "CUDA (NVIDIA)"),
            HardwareBackend::Vaapi => write!(f, "VAAPI (AMD/Intel Linux)"),
            HardwareBackend::QuickSync => write!(f, "QuickSync (Intel)"),
            HardwareBackend::VideoToolbox => write!(f, "VideoToolbox (macOS)"),
            HardwareBackend::D3d11va => write!(f, "D3D11VA (Windows)"),
            HardwareBackend::Auto => write!(f, "Auto"),
            HardwareBackend::Software => write!(f, "Software"),
        }
    }
}

impl HardwareBackend {
    /// 获取 FFmpeg hwaccel 参数值
    fn to_ffmpeg_hwaccel(&self) -> &str {
        match self {
            HardwareBackend::Cuda => "cuda",
            HardwareBackend::Vaapi => "vaapi",
            HardwareBackend::QuickSync => "qsv",
            HardwareBackend::VideoToolbox => "videotoolbox",
            HardwareBackend::D3d11va => "d3d11va",
            HardwareBackend::Auto => "auto",
            HardwareBackend::Software => "",
        }
    }

    /// 获取 FFmpeg hwaccel 输出格式参数
    fn to_ffmpeg_hwaccel_output_format(&self) -> &str {
        match self {
            HardwareBackend::Cuda => "cuda",
            HardwareBackend::Vaapi => "vaapi",
            HardwareBackend::QuickSync => "qsv",
            HardwareBackend::VideoToolbox => "videotoolbox",
            HardwareBackend::D3d11va => "d3d11va",
            HardwareBackend::Auto => "auto",
            HardwareBackend::Software => "",
        }
    }
}

/// 硬件加速能力信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareCapabilities {
    pub available_backends: Vec<HardwareBackendInfo>,
    pub recommended_backend: HardwareBackend,
    pub supported_codecs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareBackendInfo {
    pub backend: HardwareBackend,
    pub available: bool,
    pub device_name: Option<String>,
    pub supported_codecs: Vec<String>,
}

/// 硬件解码设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HwDecodeSettings {
    pub mode: String,           // "auto" | "enabled" | "disabled"
    pub preferred_backend: HardwareBackend,
    pub enable_frame_cache: bool,
    pub frame_cache_size: u32,
    pub enable_pre_decode: bool,
    pub pre_decode_frame_count: u32,
}

impl Default for HwDecodeSettings {
    fn default() -> Self {
        Self {
            mode: "auto".to_string(),
            preferred_backend: HardwareBackend::Auto,
            enable_frame_cache: true,
            frame_cache_size: 30,
            enable_pre_decode: true,
            pre_decode_frame_count: 5,
        }
    }
}

/// 解码器句柄
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DecoderHandle(pub u64);

/// 解码后的视频帧
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedFrame {
    pub width: u32,
    pub height: u32,
    pub data_base64: String,
    pub timestamp: f64,
    pub format: String,
}

/// 解码器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecoderConfig {
    pub path: String,
    pub preferred_backend: Option<HardwareBackend>,
    pub target_width: Option<u32>,
    pub target_height: Option<u32>,
}

/// 视频信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub width: u32,
    pub height: u32,
    pub duration: f64,
    pub codec: String,
    pub frame_rate: f64,
}

/// 全局解码器管理器
static DECODER_MANAGER: once_cell::sync::Lazy<Arc<Mutex<DecoderManager>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(DecoderManager::new())));

struct DecoderManager {
    decoders: HashMap<u64, Box<dyn HardwareDecoder + Send>>,
    next_handle: u64,
    settings: HwDecodeSettings,
}

impl DecoderManager {
    fn new() -> Self {
        Self {
            decoders: HashMap::new(),
            next_handle: 1,
            settings: HwDecodeSettings::default(),
        }
    }

    fn allocate_handle(&mut self) -> u64 {
        let handle = self.next_handle;
        self.next_handle += 1;
        handle
    }
}

/// 硬件解码器 trait
trait HardwareDecoder {
    fn decode_frame(&mut self, timestamp: f64) -> Result<DecodedFrame, String>;
    fn seek(&mut self, timestamp: f64) -> Result<(), String>;
    fn get_duration(&self) -> f64;
    fn get_size(&self) -> (u32, u32);
}

/// FFmpeg 硬件加速解码器实现
struct FFmpegHardwareDecoder {
    path: String,
    backend: HardwareBackend,
    width: u32,
    height: u32,
    duration: f64,
    current_timestamp: f64,
    video_info: VideoInfo,
}

impl FFmpegHardwareDecoder {
    fn new(config: &DecoderConfig) -> Result<Self, String> {
        // 验证文件存在
        if !std::path::Path::new(&config.path).exists() {
            return Err(format!("文件不存在: {}", config.path));
        }

        // 检测硬件后端
        let backend = config
            .preferred_backend
            .clone()
            .unwrap_or(HardwareBackend::Auto);

        // 获取视频信息（通过 ffprobe）
        let video_info = probe_video_info(&config.path)?;

        let target_width = config.target_width.unwrap_or(video_info.width);
        let target_height = config.target_height.unwrap_or(video_info.height);

        Ok(Self {
            path: config.path.clone(),
            backend,
            width: target_width,
            height: target_height,
            duration: video_info.duration,
            current_timestamp: 0.0,
            video_info,
        })
    }

    /// 构建带硬件加速的 FFmpeg 命令参数
    fn build_decode_args(&self, timestamp: f64) -> Vec<String> {
        let mut args = Vec::new();

        // 添加硬件加速参数（如果不是软件解码）
        if self.backend != HardwareBackend::Software {
            let hwaccel = self.backend.to_ffmpeg_hwaccel();
            if !hwaccel.is_empty() {
                args.push("-hwaccel".to_string());
                args.push(hwaccel.to_string());
                args.push("-hwaccel_output_format".to_string());
                args.push(self.backend.to_ffmpeg_hwaccel_output_format().to_string());
            }
        }

        // seek 参数放在 -i 之前以实现快速 seek
        args.push("-ss".to_string());
        args.push(format!("{:.6}", timestamp));

        args.push("-i".to_string());
        args.push(self.path.clone());

        args.push("-vframes".to_string());
        args.push("1".to_string());

        // 输出格式
        args.push("-f".to_string());
        args.push("rawvideo".to_string());

        // 如果使用硬件加速，需要将帧从 GPU 拷回 CPU
        if self.backend != HardwareBackend::Software {
            let hwaccel = self.backend.to_ffmpeg_hwaccel();
            if !hwaccel.is_empty() {
                // 使用 format 滤镜将硬件帧转换为 rgba
                args.push("-pix_fmt".to_string());
                args.push("rgba".to_string());
            } else {
                args.push("-pix_fmt".to_string());
                args.push("rgba".to_string());
            }
        } else {
            args.push("-pix_fmt".to_string());
            args.push("rgba".to_string());
        }

        // 如果指定了目标尺寸，添加缩放滤镜
        if self.width != self.video_info.width || self.height != self.video_info.height {
            args.push("-vf".to_string());
            args.push(format!("scale={}:{}", self.width, self.height));
        }

        args.push("-".to_string());

        args
    }
}

impl HardwareDecoder for FFmpegHardwareDecoder {
    fn decode_frame(&mut self, timestamp: f64) -> Result<DecodedFrame, String> {
        self.current_timestamp = timestamp;

        let args = self.build_decode_args(timestamp);

        // 尝试使用硬件加速解码
        let output = std::process::Command::new("ffmpeg")
            .args(&args)
            .output()
            .map_err(|e| format!("FFmpeg 执行失败: {}", e))?;

        // 如果硬件加速失败，回退到软件解码
        let raw_data = if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if self.backend != HardwareBackend::Software {
                // 回退到软件解码
                let fallback_args = self.build_software_fallback_args(timestamp);
                let fallback_output = std::process::Command::new("ffmpeg")
                    .args(&fallback_args)
                    .output()
                    .map_err(|e| format!("FFmpeg 软件解码也失败: {}", e))?;

                if !fallback_output.status.success() {
                    let fallback_stderr = String::from_utf8_lossy(&fallback_output.stderr);
                    return Err(format!(
                        "硬件解码失败: {}\n软件解码也失败: {}",
                        stderr, fallback_stderr
                    ));
                }
                fallback_output.stdout
            } else {
                return Err(format!("FFmpeg 解码失败: {}", stderr));
            }
        } else {
            output.stdout
        };

        let expected_size = (self.width * self.height * 4) as usize;

        if raw_data.len() < expected_size {
            return Err(format!(
                "解码数据大小不匹配: 期望 {}, 实际 {}",
                expected_size,
                raw_data.len()
            ));
        }

        let data_base64 =
            base64::engine::general_purpose::STANDARD.encode(&raw_data[..expected_size]);

        Ok(DecodedFrame {
            width: self.width,
            height: self.height,
            data_base64,
            timestamp,
            format: "rgba".to_string(),
        })
    }

    fn seek(&mut self, timestamp: f64) -> Result<(), String> {
        self.current_timestamp = timestamp;
        Ok(())
    }

    fn get_duration(&self) -> f64 {
        self.duration
    }

    fn get_size(&self) -> (u32, u32) {
        (self.width, self.height)
    }
}

impl FFmpegHardwareDecoder {
    /// 构建软件解码回退参数
    fn build_software_fallback_args(&self, timestamp: f64) -> Vec<String> {
        let mut args = Vec::new();

        // seek 参数放在 -i 之前以实现快速 seek
        args.push("-ss".to_string());
        args.push(format!("{:.6}", timestamp));

        args.push("-i".to_string());
        args.push(self.path.clone());

        args.push("-vframes".to_string());
        args.push("1".to_string());

        args.push("-f".to_string());
        args.push("rawvideo".to_string());

        args.push("-pix_fmt".to_string());
        args.push("rgba".to_string());

        // 如果指定了目标尺寸，添加缩放滤镜
        if self.width != self.video_info.width || self.height != self.video_info.height {
            args.push("-vf".to_string());
            args.push(format!("scale={}:{}", self.width, self.height));
        }

        args.push("-".to_string());

        args
    }
}

/// 探测视频信息
fn probe_video_info(path: &str) -> Result<VideoInfo, String> {
    let output = std::process::Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,duration,codec_name,r_frame_rate",
            "-of",
            "json",
            path,
        ])
        .output()
        .map_err(|e| format!("ffprobe 执行失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe 失败: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("解析 ffprobe 输出失败: {}", e))?;

    let stream = json["streams"]
        .as_array()
        .and_then(|s| s.first())
        .ok_or_else(|| "未找到视频流".to_string())?;

    let width = stream["width"]
        .as_u64()
        .ok_or_else(|| "无法获取宽度".to_string())? as u32;
    let height = stream["height"]
        .as_u64()
        .ok_or_else(|| "无法获取高度".to_string())? as u32;
    let duration = stream["duration"]
        .as_str()
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);
    let codec = stream["codec_name"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();
    let frame_rate = stream["r_frame_rate"]
        .as_str()
        .and_then(|fr| {
            let parts: Vec<&str> = fr.split('/').collect();
            if parts.len() == 2 {
                let num = parts[0].parse::<f64>().ok()?;
                let den = parts[1].parse::<f64>().ok()?;
                if den > 0.0 {
                    Some(num / den)
                } else {
                    None
                }
            } else {
                fr.parse::<f64>().ok()
            }
        })
        .unwrap_or(30.0);

    Ok(VideoInfo {
        width,
        height,
        duration,
        codec,
        frame_rate,
    })
}

/// 检测硬件加速能力
#[tauri::command]
pub async fn get_hw_decode_capabilities() -> Result<HardwareCapabilities, String> {
    let mut backends = Vec::new();

    // 检测 CUDA
    let cuda_available = detect_cuda();
    backends.push(HardwareBackendInfo {
        backend: HardwareBackend::Cuda,
        available: cuda_available,
        device_name: if cuda_available {
            get_cuda_device_name()
        } else {
            None
        },
        supported_codecs: if cuda_available {
            vec![
                "h264".to_string(),
                "hevc".to_string(),
                "vp9".to_string(),
                "av1".to_string(),
            ]
        } else {
            vec![]
        },
    });

    // 检测 VAAPI (Linux)
    #[cfg(target_os = "linux")]
    {
        let vaapi_available = detect_vaapi();
        backends.push(HardwareBackendInfo {
            backend: HardwareBackend::Vaapi,
            available: vaapi_available,
            device_name: if vaapi_available {
                Some("VAAPI Device".to_string())
            } else {
                None
            },
            supported_codecs: if vaapi_available {
                vec!["h264".to_string(), "hevc".to_string()]
            } else {
                vec![]
            },
        });
    }

    // 检测 QuickSync
    let qsv_available = detect_quick_sync();
    backends.push(HardwareBackendInfo {
        backend: HardwareBackend::QuickSync,
        available: qsv_available,
        device_name: if qsv_available {
            Some("Intel QuickSync".to_string())
        } else {
            None
        },
        supported_codecs: if qsv_available {
            vec!["h264".to_string(), "hevc".to_string()]
        } else {
            vec![]
        },
    });

    // 检测 VideoToolbox (macOS)
    #[cfg(target_os = "macos")]
    {
        let vt_available = detect_video_toolbox();
        backends.push(HardwareBackendInfo {
            backend: HardwareBackend::VideoToolbox,
            available: vt_available,
            device_name: if vt_available {
                Some("VideoToolbox".to_string())
            } else {
                None
            },
            supported_codecs: if vt_available {
                vec!["h264".to_string(), "hevc".to_string()]
            } else {
                vec![]
            },
        });
    }

    // 检测 D3D11VA (Windows)
    #[cfg(target_os = "windows")]
    {
        let d3d11_available = detect_d3d11va();
        backends.push(HardwareBackendInfo {
            backend: HardwareBackend::D3d11va,
            available: d3d11_available,
            device_name: if d3d11_available {
                Some("D3D11VA".to_string())
            } else {
                None
            },
            supported_codecs: if d3d11_available {
                vec![
                    "h264".to_string(),
                    "hevc".to_string(),
                    "vp9".to_string(),
                ]
            } else {
                vec![]
            },
        });
    }

    // 推荐后端
    let recommended = if backends
        .iter()
        .any(|b| b.backend == HardwareBackend::Cuda && b.available)
    {
        HardwareBackend::Cuda
    } else if backends
        .iter()
        .any(|b| b.backend == HardwareBackend::D3d11va && b.available)
    {
        HardwareBackend::D3d11va
    } else if backends
        .iter()
        .any(|b| b.backend == HardwareBackend::VideoToolbox && b.available)
    {
        HardwareBackend::VideoToolbox
    } else if backends
        .iter()
        .any(|b| b.backend == HardwareBackend::QuickSync && b.available)
    {
        HardwareBackend::QuickSync
    } else if backends
        .iter()
        .any(|b| b.backend == HardwareBackend::Vaapi && b.available)
    {
        HardwareBackend::Vaapi
    } else {
        HardwareBackend::Software
    };

    Ok(HardwareCapabilities {
        available_backends: backends,
        recommended_backend: recommended,
        supported_codecs: vec![
            "h264".to_string(),
            "hevc".to_string(),
            "vp9".to_string(),
            "av1".to_string(),
        ],
    })
}

/// 初始化硬件解码器
#[tauri::command]
pub async fn init_hardware_decoder(config: DecoderConfig) -> Result<DecoderHandle, String> {
    let mut manager = DECODER_MANAGER
        .lock()
        .map_err(|_| "无法获取解码器管理器锁".to_string())?;

    let decoder = FFmpegHardwareDecoder::new(&config)?;
    let handle_id = manager.allocate_handle();
    manager.decoders.insert(handle_id, Box::new(decoder));

    Ok(DecoderHandle(handle_id))
}

/// 解码单个视频帧
#[tauri::command]
pub async fn decode_video_frame(
    handle: DecoderHandle,
    timestamp: f64,
) -> Result<DecodedFrame, String> {
    let mut manager = DECODER_MANAGER
        .lock()
        .map_err(|_| "无法获取解码器管理器锁".to_string())?;

    let decoder = manager
        .decoders
        .get_mut(&handle.0)
        .ok_or_else(|| format!("解码器句柄无效: {:?}", handle))?;

    decoder.decode_frame(timestamp)
}

/// 批量解码多个视频帧
#[tauri::command]
pub async fn decode_video_frames(
    handle: DecoderHandle,
    timestamps: Vec<f64>,
) -> Result<Vec<DecodedFrame>, String> {
    let mut manager = DECODER_MANAGER
        .lock()
        .map_err(|_| "无法获取解码器管理器锁".to_string())?;

    let decoder = manager
        .decoders
        .get_mut(&handle.0)
        .ok_or_else(|| format!("解码器句柄无效: {:?}", handle))?;

    let mut frames = Vec::with_capacity(timestamps.len());
    for timestamp in timestamps {
        let frame = decoder.decode_frame(timestamp)?;
        frames.push(frame);
    }

    Ok(frames)
}

/// 获取解码器视频信息
#[tauri::command]
pub async fn get_decoder_video_info(handle: DecoderHandle) -> Result<VideoInfo, String> {
    let manager = DECODER_MANAGER
        .lock()
        .map_err(|_| "无法获取解码器管理器锁".to_string())?;

    let decoder = manager
        .decoders
        .get(&handle.0)
        .ok_or_else(|| format!("解码器句柄无效: {:?}", handle))?;

    Ok(VideoInfo {
        width: decoder.get_size().0,
        height: decoder.get_size().1,
        duration: decoder.get_duration(),
        codec: "unknown".to_string(),
        frame_rate: 30.0,
    })
}

/// 释放解码器
#[tauri::command]
pub async fn release_decoder(handle: DecoderHandle) -> Result<(), String> {
    let mut manager = DECODER_MANAGER
        .lock()
        .map_err(|_| "无法获取解码器管理器锁".to_string())?;

    manager.decoders.remove(&handle.0);
    Ok(())
}

/// 获取硬件解码设置
#[tauri::command]
pub async fn get_hw_decode_settings() -> Result<HwDecodeSettings, String> {
    let manager = DECODER_MANAGER
        .lock()
        .map_err(|_| "无法获取解码器管理器锁".to_string())?;

    Ok(manager.settings.clone())
}

/// 更新硬件解码设置
#[tauri::command]
pub async fn set_hw_decode_settings(settings: HwDecodeSettings) -> Result<(), String> {
    let mut manager = DECODER_MANAGER
        .lock()
        .map_err(|_| "无法获取解码器管理器锁".to_string())?;

    manager.settings = settings;
    Ok(())
}

/// 硬件检测辅助函数
fn detect_cuda() -> bool {
    // 通过 nvidia-smi 检测
    std::process::Command::new("nvidia-smi")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn get_cuda_device_name() -> Option<String> {
    let output = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=name", "--format=csv,noheader"])
        .output()
        .ok()?;
    String::from_utf8(output.stdout)
        .ok()
        .map(|s| s.trim().to_string())
}

fn detect_quick_sync() -> bool {
    // 检测 Intel GPU
    #[cfg(target_os = "windows")]
    {
        // Windows: 通过 WMIC 检测
        std::process::Command::new("wmic")
            .args(["path", "win32_videocontroller", "get", "name"])
            .output()
            .map(|output| {
                let stdout = String::from_utf8_lossy(&output.stdout);
                stdout.to_lowercase().contains("intel")
            })
            .unwrap_or(false)
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: 检查 /dev/dri
        std::path::Path::new("/dev/dri/renderD128").exists()
    }
    #[cfg(target_os = "macos")]
    {
        false
    }
}

#[cfg(target_os = "linux")]
fn detect_vaapi() -> bool {
    // 检查 VAAPI 设备
    std::path::Path::new("/dev/dri/renderD128").exists()
}

#[cfg(target_os = "macos")]
fn detect_video_toolbox() -> bool {
    // macOS 默认支持 VideoToolbox
    true
}

#[cfg(target_os = "windows")]
fn detect_d3d11va() -> bool {
    // Windows 10+ 默认支持 D3D11VA
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hardware_backend_display() {
        assert_eq!(HardwareBackend::Cuda.to_string(), "CUDA (NVIDIA)");
        assert_eq!(
            HardwareBackend::QuickSync.to_string(),
            "QuickSync (Intel)"
        );
        assert_eq!(HardwareBackend::Software.to_string(), "Software");
    }

    #[test]
    fn test_decoder_handle_serialization() {
        let handle = DecoderHandle(42);
        let json = serde_json::to_string(&handle).unwrap();
        let deserialized: DecoderHandle = serde_json::from_str(&json).unwrap();
        assert_eq!(handle, deserialized);
    }

    #[test]
    fn test_decoded_frame_serialization() {
        let frame = DecodedFrame {
            width: 1920,
            height: 1080,
            data_base64: "test".to_string(),
            timestamp: 1.5,
            format: "rgba".to_string(),
        };
        let json = serde_json::to_string(&frame).unwrap();
        let deserialized: DecodedFrame = serde_json::from_str(&json).unwrap();
        assert_eq!(frame.width, deserialized.width);
        assert_eq!(frame.height, deserialized.height);
        assert_eq!(frame.timestamp, deserialized.timestamp);
    }

    #[test]
    fn test_decoder_config_defaults() {
        let config = DecoderConfig {
            path: "/path/to/video.mp4".to_string(),
            preferred_backend: None,
            target_width: None,
            target_height: None,
        };
        assert!(config.preferred_backend.is_none());
        assert!(config.target_width.is_none());
    }

    #[test]
    fn test_hw_decode_settings_default() {
        let settings = HwDecodeSettings::default();
        assert_eq!(settings.mode, "auto");
        assert_eq!(settings.preferred_backend, HardwareBackend::Auto);
        assert!(settings.enable_frame_cache);
        assert_eq!(settings.frame_cache_size, 30);
        assert!(settings.enable_pre_decode);
        assert_eq!(settings.pre_decode_frame_count, 5);
    }

    #[test]
    fn test_hw_decode_settings_serialization() {
        let settings = HwDecodeSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: HwDecodeSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings.mode, deserialized.mode);
        assert_eq!(settings.preferred_backend, deserialized.preferred_backend);
    }

    #[test]
    fn test_video_info_serialization() {
        let info = VideoInfo {
            width: 3840,
            height: 2160,
            duration: 120.5,
            codec: "h264".to_string(),
            frame_rate: 29.97,
        };
        let json = serde_json::to_string(&info).unwrap();
        let deserialized: VideoInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(info.width, deserialized.width);
        assert_eq!(info.codec, deserialized.codec);
    }

    #[test]
    fn test_hardware_backend_ffmpeg_hwaccel() {
        assert_eq!(HardwareBackend::Cuda.to_ffmpeg_hwaccel(), "cuda");
        assert_eq!(HardwareBackend::Vaapi.to_ffmpeg_hwaccel(), "vaapi");
        assert_eq!(HardwareBackend::QuickSync.to_ffmpeg_hwaccel(), "qsv");
        assert_eq!(
            HardwareBackend::VideoToolbox.to_ffmpeg_hwaccel(),
            "videotoolbox"
        );
        assert_eq!(HardwareBackend::D3d11va.to_ffmpeg_hwaccel(), "d3d11va");
        assert_eq!(HardwareBackend::Auto.to_ffmpeg_hwaccel(), "auto");
        assert_eq!(HardwareBackend::Software.to_ffmpeg_hwaccel(), "");
    }

    #[test]
    fn test_hardware_capabilities_serialization() {
        let caps = HardwareCapabilities {
            available_backends: vec![HardwareBackendInfo {
                backend: HardwareBackend::Cuda,
                available: true,
                device_name: Some("NVIDIA GeForce RTX 3080".to_string()),
                supported_codecs: vec!["h264".to_string(), "hevc".to_string()],
            }],
            recommended_backend: HardwareBackend::Cuda,
            supported_codecs: vec!["h264".to_string(), "hevc".to_string()],
        };
        let json = serde_json::to_string(&caps).unwrap();
        let deserialized: HardwareCapabilities = serde_json::from_str(&json).unwrap();
        assert_eq!(
            caps.recommended_backend,
            deserialized.recommended_backend
        );
        assert_eq!(
            deserialized.available_backends[0].device_name,
            Some("NVIDIA GeForce RTX 3080".to_string())
        );
    }
}
