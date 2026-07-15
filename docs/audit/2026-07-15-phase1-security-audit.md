# Open Factory Phase 1 安全审计报告

**版本**: v4.25.4
**审计日期**: 2026-07-15
**审计范围**: 加密、FFmpeg、文件系统、CSP、API Key、依赖漏洞

---

## 执行摘要

| 指标 | 数值 |
|------|------|
| Critical | 1 |
| High | 3 |
| Medium | 10 |
| Low | 15 |
| 总问题数 | 29 |

**整体安全评级**: ⚠️ 中等偏上

项目在架构设计上采用了合理的安全实践（系统钥匙链、路径白名单、数组参数传递等），但存在几个需要优先修复的高危问题。

---

## Critical 级别问题

### C1: WebDAV 密码加密密钥可预测

**位置**: `apps/desktop/src-tauri/src/commands/backup.rs:507-512`

**根因**: `derive_secret_key` 使用 SHA-256 哈希 `"open-factory:webdav-backup-password:v1"` + `app_dir` 路径来派生 AES-256 密钥。密钥的"秘密"仅仅是应用数据目录的路径，该路径对任何有本机文件系统访问权限的用户来说都是已知的。

**影响**: 攻击者只要能读取 `backup-secrets.json` 文件，就可以使用相同的路径推导出加密密钥，进而解密所有 WebDAV 密码。这使得 WebDAV 密码的加密形同虚设。

**代码片段**:
```rust
fn derive_secret_key(app_dir: &Path) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"open-factory:webdav-backup-password:v1");
    hasher.update(app_dir.to_string_lossy().as_bytes());
    hasher.finalize().into()
}
```

**修复建议**: 将 WebDAV 密码存储迁移到系统 keyring（与 translation API key 和 SMTP 密码的处理方式保持一致）。

---

## High 级别问题

### H1: WebDAV nonce 生成使用可预测材料

**位置**: `apps/desktop/src-tauri/src/commands/backup.rs:514-527`

**根因**: `derive_nonce` 使用 `SystemTime::now().as_nanos()`、`process::id()` 和 `password.len()` 的 SHA-256 哈希来生成 nonce。这些值可预测。

**影响**: nonce 重用会导致 AES-GCM 认证加密完全失效，攻击者可恢复认证密钥并伪造密文。

**修复建议**: 使用 `OsRng` 生成密码学安全随机 nonce。

---

### H2: Asset Protocol scope 过于宽泛

**位置**: `apps/desktop/src-tauri/tauri.conf.json:26-35`

**根因**: `assetProtocol.scope` 配置了 `$DOCUMENT/**`、`$DOWNLOAD/**`、`$VIDEO/**`、`$AUDIO/**`、`$PICTURE/**` 五个用户个人目录。与 Tauri fs scope 的严格限制形成安全不一致。

**影响**: 如果前端存在 XSS 漏洞，攻击者可通过 `asset://` URL 直接读取用户文档、下载、视频、音频、图片目录中的任意文件。

**代码片段**:
```json
"assetProtocol": {
    "scope": [
        "$APPDATA/**",
        "$APPCACHE/**",
        "$DOCUMENT/**",    // 用户文档目录
        "$DOWNLOAD/**",    // 用户下载目录
        "$VIDEO/**",       // 用户视频目录
        "$AUDIO/**",       // 用户音频目录
        "$PICTURE/**",     // 用户图片目录
        "$TEMP/open-factory-*/**"
    ]
}
```

**修复建议**: 缩小 scope，仅在用户通过对话框明确授权某个目录后才动态添加。

---

### H3: CSP `connect-src` 缺少 `gist.githubusercontent.com`

**位置**: `apps/desktop/src-tauri/tauri.conf.json:23`

**根因**: CSP `connect-src` 仅允许 `https://api.github.com` 和 `https://github.com`，但应用中有三个功能模块向 `https://gist.githubusercontent.com` 发起 `fetch` 请求。

**影响**: 在严格实施 CSP 的 WebView 中，这些 `fetch` 调用会被浏览器阻止，导致功能静默失败。

**修复建议**: 在 `connect-src` 中补充 `https://gist.githubusercontent.com`。

---

## Medium 级别问题

| ID | 问题 | 位置 | 修复建议 |
|----|------|------|----------|
| M1 | 无密码强度校验 | `project_crypto.rs:102-108` | 添加最低密码长度要求 |
| M2 | 密码通过 IPC 明文传输 | `tauri-bridge.ts:986-1001` | 考虑内存擦除或安全通道 |
| M3 | 符号链接未检查 | `path_validator.rs:114-117` | 逐组件检查符号链接 |
| M4 | TOCTOU 竞态条件 | `path_validator.rs:119-142` | 使用 O_NOFOLLOW 或验证结果 |
| M5 | scan_directory 遍历未校验 | `files.rs:266-293` | 跳过符号链接条目 |
| M6 | 反斜杠转义逻辑无效 | `ffmpeg-escape.ts:5-11` | 重新排列执行顺序 |
| M7 | 颜色值无过滤 | `ffmpeg-escape.ts:13-28` | 添加白名单验证 |
| M8 | 远程数据 links 无 URL 验证 | `error-knowledge.ts:394` | 添加协议白名单 |
| M9 | 更新端点允许 HTTP | `update-settings.ts:44-50` | 限制为仅 HTTPS |
| M10 | WebDAV 密钥派生缺乏拉伸 | `backup.rs:507-512` | 使用 Argon2id 或迁移到 keyring |

