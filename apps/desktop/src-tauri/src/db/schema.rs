use rusqlite::Connection;

/// 当前 schema 版本号
pub const SCHEMA_VERSION: i32 = 1;

/// 执行数据库迁移
pub fn migrate(conn: &Connection) -> Result<(), String> {
    let current: i32 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|e| format!("无法读取 schema 版本: {}", e))?;

    if current < 1 {
        migrate_v1(conn)?;
    }

    Ok(())
}

/// V1: 创建媒体索引表结构
fn migrate_v1(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        -- 媒体资产索引表
        CREATE TABLE IF NOT EXISTS media_assets (
            id              TEXT PRIMARY KEY,
            path            TEXT NOT NULL UNIQUE,
            name            TEXT NOT NULL,
            asset_type      TEXT NOT NULL,
            file_size       INTEGER,
            duration_ms     INTEGER,
            width           INTEGER,
            height          INTEGER,
            frame_rate      REAL,
            video_codec     TEXT,
            audio_codec     TEXT,
            color_space     TEXT,
            label_color     TEXT,
            rating          INTEGER,
            flag            TEXT,
            imported_at     TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            thumbnail_path  TEXT,
            proxy_path      TEXT
        );

        -- 标签表
        CREATE TABLE IF NOT EXISTS tags (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        -- 资产-标签关联表
        CREATE TABLE IF NOT EXISTS asset_tags (
            asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
            tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            source   TEXT NOT NULL DEFAULT 'auto',
            PRIMARY KEY (asset_id, tag_id)
        );

        -- 全文搜索虚拟表
        CREATE VIRTUAL TABLE IF NOT EXISTS media_fts USING fts5(
            name, path,
            content=media_assets,
            content_rowid=rowid
        );

        -- 性能索引
        CREATE INDEX IF NOT EXISTS idx_media_type ON media_assets(asset_type);
        CREATE INDEX IF NOT EXISTS idx_media_resolution ON media_assets(width, height);
        CREATE INDEX IF NOT EXISTS idx_media_duration ON media_assets(duration_ms);
        CREATE INDEX IF NOT EXISTS idx_media_imported ON media_assets(imported_at);
        CREATE INDEX IF NOT EXISTS idx_media_rating ON media_assets(rating);
        CREATE INDEX IF NOT EXISTS idx_media_label ON media_assets(label_color);
        CREATE INDEX IF NOT EXISTS idx_asset_tags_asset ON asset_tags(asset_id);
        CREATE INDEX IF NOT EXISTS idx_asset_tags_tag ON asset_tags(tag_id);
        ",
    )
    .map_err(|e| format!("迁移 V1 失败: {}", e))?;

    conn.pragma_update(None, "user_version", SCHEMA_VERSION)
        .map_err(|e| format!("无法更新 schema 版本: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrate_v1_creates_tables() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();

        // 验证表存在
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='media_assets'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tags'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='asset_tags'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_migrate_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        // 迁移两次不应出错
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
    }
}
