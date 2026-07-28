use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db;

/// Video generation task persisted in SQLite.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoGenTaskDb {
    pub id: String,
    pub status: String,
    pub progress: f64,
    pub stage: String,
    pub input_path: Option<String>,
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub steps: i64,
    pub guidance_scale: f64,
    pub fps: i64,
    pub num_frames: i64,
    pub resolution: i64,
    pub output_dir: Option<String>,
    pub output_path: Option<String>,
    pub error_message: Option<String>,
    pub error_type: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub seq: u64,
}

/// Save (insert or replace) a video generation task.
#[tauri::command]
pub fn save_video_gen_task(app: AppHandle, task: VideoGenTaskDb) -> Result<(), String> {
    let conn = db::open_db(&app, "")?;
    conn.execute(
        "INSERT OR REPLACE INTO video_gen_tasks
         (id, status, progress, stage, input_path, prompt, negative_prompt,
          steps, guidance_scale, fps, num_frames, resolution,
          output_dir, output_path, error_message, error_type,
          created_at, started_at, completed_at, seq)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
        params![
            task.id,
            task.status,
            task.progress,
            task.stage,
            task.input_path,
            task.prompt,
            task.negative_prompt,
            task.steps,
            task.guidance_scale,
            task.fps,
            task.num_frames,
            task.resolution,
            task.output_dir,
            task.output_path,
            task.error_message,
            task.error_type,
            task.created_at,
            task.started_at,
            task.completed_at,
            task.seq,
        ],
    )
    .map_err(|e| format!("保存视频生成任务失败: {}", e))?;
    Ok(())
}

/// List video generation tasks, optionally filtered by status.
#[tauri::command]
pub fn list_video_gen_tasks(
    app: AppHandle,
    status_filter: Option<String>,
) -> Result<Vec<VideoGenTaskDb>, String> {
    let conn = db::open_db(&app, "")?;

    let (sql, param_values): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match &status_filter
    {
        Some(status) => (
            "SELECT id, status, progress, stage, input_path, prompt, negative_prompt,
                    steps, guidance_scale, fps, num_frames, resolution,
                    output_dir, output_path, error_message, error_type,
                    created_at, started_at, completed_at, seq
             FROM video_gen_tasks WHERE status = ?1 ORDER BY created_at ASC"
                .to_string(),
            vec![Box::new(status.clone())],
        ),
        None => (
            "SELECT id, status, progress, stage, input_path, prompt, negative_prompt,
                    steps, guidance_scale, fps, num_frames, resolution,
                    output_dir, output_path, error_message, error_type,
                    created_at, started_at, completed_at, seq
             FROM video_gen_tasks ORDER BY created_at ASC"
                .to_string(),
            vec![],
        ),
    };

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("准备查询失败: {}", e))?;

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let tasks = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(VideoGenTaskDb {
                id: row.get(0)?,
                status: row.get(1)?,
                progress: row.get(2)?,
                stage: row.get(3)?,
                input_path: row.get(4)?,
                prompt: row.get(5)?,
                negative_prompt: row.get(6)?,
                steps: row.get(7)?,
                guidance_scale: row.get(8)?,
                fps: row.get(9)?,
                num_frames: row.get(10)?,
                resolution: row.get(11)?,
                output_dir: row.get(12)?,
                output_path: row.get(13)?,
                error_message: row.get(14)?,
                error_type: row.get(15)?,
                created_at: row.get(16)?,
                started_at: row.get(17)?,
                completed_at: row.get(18)?,
                seq: row.get(19)?,
            })
        })
        .map_err(|e| format!("查询任务失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取任务失败: {}", e))?;

    Ok(tasks)
}

