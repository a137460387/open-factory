use keyring::{Entry, Error as KeyringError};

const TRANSLATION_KEYCHAIN_SERVICE: &str = "open-factory.translation";
const SMTP_KEYCHAIN_SERVICE: &str = "open-factory.smtp";

#[tauri::command]
pub fn read_translation_api_key(provider: String) -> Result<Option<String>, String> {
    let entry = translation_api_key_entry(&provider)?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Unable to read translation API key from system keychain: {}",
            error
        )),
    }
}

#[tauri::command]
pub fn write_translation_api_key(provider: String, key: Option<String>) -> Result<(), String> {
    let entry = translation_api_key_entry(&provider)?;
    match normalize_api_key(key) {
        Some(key) => entry.set_password(&key).map_err(|error| {
            format!(
                "Unable to write translation API key to system keychain: {}",
                error
            )
        }),
        None => match entry.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "Unable to remove translation API key from system keychain: {}",
                error
            )),
        },
    }
}

#[tauri::command]
pub fn read_smtp_password(profile: String) -> Result<Option<String>, String> {
    let entry = smtp_password_entry(&profile)?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Unable to read SMTP password from system keychain: {}",
            error
        )),
    }
}

#[tauri::command]
pub fn write_smtp_password(profile: String, password: Option<String>) -> Result<(), String> {
    let entry = smtp_password_entry(&profile)?;
    match normalize_api_key(password) {
        Some(password) => entry.set_password(&password).map_err(|error| {
            format!(
                "Unable to write SMTP password to system keychain: {}",
                error
            )
        }),
        None => match entry.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "Unable to remove SMTP password from system keychain: {}",
                error
            )),
        },
    }
}

fn translation_api_key_entry(provider: &str) -> Result<Entry, String> {
    let account = normalize_translation_provider(provider)?;
    Entry::new(TRANSLATION_KEYCHAIN_SERVICE, account).map_err(|error| {
        format!(
            "Unable to open translation API key entry in system keychain: {}",
            error
        )
    })
}

fn smtp_password_entry(profile: &str) -> Result<Entry, String> {
    let account = normalize_smtp_profile(profile);
    Entry::new(SMTP_KEYCHAIN_SERVICE, &account).map_err(|error| {
        format!(
            "Unable to open SMTP password entry in system keychain: {}",
            error
        )
    })
}

fn normalize_translation_provider(provider: &str) -> Result<&'static str, String> {
    match provider.trim().to_ascii_lowercase().as_str() {
        "deepl" => Ok("deepl"),
        "google" => Ok("google"),
        _ => Err("Unsupported translation provider.".to_string()),
    }
}

fn normalize_api_key(key: Option<String>) -> Option<String> {
    key.map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_smtp_profile(profile: &str) -> String {
    let normalized = profile
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if normalized.is_empty() {
        "default".to_string()
    } else {
        normalized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_supported_translation_providers() {
        assert_eq!(normalize_translation_provider("deepl").unwrap(), "deepl");
        assert_eq!(normalize_translation_provider(" DeepL ").unwrap(), "deepl");
        assert_eq!(normalize_translation_provider("GOOGLE").unwrap(), "google");
    }

    #[test]
    fn rejects_unknown_translation_provider() {
        let error = normalize_translation_provider("custom").unwrap_err();

        assert!(error.contains("Unsupported translation provider"));
    }

    #[test]
    fn normalizes_empty_api_keys_to_delete() {
        assert_eq!(normalize_api_key(None), None);
        assert_eq!(normalize_api_key(Some(" ".to_string())), None);
        assert_eq!(
            normalize_api_key(Some("  secret-key  ".to_string())),
            Some("secret-key".to_string())
        );
    }

    #[test]
    fn normalizes_smtp_keychain_profiles() {
        assert_eq!(normalize_smtp_profile(" Default "), "default");
        assert_eq!(normalize_smtp_profile("Team SMTP/Profile"), "team-smtp-profile");
        assert_eq!(normalize_smtp_profile(" "), "default");
    }
}
