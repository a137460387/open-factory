use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db;

/// 媒体资产索引数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaIndexAsset {
    pub id: String,
    pub path: String,
    pub name: String,
    pub asset_type: String,
    pub file_size: Option<i64>,
    pub duration_ms: Option<i64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub frame_rate: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub color_space: Option<String>,
    pub label_color: Option<String>,
    pub rating: Option<i32>,
    pub flag: Option<String>,
    pub imported_at: String,
    pub thumbnail_path: Option<String>,
    pub proxy_path: Option<String>,
}

/// 检索查询结构
#[derive(Debug, Clone, Deserialize)]
pub struct MediaSearchQuery {
    pub project_path: String,
    pub text: Option<String>,
    pub asset_types: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub min_width: Option<i32>,
    pub max_width: Option<i32>,
    pub min_height: Option<i32>,
    pub max_height: Option<i32>,
    pub min_duration_ms: Option<i64>,
    pub max_duration_ms: Option<i64>,
    pub min_rating: Option<i32>,
    pub label_color: Option<String>,
    pub flag: Option<String>,
    pub sort_by: Option<String>,
    pub sort_desc: Option<bool>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

/// 检索结果
#[derive(Debug, Clone, Serialize)]
pub struct MediaSearchResult {
    pub assets: Vec<MediaIndexAsset>,
    pub total: u32,
    pub page: u32,
    pub page_size: u32,
}

/// 标签及计数
#[derive(Debug, Clone, Serialize)]
pub struct TagWithCount {
    pub id: i64,
    pub name: String,
    pub count: u32,
}

/// 初始化媒体索引数据库
#[tauri::command]
pub fn init_media_index_db(app: AppHandle, project_path: String) -> Result<(), String> {
    db::open_db(&app, &project_path)?;
    Ok(())
}

/// 插入或更新媒体资产索引
#[tauri::command]
pub fn upsert_media_asset(
    app: AppHandle,
    project_path: String,
    asset: MediaIndexAsset,
) -> Result<(), String> {
    let conn = db::open_db(&app, &project_path)?;
    upsert_asset_internal(&conn, &asset)
}

/// 批量插入或更新媒体资产索引
#[tauri::command]
pub fn batch_upsert_media_assets(
    app: AppHandle,
    project_path: String,
    assets: Vec<MediaIndexAsset>,
) -> Result<usize, String> {
    let conn = db::open_db(&app, &project_path)?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("无法开始事务: {}", e))?;

    let mut count = 0;
    for asset in &assets {
        upsert_asset_internal(&tx, asset)?;
        count += 1;
    }

    tx.commit().map_err(|e| format!("无法提交事务: {}", e))?;
    Ok(count)
}

/// 删除媒体资产索引
#[tauri::command]
pub fn delete_media_asset(
    app: AppHandle,
    project_path: String,
    id: String,
) -> Result<(), String> {
    let conn = db::open_db(&app, &project_path)?;
    conn.execute("DELETE FROM media_assets WHERE id = ?1", params![id])
        .map_err(|e| format!("删除资产失败: {}", e))?;
    Ok(())
}

/// 多条件组合检索
#[tauri::command]
pub fn search_media_assets(
    app: AppHandle,
    query: MediaSearchQuery,
) -> Result<MediaSearchResult, String> {
    let conn = db::open_db(&app, &query.project_path)?;
    search_assets_internal(&conn, &query)
}