/// Update video generation task status — only non-null fields are written.
/// Uses seq (monotonically increasing sequence number) to prevent stale overwrites.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn update_video_gen_task_status(
    app: AppHandle,
    id: String,
    status: Option<String>,
    progress: Option<f64>,
    stage: Option<String>,
    output_path: Option<String>,
    error_message: Option<String>,
    error_type: Option<String>,
    started_at: Option<String>,
    completed_at: Option<String>,
    seq: u64,
) -> Result<(), String> {
    let conn = db::open_db(&app, "")?;

    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(v) = &status {
        sets.push(format!("status = ?{}", idx));
        values.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(v) = progress {
        sets.push(format!("progress = ?{}", idx));
        values.push(Box::new(v));
        idx += 1;
    }
    if let Some(v) = &stage {
        sets.push(format!("stage = ?{}", idx));
        values.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(v) = &output_path {
        sets.push(format!("output_path = ?{}", idx));
        values.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(v) = &error_message {
        sets.push(format!("error_message = ?{}", idx));
        values.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(v) = &error_type {
        sets.push(format!("error_type = ?{}", idx));
        values.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(v) = &started_at {
        sets.push(format!("started_at = ?{}", idx));
        values.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(v) = &completed_at {
        sets.push(format!("completed_at = ?{}", idx));
        values.push(Box::new(v.clone()));
        idx += 1;
    }

    if sets.is_empty() {
        return Ok(());
    }

    // Always update seq and use it as a guard condition
    sets.push(format!("seq = ?{}", idx));
    values.push(Box::new(seq));
    idx += 1;

    let sql = format!(
        "UPDATE video_gen_tasks SET {} WHERE id = ?{} AND seq < ?{}",
        sets.join(", "),
        idx,
        idx + 1,
    );
    values.push(Box::new(id));
    values.push(Box::new(seq));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("更新任务状态失败: {}", e))?;

    Ok(())
}

/// Delete a single video generation task.
#[tauri::command]
pub fn delete_video_gen_task(app: AppHandle, id: String) -> Result<(), String> {
    let conn = db::open_db(&app, "")?;
    conn.execute(
        "DELETE FROM video_gen_tasks WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("删除任务失败: {}", e))?;
    Ok(())
}

/// Cleanup completed/failed/canceled tasks, keeping the most recent N.
#[tauri::command]
pub fn cleanup_video_gen_tasks(
    app: AppHandle,
    keep_completed: Option<i32>,
) -> Result<(), String> {
    let conn = db::open_db(&app, "")?;
    let keep = keep_completed.unwrap_or(20);

    conn.execute(
        "DELETE FROM video_gen_tasks
         WHERE status IN ('completed', 'failed', 'canceled')
         AND id NOT IN (
             SELECT id FROM video_gen_tasks
             WHERE status IN ('completed', 'failed', 'canceled')
             ORDER BY created_at DESC
             LIMIT ?1
         )",
        params![keep],
    )
    .map_err(|e| format!("清理任务失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::schema::migrate(&conn).unwrap();
        conn
    }

    fn sample_task(id: &str) -> VideoGenTaskDb {
        VideoGenTaskDb {
            id: id.to_string(),
            status: "queued".to_string(),
            progress: 0.0,
            stage: "queued".to_string(),
            input_path: None,
            prompt: "test prompt".to_string(),
            negative_prompt: None,
            steps: 20,
            guidance_scale: 7.5,
            fps: 24,
            num_frames: 16,
            resolution: 512,
            output_dir: None,
            output_path: None,
            error_message: None,
            error_type: None,
            created_at: "2026-07-29T00:00:00Z".to_string(),
            started_at: None,
            completed_at: None,
            seq: 0,
        }
    }

    #[test]
    fn test_insert_and_query_task() {
        let conn = setup_db();
        let task = sample_task("task-1");

        conn.execute(
            "INSERT INTO video_gen_tasks
             (id, status, progress, stage, input_path, prompt, negative_prompt,
              steps, guidance_scale, fps, num_frames, resolution,
              output_dir, output_path, error_message, error_type,
              created_at, started_at, completed_at, seq)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
            params![
                task.id, task.status, task.progress, task.stage, task.input_path,
                task.prompt, task.negative_prompt, task.steps, task.guidance_scale,
                task.fps, task.num_frames, task.resolution, task.output_dir,
                task.output_path, task.error_message, task.error_type,
                task.created_at, task.started_at, task.completed_at, task.seq,
            ],
        )
        .unwrap();

        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM video_gen_tasks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_update_non_null_fields() {
        let conn = setup_db();
        let task = sample_task("task-2");

        conn.execute(
            "INSERT INTO video_gen_tasks
             (id, status, progress, stage, input_path, prompt, negative_prompt,
              steps, guidance_scale, fps, num_frames, resolution,
              output_dir, output_path, error_message, error_type,
              created_at, started_at, completed_at, seq)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
            params![
                task.id, task.status, task.progress, task.stage, task.input_path,
                task.prompt, task.negative_prompt, task.steps, task.guidance_scale,
                task.fps, task.num_frames, task.resolution, task.output_dir,
                task.output_path, task.error_message, task.error_type,
                task.created_at, task.started_at, task.completed_at, task.seq,
            ],
        )
        .unwrap();

        conn.execute(
            "UPDATE video_gen_tasks SET status = 'running', progress = 0.5, seq = 1 WHERE id = 'task-2' AND seq < 1",
            [],
        )
        .unwrap();

        let (status, progress): (String, f64) = conn
            .query_row(
                "SELECT status, progress FROM video_gen_tasks WHERE id = 'task-2'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(status, "running");
        assert!((progress - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn test_delete_task() {
        let conn = setup_db();
        conn.execute(
            "INSERT INTO video_gen_tasks (id, status, progress, stage, prompt, steps, guidance_scale, fps, num_frames, resolution, created_at, seq)
             VALUES ('del-1', 'queued', 0, 'queued', 'p', 20, 7.5, 24, 16, 512, '2026-07-29T00:00:00Z', 0)",
            [],
        )
        .unwrap();

        conn.execute("DELETE FROM video_gen_tasks WHERE id = 'del-1'", [])
            .unwrap();

        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM video_gen_tasks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_seq_prevents_stale_overwrite() {
        let conn = setup_db();
        conn.execute(
            "INSERT INTO video_gen_tasks (id, status, progress, stage, prompt, steps, guidance_scale, fps, num_frames, resolution, created_at, seq)
             VALUES ('race-1', 'queued', 0, 'queued', 'p', 20, 7.5, 24, 16, 512, '2026-07-29T00:00:00Z', 0)",
            [],
        )
        .unwrap();

        // Simulate: seq=3 update arrives first (newer)
        conn.execute(
            "UPDATE video_gen_tasks SET status = 'completed', progress = 1.0, seq = 3 WHERE id = 'race-1' AND seq < 3",
            [],
        )
        .unwrap();

        // Simulate: seq=1 update arrives later (stale) — should be rejected
        let rows_changed = conn.execute(
            "UPDATE video_gen_tasks SET status = 'running', progress = 0.5, seq = 1 WHERE id = 'race-1' AND seq < 1",
            [],
        )
        .unwrap();
        assert_eq!(rows_changed, 0, "stale update should be rejected");

        // Verify the newer value persists
        let (status, progress, seq): (String, f64, u64) = conn
            .query_row(
                "SELECT status, progress, seq FROM video_gen_tasks WHERE id = 'race-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(status, "completed");
        assert!((progress - 1.0).abs() < f64::EPSILON);
        assert_eq!(seq, 3);
    }
}
