use lettre::message::{header::ContentType, Mailbox};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmtpEmailRequest {
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub from: String,
    pub to: Vec<String>,
    pub subject: String,
    pub html: String,
    pub secure: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookJsonRequest {
    pub url: String,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub body: Value,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct WebhookJsonResponse {
    pub status: u16,
}

#[tauri::command]
pub async fn send_smtp_email(request: SmtpEmailRequest) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || send_smtp_email_blocking(request))
        .await
        .map_err(|error| format!("SMTP task failed: {}", error))?
}

#[tauri::command]
pub async fn post_webhook_json(request: WebhookJsonRequest) -> Result<WebhookJsonResponse, String> {
    let timeout = Duration::from_millis(request.timeout_ms.unwrap_or(5_000).clamp(1, 5_000));
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(parse_webhook_url(&request.url)?)
        .headers(build_headers(request.headers)?)
        .json(&request.body)
        .send()
        .await
        .map_err(|error| format!("Webhook POST failed: {}", error))?;
    Ok(WebhookJsonResponse {
        status: response.status().as_u16(),
    })
}

fn send_smtp_email_blocking(request: SmtpEmailRequest) -> Result<(), String> {
    let host = normalize_required(&request.host, "SMTP host is required")?;
    let from = parse_mailbox(&request.from)?;
    let recipients = request
        .to
        .iter()
        .map(|value| parse_mailbox(value))
        .collect::<Result<Vec<_>, _>>()?;
    if recipients.is_empty() {
        return Err("SMTP recipient is required".to_string());
    }
    let mut builder = Message::builder()
        .from(from)
        .subject(normalize_required(&request.subject, "SMTP subject is required")?);
    for recipient in recipients {
        builder = builder.to(recipient);
    }
    let email = builder
        .header(ContentType::TEXT_HTML)
        .body(request.html)
        .map_err(|error| format!("Unable to build SMTP message: {}", error))?;
    let mut transport_builder = if request.secure.unwrap_or(false) {
        SmtpTransport::relay(&host).map_err(|error| format!("Unable to configure SMTP TLS: {}", error))?
    } else {
        SmtpTransport::builder_dangerous(&host)
    };
    transport_builder = transport_builder.port(request.port);
    if let (Some(username), Some(password)) = (
        normalize_optional(request.username.as_deref()),
        normalize_optional(request.password.as_deref()),
    ) {
        transport_builder = transport_builder.credentials(Credentials::new(username, password));
    }
    transport_builder
        .build()
        .send(&email)
        .map(|_| ())
        .map_err(|error| format!("Unable to send SMTP email: {}", error))
}

fn parse_webhook_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|error| error.to_string())?;
    match parsed.scheme() {
        "https" | "http" => Ok(parsed),
        _ => Err("Webhook URL must use http or https.".to_string()),
    }
}

fn build_headers(headers: Option<std::collections::HashMap<String, String>>) -> Result<HeaderMap, String> {
    let mut map = HeaderMap::new();
    for (key, value) in headers.unwrap_or_default() {
        let key = key.trim();
        let value = value.trim();
        if key.is_empty() || value.is_empty() {
            continue;
        }
        map.insert(
            HeaderName::from_bytes(key.as_bytes()).map_err(|error| error.to_string())?,
            HeaderValue::from_str(value).map_err(|error| error.to_string())?,
        );
    }
    Ok(map)
}

fn parse_mailbox(value: &str) -> Result<Mailbox, String> {
    value
        .trim()
        .parse::<Mailbox>()
        .map_err(|error| format!("Invalid email address: {}", error))
}

fn normalize_required(value: &str, message: &str) -> Result<String, String> {
    let normalized = value.trim().to_string();
    if normalized.is_empty() {
        Err(message.to_string())
    } else {
        Ok(normalized)
    }
}

fn normalize_optional(value: Option<&str>) -> Option<String> {
    value.map(str::trim).filter(|value| !value.is_empty()).map(ToOwned::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_http_and_https_webhook_urls() {
        assert_eq!(parse_webhook_url("https://hooks.example.test/export").unwrap().scheme(), "https");
        assert_eq!(parse_webhook_url("http://localhost:8787/export").unwrap().scheme(), "http");
        assert!(parse_webhook_url("file:///tmp/export.json").is_err());
    }

    #[test]
    fn builds_custom_webhook_headers() {
        let headers = build_headers(Some(std::collections::HashMap::from([(
            " Authorization ".to_string(),
            " Bearer token ".to_string(),
        )])))
        .unwrap();

        assert_eq!(headers.get("authorization").unwrap(), "Bearer token");
    }
}