/// 获取所有标签及使用计数
#[tauri::command]
pub fn get_all_tags(app: AppHandle, project_path: String) -> Result<Vec<TagWithCount>, String> {
    let conn = db::open_db(&app, &project_path)?;

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, COUNT(at.asset_id) as cnt
             FROM tags t
             LEFT JOIN asset_tags at ON t.id = at.tag_id
             GROUP BY t.id, t.name
             ORDER BY cnt DESC",
        )
        .map_err(|e| format!("准备查询失败: {}", e))?;

    let tags = stmt
        .query_map([], |row| {
            Ok(TagWithCount {
                id: row.get(0)?,
                name: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| format!("查询标签失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取标签失败: {}", e))?;

    Ok(tags)
}

/// 手动添加标签
#[tauri::command]
pub fn add_manual_tag(
    app: AppHandle,
    project_path: String,
    asset_id: String,
    tag_name: String,
) -> Result<(), String> {
    let conn = db::open_db(&app, &project_path)?;
    add_tag_internal(&conn, &asset_id, &tag_name, "manual")
}

/// 手动移除标签
#[tauri::command]
pub fn remove_manual_tag(
    app: AppHandle,
    project_path: String,
    asset_id: String,
    tag_name: String,
) -> Result<(), String> {
    let conn = db::open_db(&app, &project_path)?;
    conn.execute(
        "DELETE FROM asset_tags WHERE asset_id = ?1 AND tag_id = (SELECT id FROM tags WHERE name = ?2) AND source = 'manual'",
        params![asset_id, tag_name],
    )
    .map_err(|e| format!("移除标签失败: {}", e))?;
    Ok(())
}

// ========== 内部辅助函数 ==========

fn upsert_asset_internal(conn: &Connection, asset: &MediaIndexAsset) -> Result<(), String> {
    let now = chrono_now();

    conn.execute(
        "INSERT INTO media_assets (id, path, name, asset_type, file_size, duration_ms, width, height, frame_rate, video_codec, audio_codec, color_space, label_color, rating, flag, imported_at, updated_at, thumbnail_path, proxy_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
         ON CONFLICT(id) DO UPDATE SET
            path = excluded.path,
            name = excluded.name,
            asset_type = excluded.asset_type,
            file_size = excluded.file_size,
            duration_ms = excluded.duration_ms,
            width = excluded.width,
            height = excluded.height,
            frame_rate = excluded.frame_rate,
            video_codec = excluded.video_codec,
            audio_codec = excluded.audio_codec,
            color_space = excluded.color_space,
            label_color = excluded.label_color,
            rating = excluded.rating,
            flag = excluded.flag,
            updated_at = excluded.updated_at,
            thumbnail_path = excluded.thumbnail_path,
            proxy_path = excluded.proxy_path",
        params![
            asset.id,
            asset.path,
            asset.name,
            asset.asset_type,
            asset.file_size,
            asset.duration_ms,
            asset.width,
            asset.height,
            asset.frame_rate,
            asset.video_codec,
            asset.audio_codec,
            asset.color_space,
            asset.label_color,
            asset.rating,
            asset.flag,
            asset.imported_at,
            now,
            asset.thumbnail_path,
            asset.proxy_path,
        ],
    )
    .map_err(|e| format!("写入资产索引失败: {}", e))?;

    // 同步更新 FTS 索引
    conn.execute(
        "INSERT INTO media_fts(rowid, name, path) SELECT rowid, name, path FROM media_assets WHERE id = ?1",
        params![asset.id],
    )
    .map_err(|e| format!("更新全文索引失败: {}", e))?;

    Ok(())
}

fn search_assets_internal(
    conn: &Connection,
    query: &MediaSearchQuery,
) -> Result<MediaSearchResult, String> {
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(50).min(200);
    let offset = (page - 1) * page_size;

    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1;

    // 全文搜索
    if let Some(ref text) = query.text {
        if !text.is_empty() {
            conditions.push(format!(
                "m.rowid IN (SELECT rowid FROM media_fts WHERE media_fts MATCH ?{})",
                param_idx
            ));
            param_values.push(Box::new(format!("{}*", text)));
            param_idx += 1;
        }
    }

    // 类型过滤
    if let Some(ref types) = query.asset_types {
        if !types.is_empty() {
            let placeholders: Vec<String> = types
                .iter()
                .enumerate()
                .map(|_| {
                    let p = format!("?{}", param_idx);
                    param_idx += 1;
                    p
                })
                .collect();
            conditions.push(format!("m.asset_type IN ({})", placeholders.join(",")));
            for t in types {
                param_values.push(Box::new(t.clone()));
            }
        }
    }

    // 分辨率范围
    if let Some(min_w) = query.min_width {
        conditions.push(format!("m.width >= ?{}", param_idx));
        param_values.push(Box::new(min_w));
        param_idx += 1;
    }
    if let Some(max_w) = query.max_width {
        conditions.push(format!("m.width <= ?{}", param_idx));
        param_values.push(Box::new(max_w));
        param_idx += 1;
    }
    if let Some(min_h) = query.min_height {
        conditions.push(format!("m.height >= ?{}", param_idx));
        param_values.push(Box::new(min_h));
        param_idx += 1;
    }
    if let Some(max_h) = query.max_height {
        conditions.push(format!("m.height <= ?{}", param_idx));
        param_values.push(Box::new(max_h));
        param_idx += 1;
    }

    // 时长范围
    if let Some(min_dur) = query.min_duration_ms {
        conditions.push(format!("m.duration_ms >= ?{}", param_idx));
        param_values.push(Box::new(min_dur));
        param_idx += 1;
    }
    if let Some(max_dur) = query.max_duration_ms {
        conditions.push(format!("m.duration_ms <= ?{}", param_idx));
        param_values.push(Box::new(max_dur));
        param_idx += 1;
    }

    // 评分
    if let Some(min_rating) = query.min_rating {
        conditions.push(format!("m.rating >= ?{}", param_idx));
        param_values.push(Box::new(min_rating));
        param_idx += 1;
    }

    // 标签色
    if let Some(ref lc) = query.label_color {
        conditions.push(format!("m.label_color = ?{}", param_idx));
        param_values.push(Box::new(lc.clone()));
        param_idx += 1;
    }

    // 旗帜
    if let Some(ref flag) = query.flag {
        conditions.push(format!("m.flag = ?{}", param_idx));
        param_values.push(Box::new(flag.clone()));
        param_idx += 1;
    }

    // 标签过滤
    if let Some(ref tags) = query.tags {
        if !tags.is_empty() {
            for tag in tags {
                conditions.push(format!(
                    "m.id IN (SELECT at2.asset_id FROM asset_tags at2 JOIN tags t2 ON at2.tag_id = t2.id WHERE t2.name = ?{})",
                    param_idx
                ));
                param_values.push(Box::new(tag.clone()));
                param_idx += 1;
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // 排序
    let sort_field = match query.sort_by.as_deref() {
        Some("name") => "m.name",
        Some("duration") => "m.duration_ms",
        Some("size") => "m.file_size",
        Some("importedAt") => "m.imported_at",
        Some("rating") => "m.rating",
        _ => "m.imported_at",
    };
    let sort_dir = if query.sort_desc.unwrap_or(true) {
        "DESC"
    } else {
        "ASC"
    };

    // 计数查询
    let count_sql = format!("SELECT COUNT(*) FROM media_assets m {}", where_clause);
    let mut count_stmt = conn
        .prepare(&count_sql)
        .map_err(|e| format!("准备计数查询失败: {}", e))?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();
    let total: u32 = count_stmt
        .query_row(param_refs.as_slice(), |row| row.get(0))
        .map_err(|e| format!("执行计数查询失败: {}", e))?;

    // 数据查询
    let data_sql = format!(
        "SELECT m.id, m.path, m.name, m.asset_type, m.file_size, m.duration_ms,
                m.width, m.height, m.frame_rate, m.video_codec, m.audio_codec,
                m.color_space, m.label_color, m.rating, m.flag,
                m.imported_at, m.thumbnail_path, m.proxy_path
         FROM media_assets m {}
         ORDER BY {} {} LIMIT ?{} OFFSET ?{}",
        where_clause, sort_field, sort_dir, param_idx, param_idx + 1
    );

    let mut data_stmt = conn
        .prepare(&data_sql)
        .map_err(|e| format!("准备数据查询失败: {}", e))?;

    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = param_values;
    all_params.push(Box::new(page_size));
    all_params.push(Box::new(offset));
    let all_refs: Vec<&dyn rusqlite::types::ToSql> =
        all_params.iter().map(|p| p.as_ref()).collect();

    let assets = data_stmt
        .query_map(all_refs.as_slice(), |row| {
            Ok(MediaIndexAsset {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                asset_type: row.get(3)?,
                file_size: row.get(4)?,
                duration_ms: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                frame_rate: row.get(8)?,
                video_codec: row.get(9)?,
                audio_codec: row.get(10)?,
                color_space: row.get(11)?,
                label_color: row.get(12)?,
                rating: row.get(13)?,
                flag: row.get(14)?,
                imported_at: row.get(15)?,
                thumbnail_path: row.get(16)?,
                proxy_path: row.get(17)?,
            })
        })
        .map_err(|e| format!("执行数据查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取查询结果失败: {}", e))?;

    Ok(MediaSearchResult {
        assets,
        total,
        page,
        page_size,
    })
}

/// 添加标签（内部使用）
pub fn add_tag_internal(
    conn: &Connection,
    asset_id: &str,
    tag_name: &str,
    source: &str,
) -> Result<(), String> {
    // 确保标签存在
    conn.execute(
        "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
        params![tag_name],
    )
    .map_err(|e| format!("创建标签失败: {}", e))?;

    // 获取标签 ID
    let tag_id: i64 = conn
        .query_row("SELECT id FROM tags WHERE name = ?1", params![tag_name], |row| {
            row.get(0)
        })
        .map_err(|e| format!("查询标签 ID 失败: {}", e))?;

    // 关联资产和标签
    conn.execute(
        "INSERT OR IGNORE INTO asset_tags (asset_id, tag_id, source) VALUES (?1, ?2, ?3)",
        params![asset_id, tag_id, source],
    )
    .map_err(|e| format!("关联标签失败: {}", e))?;

    Ok(())
}

/// 获取当前时间的 ISO 8601 字符串（UTC）
pub fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let total_secs = now.as_secs();

    // 计算年月日
    let days_since_epoch = total_secs / 86400;
    let (year, month, day) = days_to_ymd(days_since_epoch);
    let secs_in_day = total_secs % 86400;
    let hour = secs_in_day / 3600;
    let minute = (secs_in_day % 3600) / 60;
    let second = secs_in_day % 60;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

/// 将天数转换为年月日
fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut year = 1970;
    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let leap = is_leap_year(year);
    let days_in_month = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1;
    for &dim in &days_in_month {
        if days < dim {
            break;
        }
        days -= dim;
        month += 1;
    }
    (year, month, days + 1)
}

fn is_leap_year(year: u64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::schema::migrate(&conn).unwrap();
        conn
    }

    #[test]
    fn test_upsert_and_query_asset() {
        let conn = setup_db();
        let asset = MediaIndexAsset {
            id: "test-1".to_string(),
            path: "/test/video.mp4".to_string(),
            name: "video.mp4".to_string(),
            asset_type: "video".to_string(),
            file_size: Some(1024000),
            duration_ms: Some(60000),
            width: Some(1920),
            height: Some(1080),
            frame_rate: Some(30.0),
            video_codec: Some("h264".to_string()),
            audio_codec: Some("aac".to_string()),
            color_space: Some("bt709".to_string()),
            label_color: None,
            rating: None,
            flag: None,
            imported_at: "2026-07-13T00:00:00Z".to_string(),
            thumbnail_path: None,
            proxy_path: None,
        };

        upsert_asset_internal(&conn, &asset).unwrap();

        // 验证插入
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM media_assets", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_search_with_type_filter() {
        let conn = setup_db();

        // 插入不同类型的资产
        for (id, name, atype) in &[
            ("1", "video.mp4", "video"),
            ("2", "audio.mp3", "audio"),
            ("3", "image.png", "image"),
        ] {
            let asset = MediaIndexAsset {
                id: id.to_string(),
                path: format!("/test/{}", name),
                name: name.to_string(),
                asset_type: atype.to_string(),
                file_size: None,
                duration_ms: None,
                width: None,
                height: None,
                frame_rate: None,
                video_codec: None,
                audio_codec: None,
                color_space: None,
                label_color: None,
                rating: None,
                flag: None,
                imported_at: "2026-07-13T00:00:00Z".to_string(),
                thumbnail_path: None,
                proxy_path: None,
            };
            upsert_asset_internal(&conn, &asset).unwrap();
        }

        // 搜索视频类型
        let query = MediaSearchQuery {
            project_path: "/test".to_string(),
            text: None,
            asset_types: Some(vec!["video".to_string()]),
            tags: None,
            min_width: None,
            max_width: None,
            min_height: None,
            max_height: None,
            min_duration_ms: None,
            max_duration_ms: None,
            min_rating: None,
            label_color: None,
            flag: None,
            sort_by: None,
            sort_desc: None,
            page: None,
            page_size: None,
        };

        let result = search_assets_internal(&conn, &query).unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.assets[0].asset_type, "video");
    }

    #[test]
    fn test_search_with_resolution_filter() {
        let conn = setup_db();

        let asset_4k = MediaIndexAsset {
            id: "4k".to_string(),
            path: "/test/4k.mp4".to_string(),
            name: "4k.mp4".to_string(),
            asset_type: "video".to_string(),
            file_size: None,
            duration_ms: None,
            width: Some(3840),
            height: Some(2160),
            frame_rate: None,
            video_codec: None,
            audio_codec: None,
            color_space: None,
            label_color: None,
            rating: None,
            flag: None,
            imported_at: "2026-07-13T00:00:00Z".to_string(),
            thumbnail_path: None,
            proxy_path: None,
        };
        let asset_720p = MediaIndexAsset {
            id: "720p".to_string(),
            path: "/test/720p.mp4".to_string(),
            name: "720p.mp4".to_string(),
            asset_type: "video".to_string(),
            file_size: None,
            duration_ms: None,
            width: Some(1280),
            height: Some(720),
            frame_rate: None,
            video_codec: None,
            audio_codec: None,
            color_space: None,
            label_color: None,
            rating: None,
            flag: None,
            imported_at: "2026-07-13T00:00:00Z".to_string(),
            thumbnail_path: None,
            proxy_path: None,
        };

        upsert_asset_internal(&conn, &asset_4k).unwrap();
        upsert_asset_internal(&conn, &asset_720p).unwrap();

        // 搜索 >= 1920 宽度
        let query = MediaSearchQuery {
            project_path: "/test".to_string(),
            text: None,
            asset_types: None,
            tags: None,
            min_width: Some(1920),
            max_width: None,
            min_height: None,
            max_height: None,
            min_duration_ms: None,
            max_duration_ms: None,
            min_rating: None,
            label_color: None,
            flag: None,
            sort_by: None,
            sort_desc: None,
            page: None,
            page_size: None,
        };

        let result = search_assets_internal(&conn, &query).unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.assets[0].id, "4k");
    }

    #[test]
    fn test_add_and_get_tags() {
        let conn = setup_db();

        let asset = MediaIndexAsset {
            id: "test-1".to_string(),
            path: "/test/video.mp4".to_string(),
            name: "video.mp4".to_string(),
            asset_type: "video".to_string(),
            file_size: None,
            duration_ms: None,
            width: None,
            height: None,
            frame_rate: None,
            video_codec: None,
            audio_codec: None,
            color_space: None,
            label_color: None,
            rating: None,
            flag: None,
            imported_at: "2026-07-13T00:00:00Z".to_string(),
            thumbnail_path: None,
            proxy_path: None,
        };
        upsert_asset_internal(&conn, &asset).unwrap();

        // 添加标签
        add_tag_internal(&conn, "test-1", "4K", "auto").unwrap();
        add_tag_internal(&conn, "test-1", "户外", "manual").unwrap();

        // 查询标签
        let mut stmt = conn
            .prepare(
                "SELECT t.name FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ?1",
            )
            .unwrap();
        let tags: Vec<String> = stmt
            .query_map(params!["test-1"], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(tags.len(), 2);
        assert!(tags.contains(&"4K".to_string()));
        assert!(tags.contains(&"户外".to_string()));
    }

    #[test]
    fn test_search_with_tag_filter() {
        let conn = setup_db();

        let asset1 = MediaIndexAsset {
            id: "a1".to_string(),
            path: "/test/a1.mp4".to_string(),
            name: "a1.mp4".to_string(),
            asset_type: "video".to_string(),
            file_size: None,
            duration_ms: None,
            width: None,
            height: None,
            frame_rate: None,
            video_codec: None,
            audio_codec: None,
            color_space: None,
            label_color: None,
            rating: None,
            flag: None,
            imported_at: "2026-07-13T00:00:00Z".to_string(),
            thumbnail_path: None,
            proxy_path: None,
        };
        let asset2 = MediaIndexAsset {
            id: "a2".to_string(),
            path: "/test/a2.mp4".to_string(),
            name: "a2.mp4".to_string(),
            asset_type: "video".to_string(),
            file_size: None,
            duration_ms: None,
            width: None,
            height: None,
            frame_rate: None,
            video_codec: None,
            audio_codec: None,
            color_space: None,
            label_color: None,
            rating: None,
            flag: None,
            imported_at: "2026-07-13T00:00:00Z".to_string(),
            thumbnail_path: None,
            proxy_path: None,
        };

        upsert_asset_internal(&conn, &asset1).unwrap();
        upsert_asset_internal(&conn, &asset2).unwrap();

        add_tag_internal(&conn, "a1", "HDR", "auto").unwrap();
        // a2 没有 HDR 标签

        let query = MediaSearchQuery {
            project_path: "/test".to_string(),
            text: None,
            asset_types: None,
            tags: Some(vec!["HDR".to_string()]),
            min_width: None,
            max_width: None,
            min_height: None,
            max_height: None,
            min_duration_ms: None,
            max_duration_ms: None,
            min_rating: None,
            label_color: None,
            flag: None,
            sort_by: None,
            sort_desc: None,
            page: None,
            page_size: None,
        };

        let result = search_assets_internal(&conn, &query).unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.assets[0].id, "a1");
    }

    #[test]
    fn test_pagination() {
        let conn = setup_db();

        for i in 0..25 {
            let asset = MediaIndexAsset {
                id: format!("asset-{}", i),
                path: format!("/test/{}.mp4", i),
                name: format!("{}.mp4", i),
                asset_type: "video".to_string(),
                file_size: None,
                duration_ms: None,
                width: None,
                height: None,
                frame_rate: None,
                video_codec: None,
                audio_codec: None,
                color_space: None,
                label_color: None,
                rating: None,
                flag: None,
                imported_at: "2026-07-13T00:00:00Z".to_string(),
                thumbnail_path: None,
                proxy_path: None,
            };
            upsert_asset_internal(&conn, &asset).unwrap();
        }

        let query = MediaSearchQuery {
            project_path: "/test".to_string(),
            text: None,
            asset_types: None,
            tags: None,
            min_width: None,
            max_width: None,
            min_height: None,
            max_height: None,
            min_duration_ms: None,
            max_duration_ms: None,
            min_rating: None,
            label_color: None,
            flag: None,
            sort_by: None,
            sort_desc: None,
            page: Some(1),
            page_size: Some(10),
        };

        let result = search_assets_internal(&conn, &query).unwrap();
        assert_eq!(result.total, 25);
        assert_eq!(result.assets.len(), 10);
        assert_eq!(result.page, 1);
        assert_eq!(result.page_size, 10);

        let query2 = MediaSearchQuery {
            project_path: "/test".to_string(),
            text: None,
            asset_types: None,
            tags: None,
            min_width: None,
            max_width: None,
            min_height: None,
            max_height: None,
            min_duration_ms: None,
            max_duration_ms: None,
            min_rating: None,
            label_color: None,
            flag: None,
            sort_by: None,
            sort_desc: None,
            page: Some(3),
            page_size: Some(10),
        };

        let result2 = search_assets_internal(&conn, &query2).unwrap();
        assert_eq!(result2.total, 25);
        assert_eq!(result2.assets.len(), 5);
    }
}