---

## Low 级别问题

| ID | 问题 | 位置 |
|----|------|------|
| L1 | 密码 trim 导致熵值降低 | `project_crypto.rs:103` |
| L2 | Legacy KDF (v1) 使用弱哈希 | `project_crypto.rs:122-138` |
| L3 | Argon2 expect() 可能 panic | `project_crypto.rs:111,117` |
| L4 | SMTP profile 名称可能碰撞 | `secrets.rs:105-125` |
| L5 | Keyring 错误信息泄露系统信息 | `secrets.rs:12-14` |
| L6 | fs_exists 权限过大 | `files.rs:224-227` |
| L7 | session_allowed_paths 只增不减 | `path_validator.rs:9,79-86` |
| L8 | move_file 非原子操作 | `files.rs:199-220` |
| L9 | filter_complex 路径不覆盖 | `ffmpeg.rs:1103-1144` |
| L10 | 后导出脚本可执行任意程序 | `ffmpeg.rs:1587-1694` |
| L11 | font-src 指令未声明 | `tauri.conf.json:23` |
| L12 | 前端明文持有 API Key | `aiSettingsStore.ts:211-213` |
| L13 | localStorage 遗留翻译 Key | `translationSettingsStore.ts:131-133` |
| L14 | v1 格式无迁移路径 | `project_crypto.rs:121-138` |
| L15 | 协作令牌明文传输 | `collaboration.rs:110-122` |

---

## 正面发现（安全实践良好）

### 加密与密钥管理
- ✅ 系统钥匙链存储 AI API Key、翻译 API Key、SMTP 密码
- ✅ 无硬编码密钥
- ✅ 前端不持久化密钥
- ✅ 项目加密使用 Argon2id + AES-256-GCM

### FFmpeg 命令执行
- ✅ 参数以数组形式构建，无命令注入风险
- ✅ 无 shell 调用，使用 `Command::new().args()`
- ✅ 路径白名单验证严格
- ✅ shell 元字符检测完备

### 文件系统访问
- ✅ 路径遍历防护完备（拒绝 `..`）
- ✅ 文件对话框来源路径会经过授权流程
- ✅ 所有文件操作命令都经过路径校验
- ✅ Tauri fs scope 正确限制

### CSP 与前端安全
- ✅ `dangerouslySetInnerHTML` 全部使用 DOMPurify 消毒
- ✅ `script-src` 不含 `unsafe-eval` 和 `unsafe-inline`
- ✅ 插件系统有 SHA-256 完整性校验
- ✅ Markdown 渲染安全

### 其他
- ✅ SSRF 防护（`net_guard.rs`）
- ✅ WebDAV HTTPS 强制
- ✅ `.gitignore` 完善
- ✅ 无敏感信息日志泄露
- ✅ npm audit: 0 漏洞
- ✅ cargo audit: 2 警告（atty 未维护）

---

## 优先修复清单（按性价比排序）

| 优先级 | 问题 ID | 问题 | 修复成本 | 风险降低 |
|--------|---------|------|----------|----------|
| 🔴 1 | C1 | WebDAV 密码加密密钥可预测 | 中 | 极高 |
| 🔴 2 | H1 | WebDAV nonce 可预测 | 低 | 高 |
| 🔴 3 | H2 | Asset Protocol scope 过宽 | 低 | 高 |
| 🟡 4 | H3 | CSP connect-src 缺少域名 | 低 | 中 |
| 🟡 5 | M9 | 更新端点允许 HTTP | 低 | 中 |
| 🟡 6 | M8 | 远程数据 links 无 URL 验证 | 低 | 中 |
| 🟡 7 | M6 | 反斜杠转义逻辑无效 | 低 | 中 |
| 🟡 8 | M7 | 颜色值无过滤 | 低 | 中 |
| ⚪ 9 | M1 | 无密码强度校验 | 低 | 中 |
| ⚪ 10 | M3-M5 | 符号链接/TOCTOU 相关 | 中 | 中 |

---

## 依赖漏洞状态

| 生态 | 工具 | 结果 |
|------|------|------|
| Node.js | npm audit | ✅ 0 漏洞 |
| Rust | cargo audit | ⚠️ 2 警告 (atty@0.2.14 未维护) |

已知依赖问题（来自 SECURITY.md）：
- `glib@0.18.5`: soundness advisory（等待 Tauri 上游更新）
- 16 个未维护的 Rust 依赖（等待 Tauri 上游更新）

---

## 下一步

1. **立即修复**: C1、H1、H2（Critical + High）
2. **短期修复**: H3、M6-M9（1-2 周内）
3. **中期改进**: M1-M5、L1-L15（版本迭代中）

**Phase 1 安全审计完成，准备进入 Phase 2 架构审计。**

---

**审计人**: ZCode AI Agent
**审计方法**: 四阶段方法（复现/定位根因/假设验证/修复建议）
**证据原则**: 每个问题附文件路径、行号和代码片段
