use crate::path_validator::{validate_path, validate_path_for_write};
use aes_gcm::aead::{Aead, OsRng};
use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use tauri::AppHandle;

const MAGIC: &[u8; 9] = b"OFCUTENC1";
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_DERIVE_ROUNDS: usize = 120_000;
const PASSWORD_ERROR: &str = "密码错误";

#[tauri::command]
pub fn encrypt_project_file(
    app: AppHandle,
    path: String,
    contents: String,
    password: String,
) -> Result<(), String> {
    let safe_path = validate_path_for_write(&app, Path::new(&path))?;
    let encrypted = encrypt_project_contents(contents.as_bytes(), &password)?;
    if let Some(parent) = safe_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
    }
    fs::write(&safe_path, encrypted).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn decrypt_project_file(app: AppHandle, path: String, password: String) -> Result<String, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    let bytes = fs::read(&safe_path).map_err(|error| error.to_string())?;
    let plaintext = decrypt_project_contents(&bytes, &password)?;
    String::from_utf8(plaintext).map_err(|_| "Encrypted project is not valid UTF-8".to_string())
}

#[tauri::command]
pub fn is_encrypted_project_file(app: AppHandle, path: String) -> Result<bool, String> {
    let safe_path = validate_path(&app, Path::new(&path))?;
    let bytes = fs::read(&safe_path).map_err(|error| error.to_string())?;
    Ok(is_encrypted_project_bytes(&bytes))
}

pub fn encrypt_project_contents(contents: &[u8], password: &str) -> Result<Vec<u8>, String> {
    let password = normalize_password(password)?;
    let mut salt = [0_u8; SALT_LEN];
    let mut nonce_bytes = [0_u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);
    let key = derive_key(password.as_bytes(), &salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|error| error.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), contents)
        .map_err(|error| error.to_string())?;
    let mut output = Vec::with_capacity(MAGIC.len() + SALT_LEN + NONCE_LEN + ciphertext.len());
    output.extend_from_slice(MAGIC);
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

pub fn decrypt_project_contents(contents: &[u8], password: &str) -> Result<Vec<u8>, String> {
    let password = normalize_password(password)?;
    let header_len = MAGIC.len() + SALT_LEN + NONCE_LEN;
    if contents.len() <= header_len || !is_encrypted_project_bytes(contents) {
        return Err("Encrypted project format is invalid".to_string());
    }
    let salt_start = MAGIC.len();
    let nonce_start = salt_start + SALT_LEN;
    let ciphertext_start = nonce_start + NONCE_LEN;
    let salt = &contents[salt_start..nonce_start];
    let nonce = &contents[nonce_start..ciphertext_start];
    let ciphertext = &contents[ciphertext_start..];
    let key = derive_key(password.as_bytes(), salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|error| error.to_string())?;
    cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| PASSWORD_ERROR.to_string())
}

pub fn is_encrypted_project_bytes(contents: &[u8]) -> bool {
    contents.starts_with(MAGIC)
}

fn normalize_password(password: &str) -> Result<&str, String> {
    let trimmed = password.trim();
    if trimmed.is_empty() {
        return Err("Project encryption password is required".to_string());
    }
    Ok(trimmed)
}

fn derive_key(password: &[u8], salt: &[u8]) -> [u8; 32] {
    let mut digest = Sha256::new();
    digest.update(salt);
    digest.update(password);
    let mut key = digest.finalize().to_vec();
    for _ in 0..KEY_DERIVE_ROUNDS {
        let mut round = Sha256::new();
        round.update(&key);
        round.update(salt);
        round.update(password);
        key = round.finalize().to_vec();
    }
    let mut output = [0_u8; 32];
    output.copy_from_slice(&key[..32]);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypts_and_decrypts_project_contents_with_aes_gcm() {
        let encrypted = encrypt_project_contents(br#"{"schemaVersion":2}"#, "correct horse").unwrap();
        let decrypted = decrypt_project_contents(&encrypted, "correct horse").unwrap();
        assert_eq!(decrypted, br#"{"schemaVersion":2}"#);
    }

    #[test]
    fn wrong_password_returns_password_error() {
        let encrypted = encrypt_project_contents(b"project", "right").unwrap();
        let error = decrypt_project_contents(&encrypted, "wrong").unwrap_err();
        assert_eq!(error, PASSWORD_ERROR);
    }

    #[test]
    fn encrypted_format_contains_magic_salt_nonce_and_ciphertext() {
        let encrypted = encrypt_project_contents(b"project", "secret").unwrap();
        assert!(is_encrypted_project_bytes(&encrypted));
        assert!(encrypted.starts_with(MAGIC));
        assert!(encrypted.len() > MAGIC.len() + SALT_LEN + NONCE_LEN);
        assert_eq!(&encrypted[..MAGIC.len()], MAGIC);
    }
}
