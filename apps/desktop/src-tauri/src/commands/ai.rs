use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use base64::Engine;
use std::collections::HashMap;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;

use crate::path_validator::validate_path;
use super::binaries::ffmpeg_binary;

const AI_KEYCHAIN_SERVICE: &str = "open-factory.ai";

#[derive(Debug, Serialize, Deserialize)]
pub struct CallAiApiRequest {
    pub provider_id: String,
    pub base_url: String,
    pub model: String,
    pub messages: Vec<AiMessage>,
    #[serde(default)]
    pub custom_headers: Option<std::collections::HashMap<String, String>>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiMessage {
    pub role: String,
    pub content: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CallAiApiResult {
    pub content: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub latency_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModelsResult {
    pub reachable: bool,
    pub models: Vec<OllamaModel>,
}

#[tauri::command]
pub async fn call_ai_api(request: CallAiApiRequest, api_key: Option<String>) -> Result<CallAiApiResult, String> {
    if request.provider_id != "ollama" {
        crate::net_guard::ensure_not_private(&request.base_url).await?;
    }
    let start = std::time::Instant::now();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(request.timeout_secs.unwrap_or(30)))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/chat/completions", request.base_url.trim_end_matches('/'));

    let mut body = serde_json::json!({
        "model": request.model,
        "messages": request.messages,
    });

    if let Some(max_tokens) = request.max_tokens {
        body["max_tokens"] = serde_json::json!(max_tokens);
    }
    if let Some(temperature) = request.temperature {
        body["temperature"] = serde_json::json!(temperature);
    }

    let mut req_builder = client.post(&url).header("Content-Type", "application/json");

    if let Some(key) = &api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            if request.provider_id == "anthropic" {
                req_builder = req_builder.header("x-api-key", trimmed);
            } else {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", trimmed));
            }
        }
    }

    if let Some(headers) = &request.custom_headers {
        for (k, v) in headers {
            validate_custom_header(k)?;
            req_builder = req_builder.header(k.as_str(), v.as_str());
        }
    }

    let response = req_builder
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| format!("AI API request failed: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read AI API response: {}", e))?;

    if !status.is_success() {
        return Err(format!("AI API returned status {}: {}", status, truncate_error(&response_text)));
    }

    let parsed: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse AI API response JSON: {}", e))?;

    let content = parsed
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    let usage = parsed.get("usage").cloned().unwrap_or(serde_json::json!({}));
    let input_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let output_tokens = usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let latency_ms = start.elapsed().as_millis() as u64;

    Ok(CallAiApiResult {
        content,
        input_tokens,
        output_tokens,
        latency_ms,
    })
}

#[tauri::command]
pub async fn test_ai_connection(base_url: String, api_key: Option<String>, provider_id: String) -> Result<bool, String> {
    if provider_id != "ollama" {
        crate::net_guard::ensure_not_private(&base_url).await?;
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let mut req_builder = client.get(&url).header("Content-Type", "application/json");

    if let Some(key) = &api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            if provider_id == "anthropic" {
                req_builder = req_builder.header("x-api-key", trimmed);
            } else {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", trimmed));
            }
        }
    }

    match req_builder.send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn read_ai_api_key(provider_id: String) -> Result<Option<String>, String> {
    let entry = ai_key_entry(&provider_id)?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("Unable to read AI API key from system keychain: {}", error)),
    }
}

#[tauri::command]
pub async fn write_ai_api_key(provider_id: String, key: Option<String>) -> Result<(), String> {
    let entry = ai_key_entry(&provider_id)?;
    match normalize_key(key) {
        Some(key) => entry.set_password(&key).map_err(|error| {
            format!("Unable to write AI API key to system keychain: {}", error)
        }),
        None => match entry.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(format!("Unable to remove AI API key from system keychain: {}", error)),
        },
    }
}

#[tauri::command]
pub async fn check_ollama_reachable() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn list_ollama_models() -> Result<OllamaModelsResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(response) => {
            if !response.status().is_success() {
                return Ok(OllamaModelsResult { reachable: false, models: vec![] });
            }
            let text = response.text().await.map_err(|e| format!("Failed to read Ollama response: {}", e))?;
            let parsed: serde_json::Value = serde_json::from_str(&text)
                .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
            let models = parsed
                .get("models")
                .and_then(|m| m.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            let name = m.get("name")?.as_str()?.to_string();
                            let size = m.get("size")?.as_u64().unwrap_or(0);
                            Some(OllamaModel { name, size })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Ok(OllamaModelsResult { reachable: true, models })
        }
        Err(_) => Ok(OllamaModelsResult { reachable: false, models: vec![] }),
    }
}

