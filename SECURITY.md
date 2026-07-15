# Security Notes

open-factory is local-first and treats renderer compromise as the primary desktop threat model: a script injection must not turn custom Tauri commands into arbitrary local file read, write, delete, probe, or FFmpeg execution primitives. Custom Rust file and media commands canonicalize requested paths, reject parent traversal, reject symlink escapes, and only allow app data, app cache, or paths authorized through native file selection, drag-and-drop, or smoke-test environment setup. The Tauri asset protocol no longer exposes the whole filesystem; it is limited to app/cache locations and common user media folders needed for local preview, while command-level access remains bounded by the runtime allowlist.

## Reporting Vulnerabilities

Please report suspected vulnerabilities through GitHub Private Vulnerability Reporting for this repository. Include a short description, reproduction steps, affected platform, and whether local media or project files are involved.

We aim to acknowledge valid reports within 7 days. Fix timing depends on severity, reproducibility, and whether the issue is in open-factory code or an upstream desktop/runtime dependency.

## Known Advisories

The following dependency advisories are known and tracked. They are not marked as fixed until the Tauri upstream dependency graph provides patched releases that can be adopted safely.

- `glib@0.18.5`: soundness advisory in the Rust GTK/glib stack; waiting for Tauri upstream updates.
- 16 unmaintained transitive Rust dependency advisories in the current Tauri/webview dependency graph; waiting for Tauri upstream updates.

## Audit Fix History

### 2026-07-15 — 全量代码审计修复

基于 v4.25.4 全量代码审计（100 个问题），已完成以下安全和高优先级修复：

**Critical 修复：**
- **C1**: WebDAV 密码加密密钥可预测 → 已迁移到系统 keyring 存储（`backup.rs`）
- **C2**: 中文分词完全失效 → 已实现 n-gram 分词策略（`ai-speech-understanding.ts`）

**High 安全修复：**
- **H1**: WebDAV nonce 可预测 → 随 C1 迁移到 keyring，不再需要 nonce
- **H2**: Asset Protocol scope 过宽 → 已收窄至 `$APPDATA`/`$APPCACHE`/`$TEMP`
- **H3**: CSP connect-src 缺少域名 → 已补充 `gist.githubusercontent.com`

**High 业务逻辑修复：**
- **H10**: TF-IDF 评分公式错误 → 已修正
- **H11**: 导出取消后无资源清理 → 已添加 finally 清理块
- **H12**: 导出格式校验缺失 → 已添加白名单校验
- **H14**: 轨道锁定未被命令检查 → 已为 6 个关键命令添加锁定检查
- **H15**: DeleteClipsCommand 未清理 Transition → 已修复

**依赖审计：**
- npm audit: ✅ 0 漏洞
- cargo audit: 已知 2 个上游警告（atty 未维护），等待 Tauri 上游更新
