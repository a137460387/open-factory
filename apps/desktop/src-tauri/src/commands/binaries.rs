use std::env;
use std::path::PathBuf;

pub(crate) fn ffmpeg_binary() -> PathBuf {
    resolve_tool_binary("ffmpeg")
}

pub(crate) fn ffprobe_binary() -> PathBuf {
    resolve_tool_binary("ffprobe")
}

fn resolve_tool_binary(stem: &str) -> PathBuf {
    let file_name = tool_file_name(stem);
    let mut search_dirs = Vec::new();
    if let Ok(exe_path) = env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            search_dirs.push(parent.to_path_buf());
        }
    }
    if let Ok(current_dir) = env::current_dir() {
        search_dirs.push(current_dir);
    }
    resolve_tool_binary_from_dirs(&file_name, &search_dirs)
}

fn resolve_tool_binary_from_dirs(file_name: &str, search_dirs: &[PathBuf]) -> PathBuf {
    search_dirs
        .iter()
        .map(|dir| dir.join(file_name))
        .find(|candidate| candidate.is_file())
        .unwrap_or_else(|| PathBuf::from(file_name))
}

fn tool_file_name(stem: &str) -> String {
    if cfg!(windows) && !stem.ends_with(".exe") {
        format!("{stem}.exe")
    } else {
        stem.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn resolves_tool_from_first_directory_that_contains_it() {
        let root = unique_temp_dir("first-directory");
        let missing = root.join("missing");
        let found = root.join("found");
        fs::create_dir_all(&missing).expect("create missing dir");
        fs::create_dir_all(&found).expect("create found dir");
        let binary_name = tool_file_name("ffprobe");
        let binary_path = found.join(&binary_name);
        fs::write(&binary_path, b"fake").expect("write fake binary");

        assert_eq!(
            resolve_tool_binary_from_dirs(&binary_name, &[missing, found]),
            binary_path
        );

        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn falls_back_to_binary_name_when_no_local_candidate_exists() {
        let root = unique_temp_dir("fallback");
        let binary_name = tool_file_name("ffmpeg");

        assert_eq!(
            resolve_tool_binary_from_dirs(&binary_name, &[root.clone()]),
            PathBuf::from(binary_name)
        );

        fs::remove_dir_all(root).ok();
    }

    fn unique_temp_dir(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = env::temp_dir().join(format!(
            "open-factory-binaries-{name}-{}-{stamp}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }
}