fn ai_key_entry(provider_id: &str) -> Result<Entry, String> {
    let account = normalize_provider_id(provider_id)?;
    Entry::new(AI_KEYCHAIN_SERVICE, account).map_err(|error| {
        format!("Unable to open AI API key entry in system keychain: {}", error)
    })
}

static PROVIDER_ID_CACHE: OnceLock<Mutex<HashMap<String, &'static str>>> = OnceLock::new();

fn provider_id_cache() -> &'static Mutex<HashMap<String, &'static str>> {
    PROVIDER_ID_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn normalize_provider_id(provider_id: &str) -> Result<&'static str, String> {
    match provider_id.trim().to_ascii_lowercase().as_str() {
        "openai" => Ok("openai"),
        "anthropic" => Ok("anthropic"),
        "gemini" => Ok("gemini"),
        "mimo" => Ok("mimo"),
        "deepseek" => Ok("deepseek"),
        "glm" => Ok("glm"),
        "qwen" => Ok("qwen"),
        "kimi" => Ok("kimi"),
        "ernie" => Ok("ernie"),
        "spark" => Ok("spark"),
        "doubao" => Ok("doubao"),
        "groq" => Ok("groq"),
        "together" => Ok("together"),
        "elevenlabs" => Ok("elevenlabs"),
        "ollama" => Ok("ollama"),
        _ => {
            let normalized: String = provider_id
                .trim()
                .to_ascii_lowercase()
                .chars()
                .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
                .collect();
            let mut cache = provider_id_cache()
                .lock()
                .map_err(|_| "Failed to lock provider ID cache".to_string())?;
            if let Some(&cached) = cache.get(&normalized) {
                return Ok(cached);
            }
            let leaked: &'static str = Box::leak(normalized.clone().into_boxed_str());
            cache.insert(normalized, leaked);
            Ok(leaked)
        }
    }
}

