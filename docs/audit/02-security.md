# Security Audit Report

**Date**: 2026-07-03
**Scope**: D:/code/Ai/open-factory (Tauri desktop video editor)
**Categories**: Hardcoded credentials, XSS (innerHTML), Input validation, Path traversal

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 7 |
| MEDIUM | 2 |
| **Total** | **10** |

Positive findings:
- Credentials (API keys, SMTP passwords) are properly stored in system keyring (keyring crate), not hardcoded.
- path_validator.rs is well-implemented: rejects Component::ParentDir, requires absolute paths, uses fs::canonicalize for symlink resolution.
- File operations in commands/files.rs all go through validate_path/validate_path_for_write.
- ZIP archive creation in commands/share.rs has proper normalize_archive_path rejecting .., absolute paths, and null bytes.
- Project encryption uses AES-256-GCM with Argon2id KDF (commands/project_crypto.rs).

---

## CRITICAL

### C-1: Post-export script allows arbitrary command execution

**File**: apps/desktop/src-tauri/src/commands/ffmpeg.rs
**Lines**: 1519-1596

**Code**:

```rust
fn run_post_export_script(
    script: Option<&PostExportScriptDto>,
    context: PostExportScriptContext,
) -> Option<PostExportScriptResult> {
    let command = script?.command.trim();
    let resolved_command = expand_post_export_script_command(command, &context);
    let tokens = match split_command_line(&resolved_command) { ... };
    let program = tokens[0].clone();
    let args = tokens[1..].to_vec();
    match Command::new(&program).args(&args).output() { ... }
}

fn expand_post_export_script_command(
    command: &str, context: &PostExportScriptContext
) -> String {
    command
        .replace("{output}", context.output_path)
        .replace("{project}", context.project_name)
        .replace("{duration}", &format_post_export_duration(context.duration_seconds))
        .replace("{date}", &format_post_export_date(context.now))
}
```

**Risk**: The post-export script feature executes arbitrary user-provided commands. The {project} and {output} placeholders are substituted with values that may contain shell metacharacters. While split_command_line handles basic quoting, a malicious project name could inject commands depending on the OS shell behavior. On Windows, Command::new still passes through cmd.exe for batch files.

**Fix**:
1. Add an allowlist of permitted executables (scripts in a trusted directory, or a fixed set of known tools).
2. Escape or reject shell metacharacters in placeholder values before substitution.
3. Add a confirmation dialog before execution (defense-in-depth).
4. Consider using Command::new with explicit args rather than parsing a command line string.

---

## HIGH

### H-1: XSS via dangerouslySetInnerHTML in TimelineTemplateDialog

**File**: apps/desktop/src/timeline-templates/TimelineTemplateDialog.tsx
**Line**: 150

**Code**:

```tsx
<div
  className="overflow-hidden rounded-md border border-line bg-panel p-2"
  data-testid="timeline-template-preview"
  dangerouslySetInnerHTML={{ __html: previewSvg }}
/>
```

**Risk**: previewSvg is rendered as raw HTML/SVG without sanitization. If sourced from user-provided template files or external data, an attacker could embed <script> tags or event handlers (onload, onerror) to execute arbitrary JavaScript in the Tauri webview.

**Fix**: Sanitize with DOMPurify before rendering:
```tsx
import DOMPurify from "dompurify";
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewSvg) }}
```

### H-2: XSS via dangerouslySetInnerHTML in ProjectDocumentationPanel

**File**: apps/desktop/src/components/ProjectDocumentationPanel.tsx
**Line**: 82

**Code**:

```tsx
<div
  className="prose prose-sm max-w-none rounded-md bg-panel p-2 text-xs text-slate-700"
  dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(value) || "<p>empty</p>" }}
/>
```

**Risk**: User-typed documentation text is passed through renderSimpleMarkdown and rendered as raw HTML. If the markdown parser does not strip <script>, <iframe>, or event handler attributes, this is a direct XSS vector. The value comes from user text input stored in the project file.

**Fix**: Sanitize output with DOMPurify, or use a markdown library that strips dangerous HTML by default (e.g., marked with sanitize: true, or rehype-sanitize).

### H-3: XSS via dangerouslySetInnerHTML in Inspector rich text

**File**: apps/desktop/src/components/Inspector/Inspector.tsx
**Line**: 4968

**Code**:

```tsx
<div
  contentEditable
  onBlur={commitFromDom}
  dangerouslySetInnerHTML={{
    __html: richTextToHtml(normalizeRichTextDocument(clip.richText, clip.text))
  }}
/>
```

**Risk**: Rich text editor content is rendered as raw HTML. The content originates from a contentEditable div where users type freely. If loaded project data contains malicious HTML, it will be rendered and executed. Although onPaste strips to plain text, the initial render from stored richText data is unprotected.

**Fix**: Sanitize richTextToHtml() output with DOMPurify. Consider replacing contentEditable with a proven rich text library (TipTap, Slate) that handles sanitization internally.

### H-4: SSRF via webhook publishing

**File**: apps/desktop/src-tauri/src/commands/publish.rs
**Lines**: 103-109

**Code**:

