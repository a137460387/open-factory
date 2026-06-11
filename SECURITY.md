# Security Notes

open-factory is local-first and treats renderer compromise as the primary desktop threat model: a script injection must not turn custom Tauri commands into arbitrary local file read, write, delete, probe, or FFmpeg execution primitives. Custom Rust file and media commands canonicalize requested paths, reject parent traversal, reject symlink escapes, and only allow app data, app cache, or paths authorized through native file selection, drag-and-drop, or smoke-test environment setup. The Tauri asset protocol no longer exposes the whole filesystem; it is limited to app/cache locations and common user media folders needed for local preview, while command-level access remains bounded by the runtime allowlist.

## Reporting Vulnerabilities

Please report suspected vulnerabilities through GitHub Private Vulnerability Reporting for this repository. Include a short description, reproduction steps, affected platform, and whether local media or project files are involved.

We aim to acknowledge valid reports within 7 days. Fix timing depends on severity, reproducibility, and whether the issue is in open-factory code or an upstream desktop/runtime dependency.

## Known Advisories

The following dependency advisories are known and tracked. They are not marked as fixed until the Tauri upstream dependency graph provides patched releases that can be adopted safely.

- `glib@0.18.5`: soundness advisory in the Rust GTK/glib stack; waiting for Tauri upstream updates.
- 16 unmaintained transitive Rust dependency advisories in the current Tauri/webview dependency graph; waiting for Tauri upstream updates.
