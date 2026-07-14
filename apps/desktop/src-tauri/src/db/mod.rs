pub mod schema;

use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 获取媒体索引数据库路径
fn db_path(app: &AppHandle, project_path: &str) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    let media_dir = data_dir.join("media-index");
    fs::create_dir_all(&media_dir).map_err(|e| format!("无法创建索引目录: {}", e))?;

    // 使用项目路径的哈希作为数据库文件名，避免路径冲突
    let hash = simple_hash(project_path);
    let db_file = media_dir.join(format!("{}.db", hash));
    Ok(db_file)
}

/// 简单字符串哈希（用于文件名）
fn simple_hash(s: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// 打开并迁移数据库
pub fn open_db(app: &AppHandle, project_path: &str) -> Result<Connection, String> {
    let path = db_path(app, project_path)?;
    let conn = Connection::open(&path).map_err(|e| format!("无法打开数据库: {}", e))?;

    // 启用 WAL 模式提高并发性能
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("无法设置 WAL 模式: {}", e))?;

    // 启用外键约束
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| format!("无法启用外键约束: {}", e))?;

    // 执行迁移
    schema::migrate(&conn)?;

    Ok(conn)
}

/// 数据库连接包装
pub struct DbPool {}

impl DbPool {
    pub fn new() -> Self {
        Self {}
    }

    /// 获取或创建数据库连接
    pub fn get_or_open(&self, app: &AppHandle, project_path: &str) -> Result<Connection, String> {
        open_db(app, project_path)
    }

    /// 关闭连接（no-op，连接在 Connection drop 时自动关闭）
    pub fn close(&self) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_hash_consistency() {
        let h1 = simple_hash("/test/project.ofp");
        let h2 = simple_hash("/test/project.ofp");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_simple_hash_different_inputs() {
        let h1 = simple_hash("/project/a.ofp");
        let h2 = simple_hash("/project/b.ofp");
        assert_ne!(h1, h2);
    }
}
