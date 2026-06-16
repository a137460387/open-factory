use crate::path_validator::{validate_path, validate_path_for_write};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::Instant;
use tauri::AppHandle;
use zip::write::SimpleFileOptions;

const SHARED_LIBRARY_MANIFEST: &str = "library.json";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedLibraryArchiveRequest {
    output_path: String,
    manifest_contents: String,
    #[serde(default)]
    files: Vec<SharedLibraryArchiveFileEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedLibraryArchiveFileEntry {
    source_path: String,
    archive_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedLibraryArchiveResult {
    output_path: String,
    file_count: usize,
    duration_ms: u128,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedLibraryImportRequest {
    archive_path: String,
    destination_dir: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedLibraryImportResult {
    destination_dir: String,
    file_count: usize,
    manifest_contents: String,
}

#[derive(Debug, Clone)]
struct ResolvedArchiveRequest {
    output_path: PathBuf,
    manifest_contents: String,
    files: Vec<ResolvedArchiveFile>,
}

#[derive(Debug, Clone)]
struct ResolvedArchiveFile {
    source_path: PathBuf,
    archive_path: String,
}

#[tauri::command]
pub async fn create_shared_library_archive(
    app: AppHandle,
    request: SharedLibraryArchiveRequest,
) -> Result<SharedLibraryArchiveResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let resolved = resolve_archive_request(&app, request)?;
        write_shared_library_archive(resolved)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn import_shared_library_archive(
    app: AppHandle,
    request: SharedLibraryImportRequest,
) -> Result<SharedLibraryImportResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let archive_path = validate_path(&app, Path::new(&request.archive_path))?;
        let destination_dir = validate_path_for_write(&app, Path::new(&request.destination_dir))?;
        import_shared_library_archive_blocking(&archive_path, &destination_dir)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn resolve_archive_request(
    app: &AppHandle,
    request: SharedLibraryArchiveRequest,
) -> Result<ResolvedArchiveRequest, String> {
    let output_path = validate_path_for_write(app, Path::new(&request.output_path))?;
    let files = request
        .files
        .into_iter()
        .map(|entry| {
            Ok(ResolvedArchiveFile {
                source_path: validate_path(app, Path::new(&entry.source_path))?,
                archive_path: normalize_archive_path(&entry.archive_path)?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(ResolvedArchiveRequest {
        output_path,
        manifest_contents: request.manifest_contents,
        files,
    })
}

fn write_shared_library_archive(
    request: ResolvedArchiveRequest,
) -> Result<SharedLibraryArchiveResult, String> {
    let started = Instant::now();
    if let Some(parent) = request
        .output_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let file = File::create(&request.output_path).map_err(|error| {
        format!(
            "Unable to create shared library archive {}: {}",
            normalize_path(&request.output_path),
            error
        )
    })?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    let mut used_paths = HashSet::new();
    write_text_entry(
        &mut zip,
        options,
        SHARED_LIBRARY_MANIFEST,
        &request.manifest_contents,
        &mut used_paths,
    )?;
    for entry in &request.files {
        write_file_entry(&mut zip, options, entry, &mut used_paths)?;
    }
    zip.finish().map_err(|error| error.to_string())?;
    Ok(SharedLibraryArchiveResult {
        output_path: normalize_path(&request.output_path),
        file_count: request.files.len() + 1,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn import_shared_library_archive_blocking(
    archive_path: &Path,
    destination_dir: &Path,
) -> Result<SharedLibraryImportResult, String> {
    fs::create_dir_all(destination_dir).map_err(|error| error.to_string())?;
    let file = File::open(archive_path).map_err(|error| {
        format!(
            "Unable to open shared library archive {}: {}",
            normalize_path(archive_path),
            error
        )
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut manifest_contents = String::new();
    let mut file_count = 0usize;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let name = normalize_archive_path(entry.name())?;
        if entry.is_dir() {
            continue;
        }
        if name == SHARED_LIBRARY_MANIFEST {
            entry
                .read_to_string(&mut manifest_contents)
                .map_err(|error| error.to_string())?;
            file_count += 1;
            continue;
        }
        let output_path = destination_dir.join(&name);
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut output = File::create(&output_path).map_err(|error| {
            format!(
                "Unable to extract shared library file {}: {}",
                normalize_path(&output_path),
                error
            )
        })?;
        std::io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
        file_count += 1;
    }
    if manifest_contents.trim().is_empty() {
        return Err("Shared library archive is missing library.json.".to_string());
    }
    Ok(SharedLibraryImportResult {
        destination_dir: normalize_path(destination_dir),
        file_count,
        manifest_contents,
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
    entry: &ResolvedArchiveFile,
    used_paths: &mut HashSet<String>,
) -> Result<(), String> {
    reserve_archive_path(&entry.archive_path, used_paths)?;
    let source = File::open(&entry.source_path).map_err(|error| {
        format!(
            "Unable to open shared library source {}: {}",
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
        Err(format!("Duplicate shared library archive path: {}", path))
    }
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
        return Err("Invalid shared library archive path.".to_string());
    }
    let path = Path::new(&normalized);
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => {
                let part = part.to_string_lossy();
                if part.is_empty() {
                    return Err("Invalid shared library archive path.".to_string());
                }
                parts.push(part.to_string());
            }
            Component::CurDir => {}
            _ => return Err("Invalid shared library archive path.".to_string()),
        }
    }
    if parts.is_empty() {
        return Err("Invalid shared library archive path.".to_string());
    }
    Ok(parts.join("/"))
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn writes_and_imports_shared_library_archive() {
        let dir = make_temp_dir();
        let lut_path = dir.join("look.cube");
        let archive_path = dir.join("library.oflibrary.zip");
        let import_dir = dir.join("imported");
        fs::write(&lut_path, b"LUT_3D_SIZE 2").unwrap();

        let result = write_shared_library_archive(ResolvedArchiveRequest {
            output_path: archive_path.clone(),
            manifest_contents: "{\"schemaVersion\":1,\"resources\":[]}".to_string(),
            files: vec![ResolvedArchiveFile {
                source_path: lut_path,
                archive_path: "files/look.cube".to_string(),
            }],
        })
        .unwrap();

        assert_eq!(result.file_count, 2);
        let imported = import_shared_library_archive_blocking(&archive_path, &import_dir).unwrap();
        assert_eq!(
            imported.manifest_contents,
            "{\"schemaVersion\":1,\"resources\":[]}"
        );
        assert_eq!(imported.file_count, 2);
        assert_eq!(
            fs::read_to_string(import_dir.join("files").join("look.cube")).unwrap(),
            "LUT_3D_SIZE 2"
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_unsafe_archive_paths() {
        assert!(normalize_archive_path("../library.json").is_err());
        assert!(normalize_archive_path("C:/library.json").is_err());
        assert!(normalize_archive_path("/library.json").is_err());
    }

    fn make_temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "open-factory-shared-library-test-{}-{}",
            std::process::id(),
            TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
}
