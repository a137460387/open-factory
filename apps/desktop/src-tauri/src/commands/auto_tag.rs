use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::commands::media_index::add_tag_internal;
use crate::db;

/// 自动打标请求
#[derive(Debug, Clone, Deserialize)]
pub struct AutoTagRequest {
    #[allow(dead_code)]
    pub project_path: String,
    pub asset_id: String,
    pub name: String,
    pub asset_type: String,
    pub duration_ms: Option<i64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub frame_rate: Option<f64>,
    pub video_codec: Option<String>,
    #[allow(dead_code)]
    pub audio_codec: Option<String>,
    pub color_space: Option<String>,
    pub file_size: Option<i64>,
}

/// 自动打标结果
#[derive(Debug, Clone, Serialize)]
pub struct AutoTagResult {
    pub tags: Vec<String>,
}

/// 自动打标命令：基于媒体元数据自动生成标签并入库
#[tauri::command]
pub fn auto_tag_asset(request: AutoTagRequest) -> Result<AutoTagResult, String> {
    let tags = generate_auto_tags(&request);

    if tags.is_empty() {
        return Ok(AutoTagResult { tags: vec![] });
    }

    Ok(AutoTagResult { tags })
}

/// 批量自动打标命令
#[tauri::command]
pub fn batch_auto_tag_assets(
    app: AppHandle,
    project_path: String,
    requests: Vec<AutoTagRequest>,
) -> Result<Vec<AutoTagResult>, String> {
    let conn = db::open_db(&app, &project_path)?;

    let mut results = Vec::new();
    for request in &requests {
        let tags = generate_auto_tags(request);

        // 清除旧的自动标签
        conn.execute(
            "DELETE FROM asset_tags WHERE asset_id = ?1 AND source = 'auto'",
            rusqlite::params![request.asset_id],
        )
        .map_err(|e| format!("清除旧标签失败: {}", e))?;

        // 写入新标签
        for tag in &tags {
            add_tag_internal(&conn, &request.asset_id, tag, "auto")?;
        }

        results.push(AutoTagResult { tags });
    }

    Ok(results)
}

