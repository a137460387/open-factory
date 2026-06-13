use crate::path_validator::{validate_path, validate_path_for_write};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{BufReader, Write};
use std::path::{Component, Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use zip::write::SimpleFileOptions;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharePackageRequest {
    output_path: String,
    project_file_name: String,
    project_contents: String,
    readme_contents: String,
    exported_video: SharePackageFileEntry,
    #[serde(default)]
    media_files: Vec<SharePackageFileEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharePackageFileEntry {
    source_path: String,
    archive_path: String,
}

#[derive(Debug, Clone)]
struct ResolvedSharePackage {
    output_path: PathBuf,
    project_file_name: String,
    project_contents: String,
    readme_contents: String,
    exported_video: ResolvedFileEntry,
    media_files: Vec<ResolvedFileEntry>,
}

#[derive(Debug, Clone)]
struct ResolvedFileEntry {
    source_path: PathBuf,
    archive_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharePackageResult {
    output_path: String,
    file_count: usize,
    duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SharePackageProgressPayload {
    stage: String,
    progress: f32,
    progress_pct: f32,
    current: usize,
    total: usize,
    output_path: String,
}

#[tauri::command]
pub async fn create_share_package(
    app: AppHandle,
    request: SharePackageRequest,
) -> Result<SharePackageResult, String> {
    tauri::async_runtime::spawn_blocking(move || create_share_package_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

fn create_share_package_blocking(
    app: AppHandle,
    request: SharePackageRequest,
) -> Result<SharePackageResult, String> {
    let package = resolve_share_package_request(&app, request)?;
    write_share_package_zip(package, |progress| {
        let _ = app.emit("share-package-progress", progress);
    })
}

fn resolve_share_package_request(
    app: &AppHandle,
    request: SharePackageRequest,
) -> Result<ResolvedSharePackage, String> {
    let output_path = validate_path_for_write(app, Path::new(&request.output_path))?;
    let project_file_name = normalize_archive_path(&request.project_file_name)?;
    let exported_video = resolve_file_entry(app, request.exported_video)?;
    let media_files = request
        .media_files
        .into_iter()
        .map(|entry| resolve_file_entry(app, entry))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ResolvedSharePackage {
        output_path,
        project_file_name,
        project_contents: request.project_contents,
        readme_contents: request.readme_contents,
        exported_video,
        media_files,
    })
}

fn resolve_file_entry(
    app: &AppHandle,
    entry: SharePackageFileEntry,
) -> Result<ResolvedFileEntry, String> {
    Ok(ResolvedFileEntry {
        source_path: validate_path(app, Path::new(&entry.source_path))?,
        archive_path: normalize_archive_path(&entry.archive_path)?,
    })
}

fn write_share_package_zip<F>(
    package: ResolvedSharePackage,
    mut emit_progress: F,
) -> Result<SharePackageResult, String>
where
    F: FnMut(SharePackageProgressPayload),
{
    let started = Instant::now();
    if let Some(parent) = package
        .output_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let file = File::create(&package.output_path).map_err(|error| {
        format!(
            "Unable to create share package {}: {}",
            normalize_path(&package.output_path),
            error
        )
    })?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    let output = normalize_path(&package.output_path);
    let total = package.media_files.len() + 3;
    let mut current = 0usize;
    let mut used_paths = HashSet::new();

    write_text_entry(
        &mut zip,
        options,
        "README.txt",
        &package.readme_contents,
        &mut used_paths,
    )?;
    current += 1;
    emit_share_progress(&mut emit_progress, "readme", current, total, &output);

    write_text_entry(
        &mut zip,
        options,
        &package.project_file_name,
        &package.project_contents,
        &mut used_paths,
    )?;
    current += 1;
    emit_share_progress(&mut emit_progress, "project", current, total, &output);

    write_file_entry(&mut zip, options, &package.exported_video, &mut used_paths)?;
    current += 1;
    emit_share_progress(&mut emit_progress, "export", current, total, &output);

    for entry in &package.media_files {
        write_file_entry(&mut zip, options, entry, &mut used_paths)?;
        current += 1;
        emit_share_progress(&mut emit_progress, "media", current, total, &output);
    }

    zip.finish().map_err(|error| error.to_string())?;
    emit_share_progress(&mut emit_progress, "finished", total, total, &output);
    Ok(SharePackageResult {
        output_path: output,
        file_count: total,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn write_text_entry(
    zip: &mut zip::ZipWriter<File>,
    options: SimpleFileOptions,
    archive_path: &str,
    contents: &str,
    used_paths: &mut HashSet<String>,
) -> Result<(), String> {
    let archive_path = normalize_archive_path(archive_path)?;
    reserve_archive_path(&archive_path, used_paths)?;
    zip.start_file(&archive_path, options)
        .map_err(|error| error.to_string())?;
    zip.write_all(contents.as_bytes())
        .map_err(|error| error.to_string())
}

fn write_file_entry(
    zip: &mut zip::ZipWriter<File>,
    options: SimpleFileOptions,
    entry: &ResolvedFileEntry,
    used_paths: &mut HashSet<String>,
) -> Result<(), String> {
    reserve_archive_path(&entry.archive_path, used_paths)?;
    let source = File::open(&entry.source_path).map_err(|error| {
        format!(
            "Unable to open share package source {}: {}",
            normalize_path(&entry.source_path),
            error
        )
    })?;
    zip.start_file(&entry.archive_path, options)
        .map_err(|error| error.to_string())?;
    std::io::copy(&mut BufReader::new(source), zip).map_err(|error| error.to_string())?;
    Ok(())
}

fn reserve_archive_path(path: &str, used_paths: &mut HashSet<String>) -> Result<(), String> {
    if used_paths.insert(path.to_lowercase()) {
        Ok(())
    } else {
        Err(format!("Duplicate share package path: {}", path))
    }
}

fn emit_share_progress<F>(
    emit_progress: &mut F,
    stage: &str,
    current: usize,
    total: usize,
    output_path: &str,
) where
    F: FnMut(SharePackageProgressPayload),
{
    let progress = if total == 0 {
        1.0
    } else {
        (current as f32 / total as f32).clamp(0.0, 1.0)
    };
    emit_progress(SharePackageProgressPayload {
        stage: stage.to_string(),
        progress,
        progress_pct: progress * 100.0,
        current,
        total,
        output_path: output_path.to_string(),
    });
}

fn normalize_archive_path(path: &str) -> Result<String, String> {
    let normalized = path.trim().replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.starts_with("//")
        || normalized
            .as_bytes()
            .get(1)
            .is_some_and(|value| *value == b':')
        || normalized.contains('\0')
    {
        return Err("Invalid share package archive path.".to_string());
    }
    let path = Path::new(&normalized);
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => {
                let part = part.to_string_lossy();
                if part.is_empty() {
                    return Err("Invalid share package archive path.".to_string());
                }
                parts.push(part.to_string());
            }
            Component::CurDir => {}
            _ => return Err("Invalid share package archive path.".to_string()),
        }
    }
    if parts.is_empty() {
        return Err("Invalid share package archive path.".to_string());
    }
    Ok(parts.join("/"))
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn writes_zip_with_readme_project_export_and_media_entries() {
        let dir = make_temp_dir();
        let media_path = dir.join("clip.mp4");
        let export_path = dir.join("render.mp4");
        let output_path = dir.join("share.zip");
        fs::write(&media_path, b"source-media").unwrap();
        fs::write(&export_path, b"exported-video").unwrap();
        let mut progress = Vec::new();

        let result = write_share_package_zip(
            ResolvedSharePackage {
                output_path: output_path.clone(),
                project_file_name: "Demo.cutproj.json".to_string(),
                project_contents: "{\"project\":{\"media\":[]}}".to_string(),
                readme_contents: "Open Demo.cutproj.json".to_string(),
                exported_video: ResolvedFileEntry {
                    source_path: export_path,
                    archive_path: "export/Demo.mp4".to_string(),
                },
                media_files: vec![ResolvedFileEntry {
                    source_path: media_path,
                    archive_path: "media/clip.mp4".to_string(),
                }],
            },
            |payload| progress.push(payload),
        )
        .unwrap();

        let mut archive = zip::ZipArchive::new(File::open(&output_path).unwrap()).unwrap();
        let names = (0..archive.len())
            .map(|index| archive.by_index(index).unwrap().name().to_string())
            .collect::<Vec<_>>();
        assert_eq!(
            names,
            vec![
                "README.txt",
                "Demo.cutproj.json",
                "export/Demo.mp4",
                "media/clip.mp4"
            ]
        );
        assert_eq!(
            read_zip_text(&mut archive, "README.txt"),
            "Open Demo.cutproj.json"
        );
        assert_eq!(
            read_zip_text(&mut archive, "Demo.cutproj.json"),
            "{\"project\":{\"media\":[]}}"
        );
        assert_eq!(
            read_zip_text(&mut archive, "export/Demo.mp4"),
            "exported-video"
        );
        assert_eq!(
            read_zip_text(&mut archive, "media/clip.mp4"),
            "source-media"
        );
        assert_eq!(result.file_count, 4);
        assert_eq!(progress.last().unwrap().stage, "finished");
        assert_eq!(progress.last().unwrap().progress, 1.0);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_archive_paths_with_parent_traversal() {
        assert!(normalize_archive_path("../media/clip.mp4").is_err());
        assert!(normalize_archive_path("media/../clip.mp4").is_err());
    }

    #[test]
    fn rejects_archive_paths_with_absolute_roots() {
        assert!(normalize_archive_path("/media/clip.mp4").is_err());
        assert!(normalize_archive_path("C:/media/clip.mp4").is_err());
        assert!(normalize_archive_path("//server/share/clip.mp4").is_err());
    }

    fn read_zip_text(archive: &mut zip::ZipArchive<File>, name: &str) -> String {
        let mut file = archive.by_name(name).unwrap();
        let mut contents = String::new();
        file.read_to_string(&mut contents).unwrap();
        contents
    }

    fn make_temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "open-factory-share-test-{}-{}",
            std::process::id(),
            TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
}
