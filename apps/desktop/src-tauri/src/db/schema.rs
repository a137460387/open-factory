use rusqlite::Connection;

/// 当前 schema 版本号
pub const SCHEMA_VERSION: i32 = 3;

/// 执行数据库迁移
pub fn migrate(conn: &Connection) -> Result<(), String> {
    let current: i32 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|e| format!("无法读取 schema 版本: {}", e))?;

    if current < 1 {
        migrate_v1(conn)?;
    }
    if current < 2 {
        migrate_v2(conn)?;
    }
    if current < 3 {
        migrate_v3(conn)?;
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

/// V2: 创建视频生成任务持久化表
fn migrate_v2(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS video_gen_tasks (
            id              TEXT PRIMARY KEY,
            status          TEXT NOT NULL DEFAULT 'queued',
            progress        REAL NOT NULL DEFAULT 0.0,
            stage           TEXT NOT NULL DEFAULT 'queued',
            input_path      TEXT,
            prompt          TEXT NOT NULL,
            negative_prompt TEXT,
            steps           INTEGER NOT NULL,
            guidance_scale  REAL NOT NULL,
            fps             INTEGER NOT NULL,
            num_frames      INTEGER NOT NULL,
            resolution      INTEGER NOT NULL,
            output_dir      TEXT,
            output_path     TEXT,
            error_message   TEXT,
            error_type      TEXT,
            created_at      TEXT NOT NULL,
            started_at      TEXT,
            completed_at    TEXT,
            seq             INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_video_gen_tasks_status ON video_gen_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_video_gen_tasks_created ON video_gen_tasks(created_at DESC);
        ",
    )
    .map_err(|e| format!("迁移 V2 失败: {}", e))?;

    conn.pragma_update(None, "user_version", 2)
        .map_err(|e| format!("无法更新 schema 版本: {}", e))?;

    Ok(())
}

/// V3: 为 video_gen_tasks 添加 seq 字段（乐观锁防竞态写入）
fn migrate_v3(conn: &Connection) -> Result<(), String> {
    // Check if seq column already exists (from fresh v2 install with updated schema)
    let has_seq: bool = conn
        .prepare("PRAGMA table_info(video_gen_tasks)")
        .map_err(|e| format!("检查 video_gen_tasks 表结构失败: {}", e))?
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("查询列名失败: {}", e))?
        .filter_map(|r| r.ok())
        .any(|name| name == "seq");

    if !has_seq {
        conn.execute_batch(
            "ALTER TABLE video_gen_tasks ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;",
        )
        .map_err(|e| format!("迁移 V3 失败: {}", e))?;
    }

    conn.pragma_update(None, "user_version", 3)
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

    #[test]
    fn test_migrate_v2_creates_video_gen_tasks_table() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='video_gen_tasks'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // Verify indexes exist
        let idx_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN ('idx_video_gen_tasks_status', 'idx_video_gen_tasks_created')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(idx_count, 2);
    }

    #[test]
    fn test_migrate_v3_adds_seq_column() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();

        // Verify seq column exists
        let has_seq: bool = conn
            .prepare("PRAGMA table_info(video_gen_tasks)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .any(|name| name == "seq");
        assert!(has_seq, "seq column should exist after v3 migration");
    }
}