/// 基于元数据生成自动标签
fn generate_auto_tags(req: &AutoTagRequest) -> Vec<String> {
    let mut tags = Vec::new();

    // 分辨率标签
    if let (Some(w), Some(h)) = (req.width, req.height) {
        let max_dim = w.max(h);
        if max_dim >= 3840 {
            tags.push("4K".to_string());
        } else if max_dim >= 2560 {
            tags.push("2K".to_string());
        } else if max_dim >= 1920 {
            tags.push("1080p".to_string());
        } else if max_dim >= 1280 {
            tags.push("720p".to_string());
        } else {
            tags.push("SD".to_string());
        }

        // 宽高比标签
        if w > 0 && h > 0 {
            let ratio = w as f64 / h as f64;
            if (ratio - 16.0 / 9.0).abs() < 0.05 {
                tags.push("16:9".to_string());
            } else if (ratio - 9.0 / 16.0).abs() < 0.05 {
                tags.push("竖屏".to_string());
            } else if (ratio - 4.0 / 3.0).abs() < 0.05 {
                tags.push("4:3".to_string());
            } else if (ratio - 21.0 / 9.0).abs() < 0.1 {
                tags.push("超宽".to_string());
            }
        }
    }

    // 帧率标签
    if let Some(fps) = req.frame_rate {
        if fps >= 120.0 {
            tags.push("超高帧率".to_string());
            tags.push("慢动作".to_string());
        } else if fps >= 60.0 {
            tags.push("高帧率".to_string());
        } else if fps < 24.0 {
            tags.push("低帧率".to_string());
        }
    }

    // 时长标签
    if let Some(dur) = req.duration_ms {
        if dur < 10_000 {
            tags.push("短视频".to_string());
        } else if dur > 1_800_000 {
            tags.push("长视频".to_string());
        } else if dur > 600_000 {
            tags.push("中等视频".to_string());
        }
    }

    // 色彩空间标签
    if let Some(ref cs) = req.color_space {
        let cs_lower = cs.to_lowercase();
        if cs_lower.contains("2020") || cs_lower.contains("pq") || cs_lower.contains("hlg") {
            tags.push("HDR".to_string());
        } else {
            tags.push("SDR".to_string());
        }
    }

    // 编解码器标签
    if let Some(ref vc) = req.video_codec {
        let vc_lower = vc.to_lowercase();
        if vc_lower.contains("h265") || vc_lower.contains("hevc") {
            tags.push("HEVC".to_string());
        } else if vc_lower.contains("h264") || vc_lower.contains("avc") {
            tags.push("H.264".to_string());
        } else if vc_lower.contains("prores") {
            tags.push("ProRes".to_string());
        } else if vc_lower.contains("av1") {
            tags.push("AV1".to_string());
        }
    }

    // 媒体类型标签
    match req.asset_type.as_str() {
        "video" => tags.push("视频".to_string()),
        "audio" => tags.push("音频".to_string()),
        "image" => tags.push("图片".to_string()),
        _ => {}
    }

    // 文件名语义标签
    let name_lower = req.name.to_lowercase();

    if name_lower.starts_with("img_") || name_lower.starts_with("dsc_") || name_lower.starts_with("dscn") {
        tags.push("照片".to_string());
    }
    if name_lower.contains("screen") || name_lower.contains("录屏") || name_lower.contains("screenshot") {
        tags.push("录屏".to_string());
    }
    if name_lower.contains("clip") {
        tags.push("片段".to_string());
    }
    if name_lower.contains("render") || name_lower.contains("输出") || name_lower.contains("export") {
        tags.push("渲染输出".to_string());
    }
    if name_lower.contains("proxy") || name_lower.contains("代理") {
        tags.push("代理".to_string());
    }

    // 文件大小标签（仅视频）
    if req.asset_type == "video" {
        if let Some(size) = req.file_size {
            let size_mb = size as f64 / (1024.0 * 1024.0);
            if size_mb > 4096.0 {
                tags.push("大文件".to_string());
            } else if size_mb < 10.0 {
                tags.push("小文件".to_string());
            }
        }
    }

    // 去重
    tags.sort();
    tags.dedup();
    tags
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_request(overrides: impl FnOnce(&mut AutoTagRequest)) -> AutoTagRequest {
        let mut req = AutoTagRequest {
            project_path: "/test".to_string(),
            asset_id: "test-1".to_string(),
            name: "video.mp4".to_string(),
            asset_type: "video".to_string(),
            duration_ms: Some(60000),
            width: Some(1920),
            height: Some(1080),
            frame_rate: Some(30.0),
            video_codec: Some("h264".to_string()),
            audio_codec: Some("aac".to_string()),
            color_space: Some("bt709".to_string()),
            file_size: Some(100 * 1024 * 1024),
        };
        overrides(&mut req);
        req
    }

    #[test]
    fn test_resolution_tags() {
        // 4K
        let req = make_request(|r| {
            r.width = Some(3840);
            r.height = Some(2160);
        });
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"4K".to_string()));

        // 1080p
        let req = make_request(|r| {
            r.width = Some(1920);
            r.height = Some(1080);
        });
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"1080p".to_string()));

        // 720p
        let req = make_request(|r| {
            r.width = Some(1280);
            r.height = Some(720);
        });
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"720p".to_string()));

        // SD
        let req = make_request(|r| {
            r.width = Some(640);
            r.height = Some(480);
        });
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"SD".to_string()));
    }

    #[test]
    fn test_frame_rate_tags() {
        let req = make_request(|r| r.frame_rate = Some(60.0));
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"高帧率".to_string()));

        let req = make_request(|r| r.frame_rate = Some(120.0));
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"超高帧率".to_string()));
        assert!(tags.contains(&"慢动作".to_string()));
    }

    #[test]
    fn test_duration_tags() {
        let req = make_request(|r| r.duration_ms = Some(5000));
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"短视频".to_string()));

        let req = make_request(|r| r.duration_ms = Some(2_000_000));
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"长视频".to_string()));
    }

    #[test]
    fn test_hdr_tag() {
        let req = make_request(|r| r.color_space = Some("bt2020".to_string()));
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"HDR".to_string()));
    }

    #[test]
    fn test_codec_tags() {
        let req = make_request(|r| r.video_codec = Some("hevc".to_string()));
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"HEVC".to_string()));

        let req = make_request(|r| r.video_codec = Some("prores_ks".to_string()));
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"ProRes".to_string()));
    }

    #[test]
    fn test_aspect_ratio_tags() {
        // 竖屏
        let req = make_request(|r| {
            r.width = Some(1080);
            r.height = Some(1920);
        });
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"竖屏".to_string()));

        // 超宽
        let req = make_request(|r| {
            r.width = Some(3440);
            r.height = Some(1440);
        });
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"超宽".to_string()));
    }

    #[test]
    fn test_filename_semantic_tags() {
        let req = make_request(|r| r.name = "IMG_1234.jpg".to_string());
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"照片".to_string()));

        let req = make_request(|r| r.name = "screen-recording-2026.mp4".to_string());
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"录屏".to_string()));
    }

    #[test]
    fn test_audio_type_tag() {
        let req = make_request(|r| {
            r.asset_type = "audio".to_string();
            r.width = None;
            r.height = None;
            r.frame_rate = None;
            r.video_codec = None;
        });
        let tags = generate_auto_tags(&req);
        assert!(tags.contains(&"音频".to_string()));
    }

    #[test]
    fn test_no_duplicate_tags() {
        let req = make_request(|r| {
            r.name = "screen-screen-recording.mp4".to_string();
        });
        let tags = generate_auto_tags(&req);
        let screen_count = tags.iter().filter(|t| *t == "录屏").count();
        assert_eq!(screen_count, 1);
    }
}