fn normalize_key(key: Option<String>) -> Option<String> {
    key.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn truncate_error(text: &str) -> String {
    let max = 200;
    if text.len() <= max {
        text.to_string()
    } else {
        format!("{}...", &text[..max])
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractAiFramesRequest {
    pub source_path: String,
    pub times: Vec<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractAiFramesResult {
    pub frames: Vec<String>,
}

#[tauri::command]
pub async fn extract_ai_frames(
    app: AppHandle,
    request: ExtractAiFramesRequest,
) -> Result<ExtractAiFramesResult, String> {
    tauri::async_runtime::spawn_blocking(move || extract_ai_frames_blocking(app, request))
        .await
        .map_err(|error| error.to_string())?
}

fn extract_ai_frames_blocking(
    app: AppHandle,
    request: ExtractAiFramesRequest,
) -> Result<ExtractAiFramesResult, String> {
    let safe_source = validate_path(&app, std::path::Path::new(&request.source_path))?;
    let source = safe_source.to_string_lossy().to_string();
    let mut frames = Vec::new();
    for &time in &request.times {
        let output = Command::new(ffmpeg_binary())
            .args([
                "-hide_banner",
                "-ss",
                &format!("{:.3}", time),
                "-i",
                &source,
                "-vframes",
                "1",
                "-vf",
                "scale=512:-2",
                "-f",
                "image2pipe",
                "-vcodec",
                "mjpeg",
                "pipe:1",
            ])
            .output()
            .map_err(|e| format!("无法启动 FFmpeg: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "FFmpeg 抽帧失败: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        let b64 = base64::engine::general_purpose::STANDARD.encode(&output.stdout);
        frames.push(b64);
    }
    Ok(ExtractAiFramesResult { frames })
}


// --- TTS voiceover ---

#[derive(Debug, Serialize, Deserialize)]
pub struct CallTtsApiRequest {
    pub base_url: String,
    pub voice_id: String,
    pub text: String,
    #[serde(default = "default_tts_speed")]
    pub speed: f64,
    #[serde(default)]
    pub stability: Option<f64>,
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

fn default_tts_speed() -> f64 {
    1.0
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CallTtsApiResult {
    pub audio_base64: String,
    pub latency_ms: u64,
}

#[tauri::command]
pub async fn call_tts_api(request: CallTtsApiRequest, api_key: Option<String>) -> Result<CallTtsApiResult, String> {
    crate::net_guard::ensure_not_private(&request.base_url).await?;
    let start = std::time::Instant::now();
    let engine = request.engine.as_deref().unwrap_or("compatible");
    let base = request.base_url.trim_end_matches('/');
    let (url, body) = match engine {
        "elevenlabs" => {
            let url = format!("{}/text-to-speech/{}", base, urlencoding::encode(&request.voice_id));
            let b = serde_json::json!({
                "text": request.text,
                "model_id": request.model.as_deref().unwrap_or("eleven_multilingual_v2"),
                "voice_settings": {
                    "stability": request.stability.unwrap_or(0.5),
                    "speed": request.speed
                }
            });
            (url, b)
        }
        _ => {
            let url = format!("{}/audio/speech", base);
            let b = serde_json::json!({
                "model": request.model.as_deref().unwrap_or("tts-1"),
                "input": request.text,
                "voice": request.voice_id,
                "speed": request.speed
            });
            (url, b)
        }
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Accept", "audio/mpeg");
    if let Some(key) = &api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            if engine == "elevenlabs" {
                req_builder = req_builder.header("xi-api-key", trimmed);
            } else {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", trimmed));
            }
        }
    }
    let response = req_builder
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| format!("TTS API request failed: {}", e))?;
    let status = response.status();
    let response_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read TTS API response: {}", e))?;
    if !status.is_success() {
        let error_text = String::from_utf8_lossy(&response_bytes);
        return Err(format!("TTS API returned status {}: {}", status, truncate_error(&error_text)));
    }
    let audio_base64 = base64::engine::general_purpose::STANDARD.encode(&response_bytes);
    let latency_ms = start.elapsed().as_millis() as u64;
    Ok(CallTtsApiResult { audio_base64, latency_ms })
}


fn validate_custom_header(name: &str) -> Result<(), String> {
    let lower = name.to_ascii_lowercase();
    const BLOCKED: &[&str] = &[
        "host", "cookie", "authorization", "content-length",
        "transfer-encoding", "connection", "proxy-authorization",
        "upgrade", "te", "trailer",
    ];
    if BLOCKED.contains(&lower.as_str()) {
        return Err(format!(
            "Custom header '{}' is not allowed for security reasons.", name
        ));
    }
    // RFC 7230 token: visible ASCII, no whitespace or separators
    if name.is_empty()
        || name.len() > 128
        || !name.chars().all(|c| c.is_ascii_graphic() && !is_header_separator(c))
    {
        return Err(format!(
            "Custom header name '{}' is invalid. Must be a valid HTTP token (visible ASCII, no spaces/separators).",
            name
        ));
    }
    Ok(())
}

fn is_header_separator(c: char) -> bool {
    matches!(c, '(' | ')' | '<' | '>' | '@' | ',' | ';' | ':' | '"' | '/' | '[' | ']' | '?' | '=' | '{' | '}' | ' ')
        || c == '\u{005c}'
        || c.is_ascii_whitespace()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_known_provider_ids() {
        assert_eq!(normalize_provider_id("openai").unwrap(), "openai");
        assert_eq!(normalize_provider_id(" OpenAI ").unwrap(), "openai");
        assert_eq!(normalize_provider_id("ANTHROPIC").unwrap(), "anthropic");
    }

    #[test]
    fn normalizes_custom_provider_id() {
        let result = normalize_provider_id("My Custom Provider!").unwrap();
        assert_eq!(result, "my-custom-provider-");
    }

    #[test]
    fn normalizes_empty_api_keys_to_delete() {
        assert_eq!(normalize_key(None), None);
        assert_eq!(normalize_key(Some(" ".to_string())), None);
        assert_eq!(normalize_key(Some("  sk-test  ".to_string())), Some("sk-test".to_string()));
    }

    #[test]
    fn truncates_long_error_messages() {
        let long_text = "x".repeat(300);
        let truncated = truncate_error(&long_text);
        assert!(truncated.len() <= 203);
        assert!(truncated.ends_with("..."));
    }

    #[test]
    fn keeps_short_error_messages() {
        let short_text = "Error message";
        assert_eq!(truncate_error(short_text), "Error message");
    }

    #[test]
    fn blocks_security_sensitive_headers() {
        assert!(validate_custom_header("Host").is_err());
        assert!(validate_custom_header("authorization").is_err());
        assert!(validate_custom_header("Cookie").is_err());
        assert!(validate_custom_header("content-length").is_err());
        assert!(validate_custom_header("transfer-encoding").is_err());
        assert!(validate_custom_header("proxy-authorization").is_err());
    }

    #[test]
    fn blocks_invalid_header_tokens() {
        assert!(validate_custom_header("").is_err());
        assert!(validate_custom_header("X-Custom Header").is_err());
        assert!(validate_custom_header("X	Header").is_err());
        assert!(validate_custom_header("XBad").is_err());
    }

    #[test]
    fn accepts_valid_custom_headers() {
        assert!(validate_custom_header("X-Custom-Header").is_ok());
        assert!(validate_custom_header("X-Api-Key").is_ok());
        assert!(validate_custom_header("Accept-Language").is_ok());
    }
}
