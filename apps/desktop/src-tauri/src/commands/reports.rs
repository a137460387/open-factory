use crate::path_validator::validate_path_for_write;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

#[tauri::command]
pub fn write_clip_report(app: AppHandle, path: String, html: String) -> Result<(), String> {
    let safe_path = validate_path_for_write(&app, Path::new(&path))?;
    write_clip_report_file(&safe_path, &html)
}

pub fn write_clip_report_file(path: &Path, html: &str) -> Result<(), String> {
    validate_clip_report_path(path)?;
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
    }
    fs::write(path, html).map_err(|error| {
        format!(
            "Unable to write clip report {}: {}",
            normalize_path(path),
            error
        )
    })
}

fn validate_clip_report_path(path: &Path) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension == "html" || extension == "htm" {
        Ok(())
    } else {
        Err("clip_report_must_be_html".to_string())
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_clip_report_html_file() {
        let root = unique_temp_dir("clip-report-write");
        let path = root.join("nested").join("report.html");

        write_clip_report_file(&path, "<!doctype html><h1>Clip</h1>").expect("report should write");

        let contents = fs::read_to_string(&path).expect("report should exist");
        assert!(contents.contains("<h1>Clip</h1>"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_non_html_clip_report_paths() {
        let root = unique_temp_dir("clip-report-reject");
        let path = root.join("report.txt");

        let error =
            write_clip_report_file(&path, "<h1>Clip</h1>").expect_err("txt should be rejected");

        assert_eq!(error, "clip_report_must_be_html");
        assert!(!path.exists());
        let _ = fs::remove_dir_all(root);
    }

    fn unique_temp_dir(name: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        std::env::temp_dir().join(format!("open-factory-{name}-{nanos}"))
    }
}
