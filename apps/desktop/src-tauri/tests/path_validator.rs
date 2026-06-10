use open_factory_desktop_lib::path_validator::{PathValidator, PATH_NOT_ALLOWED};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn allows_path_inside_allowlist() {
    let root = test_root("allows-path");
    let allowed = root.join("allowed");
    fs::create_dir_all(&allowed).expect("create allowed dir");
    let file = allowed.join("media.wav");
    fs::write(&file, b"audio").expect("write file");
    let mut validator = PathValidator::default();
    validator
        .allow_existing_path(&allowed)
        .expect("allow directory");

    let resolved = validator.validate_path(&file).expect("validate file");

    assert_eq!(resolved, file.canonicalize().expect("canonical file"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn rejects_absolute_path_outside_allowlist() {
    let root = test_root("rejects-outside");
    let allowed = root.join("allowed");
    let outside = root.join("outside");
    fs::create_dir_all(&allowed).expect("create allowed dir");
    fs::create_dir_all(&outside).expect("create outside dir");
    let file = outside.join("secret.txt");
    fs::write(&file, b"secret").expect("write file");
    let mut validator = PathValidator::default();
    validator
        .allow_existing_path(&allowed)
        .expect("allow directory");

    assert_eq!(
        validator.validate_path(&file),
        Err(PATH_NOT_ALLOWED.to_string())
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn rejects_parent_directory_traversal() {
    let root = test_root("rejects-parent-dir");
    let allowed = root.join("allowed");
    let outside = root.join("outside");
    fs::create_dir_all(&allowed).expect("create allowed dir");
    fs::create_dir_all(&outside).expect("create outside dir");
    let file = outside.join("secret.txt");
    fs::write(&file, b"secret").expect("write file");
    let mut validator = PathValidator::default();
    validator
        .allow_existing_path(&allowed)
        .expect("allow directory");
    let traversal = allowed.join("..").join("outside").join("secret.txt");

    assert_eq!(
        validator.validate_path(&traversal),
        Err(PATH_NOT_ALLOWED.to_string())
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn rejects_symlink_that_escapes_allowlist() {
    let root = test_root("rejects-symlink");
    let allowed = root.join("allowed");
    let outside = root.join("outside");
    fs::create_dir_all(&allowed).expect("create allowed dir");
    fs::create_dir_all(&outside).expect("create outside dir");
    let outside_file = outside.join("secret.txt");
    fs::write(&outside_file, b"secret").expect("write file");
    let symlink_path = allowed.join("linked-secret.txt");
    if create_file_symlink(&outside_file, &symlink_path).is_err() {
        eprintln!("skipping symlink escape assertion because the OS denied symlink creation");
        let _ = fs::remove_dir_all(root);
        return;
    }
    let mut validator = PathValidator::default();
    validator
        .allow_existing_path(&allowed)
        .expect("allow directory");

    assert_eq!(
        validator.validate_path(&symlink_path),
        Err(PATH_NOT_ALLOWED.to_string())
    );
    let _ = fs::remove_dir_all(root);
}

fn test_root(name: &str) -> PathBuf {
    let id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir().join(format!("open-factory-{name}-{id}"))
}

#[cfg(unix)]
fn create_file_symlink(target: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(target, link)
}

#[cfg(windows)]
fn create_file_symlink(target: &Path, link: &Path) -> std::io::Result<()> {
    std::os::windows::fs::symlink_file(target, link)
}