```rust
fn parse_webhook_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|error| error.to_string())?;
    match parsed.scheme() {
        "https" | "http" => Ok(parsed),
        _ => Err("Webhook URL must use http or https.".to_string()),
    }
}
```

**Risk**: The webhook URL is user-provided and only checked for http/https scheme. No restriction against internal network addresses (127.0.0.1, 10.x.x.x, 192.168.x.x, 169.254.x.x). An attacker could probe internal services, access cloud metadata endpoints (http://169.254.169.254/...), or exfiltrate data to an attacker-controlled server.

**Fix**:
1. Block private/internal IP ranges: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7.
2. Resolve DNS and check the resolved IP before making the request (DNS rebinding protection).
3. Consider a user confirmation dialog showing the resolved URL before sending.

### H-5: WebSocket collaboration server binds to 0.0.0.0 without authentication

**File**: apps/desktop/src-tauri/src/commands/collaboration.rs
**Line**: 55

**Code**:

```rust
let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port)))
    .await
    .map_err(|error| error.to_string())?;
```

**Risk**: The collaboration WebSocket server binds to all network interfaces (0.0.0.0) and has no authentication mechanism. Any device on the local network can connect, send messages, and receive collaboration data. This exposes project content and allows message injection.

**Fix**:
1. Bind to Ipv4Addr::LOCALHOST (127.0.0.1) by default, with explicit opt-in for network access.
2. Add a shared secret or token-based authentication for WebSocket connections.
3. Display a visible warning when the server is accessible on the network.

### H-6: SMTP builder_dangerous bypasses TLS certificate verification

**File**: apps/desktop/src-tauri/src/commands/publish.rs
**Lines**: 84-88

**Code**:

```rust
let mut transport_builder = if request.secure.unwrap_or(false) {
    SmtpTransport::relay(&host).map_err(|error| format!("Unable to configure SMTP TLS: {}", error))?
} else {
    SmtpTransport::builder_dangerous(&host)
};
```

**Risk**: When secure is false (or not set, defaults to None), builder_dangerous disables TLS certificate verification entirely. This allows MITM attacks on SMTP connections, potentially exposing credentials and email content.

**Fix**:
1. Default secure to true instead of false.
2. If builder_dangerous must remain available, add a clear warning in the UI.
3. Consider using SmtpTransport::relay() with Tls::Opportunistic as the default.

### H-7: User-controlled custom_headers passed to HTTP requests

**File**: apps/desktop/src-tauri/src/commands/ai.rs
**Lines**: 90-93

**Code**:

```rust
if let Some(headers) = &request.custom_headers {
    for (k, v) in headers {
        req_builder = req_builder.header(k.as_str(), v.as_str());
    }
}
```

**Risk**: Arbitrary header names and values from user input are passed directly to HTTP requests without validation. Could be used to inject Host headers for routing manipulation, override Authorization headers to exfiltrate API keys, or set Cookie headers for session fixation attacks against internal services.

**Fix**:
1. Block sensitive header names: Host, Cookie, Content-Length, Transfer-Encoding, Connection.
2. Validate header name format (RFC 7230 token rules).
3. Log custom header usage for audit trail.

## MEDIUM

### M-1: Box::leak causes memory leak for custom provider IDs

**File**: apps/desktop/src-tauri/src/commands/ai.rs
**Lines**: 260-267

**Code**:

```rust
_ => {
    let normalized: String = provider_id
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
        .collect();
    Ok(Box::leak(normalized.into_boxed_str()))
}
```

**Risk**: Box::leak intentionally leaks memory to create a &'static str. Each unique custom provider ID leaks one String permanently. In a long-running session with many different provider IDs, this accumulates. Not exploitable for code execution, but violates memory safety expectations.

**Fix**: Use a static HashMap or once_cell::Lazy<Mutex<HashMap>> to cache provider IDs, returning &'static str from the cache without leaking per-call.

### M-2: User-controlled base_url used without validation

**File**: apps/desktop/src-tauri/src/commands/ai.rs
**Line**: 63

**Code**:

```rust
let url = format!("{}/chat/completions", request.base_url.trim_end_matches('/'));
```

**Risk**: base_url is user-provided and used directly to construct the request URL. Combined with custom_headers (H-7), this enables SSRF to arbitrary internal endpoints. No validation against private IP ranges or localhost. Unlike the webhook SSRF (H-4), this endpoint is designed for AI API calls, so the user likely controls the destination, but a malicious plugin or template could redirect requests.

**Fix**:
1. Validate base_url against a list of known AI provider base URLs, or at minimum block private IP ranges.
2. Display the resolved URL in the UI before making the request.

---

## References

Well-secured modules (no findings):

| Module | Why |
|--------|-----|
| path_validator.rs | Rejects ParentDir, requires absolute paths, canonicalize for symlinks |
| commands/files.rs | All file ops go through validate_path |
| commands/secrets.rs | System keyring for credential storage |
| commands/project_crypto.rs | AES-256-GCM + Argon2id KDF |
| commands/share.rs | normalize_archive_path rejects .., absolute, null bytes |
| commands/whisper.rs | Uses validate_path for all file operations |
| commands/demucs.rs | Uses validate_path for all file operations |
