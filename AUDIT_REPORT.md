# Open Factory 全量代码审计报告

**审计日期**：2026-06-24
**仓库版本**：v3.10.0（主分支最新）
**审计范围**：全仓库源代码、配置文件、CI/CD 脚本、依赖清单；跳过 `node_modules`、`dist`、`build`、`.git` 及自动生成文件。
**审计工具**：`bun audit`、人工代码审查、`rg` 模式扫描、Rust/TypeScript 静态分析

---

## 1. 执行摘要

Open Factory 是一个架构清晰、安全意识较强的本地优先桌面视频编辑器。核心时间线算法集中在 `packages/editor-core`，有约 170 个单元测试文件和 80% 覆盖率门槛；Tauri 后端通过 `path_validator.rs` 实现了严格的路径白名单校验，FFmpeg 调用均使用参数数组而非 shell 拼接，密码/密钥通过系统钥匙链或 AES-256-GCM 加密存储。整体代码质量较高，无硬编码凭证，无 `file://` 直接赋值。主要风险点包括：`backup.rs` 中 WebDAV 密码加密使用的 nonce 生成方式不够随机（使用时间戳+PID 哈希）、`ffmpeg-builder.ts` 超过 4000 行需要拆分、3 处 `dangerouslySetInnerHTML` 使用需持续关注输入净化、以及 esbuild 开发服务器在 Windows 上存在低危任意文件读取漏洞。

---

## 2. 优先级待办清单

### Critical（无）

当前未发现可直接利用的严重安全漏洞。

### High

| # | 问题 | 位置 |
|---|------|------|
| H1 | WebDAV 密码加密 nonce 使用时间戳+PID 哈希，非密码学安全随机数 | `backup.rs:derive_nonce` |
| H2 | `ffmpeg-builder.ts` 超过 4000 行，职责过重 | `packages/editor-core/src/export/ffmpeg-builder.ts` |
| H3 | esbuild 低危漏洞（开发服务器任意文件读取，仅影响 dev 模式） | `bun audit` |

### Medium

| # | 问题 | 位置 |
|---|------|------|
| M1 | 3 处 `dangerouslySetInnerHTML` 使用，需确保输入始终经过净化 | Inspector.tsx, ProjectDocumentationPanel.tsx, TimelineTemplateDialog.tsx |
| M2 | 空 catch 块吞掉异常 | `SequenceCompareDialog.tsx:44` |
| M3 | 自实现密钥派生（迭代 SHA-256）而非标准 PBKDF2/Argon2 | `project_crypto.rs:derive_key` |
| M4 | Tauri FS scope 覆盖 `$DOCUMENT/**`、`$DOWNLOAD/**` 等宽泛路径 | `capabilities/default.json` |
| M5 | `trash_file` 非 Windows 平台直接返回错误 | `files.rs:trash_file_inner` |
| M6 | 无 `.github/workflows` CI 配置 | 仓库根目录 |

### Low

| # | 问题 | 位置 |
|---|------|------|
| L1 | `i18n/strings.ts` 中有 1 处 `any` 类型使用 | `strings.ts:5029` |
| L2 | `ffprobe.exe` 二进制文件提交到仓库 | `apps/desktop/ffprobe.exe` |
| L3 | 临时文件残留（`.bak`、`-report.json`） | 仓库根目录 |
| L4 | 运行时报告产物提交到仓库 | `media-compat-report.json`, `stress-test-report.json` |

---

## 3. 按维度分类详细问题列表

### 3.1 安全

#### S-01 [HIGH] WebDAV 密码加密 nonce 非密码学安全

- **文件**：`apps/desktop/src-tauri/src/commands/backup.rs`，`derive_nonce` 函数
- **问题**：nonce 通过 `SystemTime::now().as_nanos()` + `std::process::id()` + `password.len()` 的 SHA-256 哈希生成。同一纳秒内同一进程加密相同长度密码会产生相同 nonce，违反 AES-GCM 对 nonce 唯一性的要求。
- **影响**：nonce 重用会导致 AES-GCM 的机密性完全崩溃。
- **建议**：使用 `aes_gcm::aead::OsRng` 生成 12 字节随机 nonce（与 `project_crypto.rs` 中的做法一致）。

#### S-02 [HIGH] esbuild 开发服务器任意文件读取

- **来源**：`bun audit` 输出
- **影响**：仅影响 `bun run dev` 开发模式，不影响生产构建。
- **建议**：运行 `bun update` 升级 esbuild 至 >=0.28.1。

#### S-03 [MEDIUM] dangerouslySetInnerHTML 使用

| 位置 | 输入来源 | 净化方式 | 风险 |
|------|----------|----------|------|
| `Inspector.tsx:4721` | `clip.richText` | `richTextToHtml` | 低 |
| `ProjectDocumentationPanel.tsx:82` | 项目文档 Markdown | `renderSimpleMarkdown` -> `escapeHtml` | 低 |
| `TimelineTemplateDialog.tsx:150` | `previewSvg` | 内部生成 SVG | 低 |

**建议**：保持当前净化策略，后续新增 `dangerouslySetInnerHTML` 必须经过 `escapeHtml`。

#### S-04 [MEDIUM] 自实现密钥派生

- **文件**：`apps/desktop/src-tauri/src/commands/project_crypto.rs`，`derive_key` 函数
- **问题**：120,000 轮迭代 SHA-256 密钥派生，非标准实现。
- **建议**：迁移到 `argon2` 或 `pbkdf2` crate。

#### S-05 [MEDIUM] Tauri FS scope 面过广

- **文件**：`apps/desktop/src-tauri/capabilities/default.json`
- **建议**：动态添加 scope 而非预先开放所有用户目录。

#### S-06 [PASS] 路径校验良好实践

- `path_validator.rs`：拒绝空路径、非绝对路径、`..` 组件、`fs::canonicalize` 解析符号链接
- `cache.rs`：拒绝 `..` 和绝对路径
- FFmpeg/Whisper/Demucs/录制：均使用 `Command::new().args()` 参数数组
- WebDAV URL：强制 HTTPS（仅 localhost 允许 HTTP）
- 密钥：系统钥匙链或 AES-256-GCM 加密存储

#### S-07 [PASS] 无硬编码凭证

#### S-08 [PASS] 无 file:// 直接赋值

---

### 3.2 正确性与可靠性

#### C-01 [MEDIUM] 空 catch 块

- **文件**：`apps/desktop/src/sequence-compare/SequenceCompareDialog.tsx:44`
- **建议**：添加 `console.warn` 或注释说明原因。

#### C-02 [LOW] 录制停止双重操作

- **文件**：`apps/desktop/src-tauri/src/commands/recording.rs:stop_recording`
- **问题**：先 stdin `q\n`，再 `kill()`，再 `wait()`。`kill()` 返回错误被忽略。
- **建议**：先等待检查进程是否已退出。

#### C-03 [PASS] 命令模式

`commandManager.ts` 通过 `CommandManager` 实现所有时间线变更的命令模式，符合 AGENTS.md 要求。

#### C-04 [PASS] 资源泄漏防护

FFmpeg 子进程通过 `OnceLock<Mutex<HashMap>>` 管理，支持取消和清理。临时文件通过 RAII 模式确保失败时清理。

---

### 3.3 架构与设计

#### A-01 [GOOD] 模块边界清晰

- `packages/editor-core`：纯逻辑层，无 UI 依赖
- `packages/plugin-sdk`：插件 API 定义
- `apps/desktop`：Tauri 应用壳
- `apps/desktop/src-tauri`：Rust 后端，26 个命令模块

#### A-02 [GOOD] Tauri 桥接模式

所有 Tauri 调用均通过 `tauri-bridge.ts` 统一封装，支持 mock 注入。

#### A-03 [MEDIUM] ffmpeg-builder.ts 职责过重

- **文件**：`packages/editor-core/src/export/ffmpeg-builder.ts`（4000+ 行）
- **建议**：按职责拆分为 `video-filters.ts`、`audio-filters.ts`、`subtitle-builder.ts`、`animation-expressions.ts` 等。

#### A-04 [GOOD] 配置管理

所有配置均有 normalize 函数，输入经过边界检查和默认值回退。

---

### 3.4 代码质量

#### Q-01 [GOOD] 类型安全

- TypeScript `strict: true`，几乎无 `any` 使用
- Rust 强类型 DTO + serde 序列化

#### Q-02 [GOOD] 命名一致性

- TS：camelCase 变量，PascalCase 类型
- Rust：snake_case 变量，PascalCase 类型
- 跨语言 DTO 通过 `rename_all = "camelCase"` 桥接

#### Q-03 [LOW] 无死代码标记

扫描未发现 `TODO`、`FIXME`、`HACK`、`XXX` 标记。

#### Q-04 [GOOD] 模块大小合理（除 ffmpeg-builder.ts）

---

### 3.5 测试

#### T-01 [GOOD] 覆盖率门槛 80%

```typescript
// vitest.config.ts
thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
```

约 170 个测试文件覆盖核心模块。

#### T-02 [GOOD] E2E 测试覆盖

约 180 个 Playwright E2E 测试规格文件。

#### T-03 [GOOD] Rust 单元测试

每个 `commands/` 模块均内嵌 `#[cfg(test)] mod tests`。

#### T-04 [MEDIUM] 无 CI 自动运行测试

无 `.github/workflows` 目录。缺少 CI 意味着无自动化质量门禁。

**建议**：添加 GitHub Actions 运行 `bun run typecheck && bun run test && bun run build`。

#### T-05 [PASS] 关键路径测试确认

- `ffmpeg-builder.test.ts`、`project-migration.test.ts`、`cache-key.test.ts`、`relink-score.test.ts` 均存在。

---

### 3.6 依赖与许可证

#### D-01 [PASS] 许可证一致性（MIT）

#### D-02 [LOW] bun audit：1 个低危漏洞（esbuild）

#### D-03 [PASS] Rust 依赖无已知高危漏洞

#### D-04 [LOW] ffprobe.exe 提交到仓库

- **建议**：改为运行时检测系统 PATH。

---

### 3.7 性能

#### P-01 [GOOD] 导出异步化（spawn_blocking）

#### P-02 [GOOD] 后台任务管理（支持取消）

#### P-03 [GOOD] 无 N+1 查询（内存对象图）

#### P-04 [LOW] ffmpeg-builder.ts 编译开销

---

### 3.8 文档与开发体验

#### DOC-01 [GOOD] README 完整且与代码一致

#### DOC-02 [GOOD] AGENTS.md 27 条规则

#### DOC-03 [GOOD] 架构文档（docs/architecture.md）

#### DOC-04 [LOW] 临时文件残留

---

## 4. 可安全自动修复的小问题

| # | 问题 | 修复方式 |
|---|------|----------|
| F1 | esbuild 漏洞 | `bun update` |
| F2 | 根目录临时文件残留 | 删除 `.bak`、`-report.json`，添加到 `.gitignore` |
| F3 | 空 catch 块 | 添加 `console.warn` |
| F4 | ffprobe.exe 提交到仓库 | 从 Git 移除，添加到 `.gitignore` |

---

## 5. 漏洞扫描工具输出

### bun audit

```
bun audit v1.3.14 (0d9b296a)
esbuild >=0.27.3 <0.28.1
  workspace:@open-factory/desktop -> vite
  low: esbuild allows arbitrary file read when running the development server on Windows
  https://github.com/advisories/GHSA-g7r4-m6w7-qqqr
1 vulnerabilities (1 low)
```

### npm audit

无法运行：项目使用 bun lockfile（bun.lock），无 package-lock.json。

---

## 6. 总结

Open Factory 在安全实践上表现良好：路径校验、参数数组、密钥管理、CSP 配置、本地优先架构等关键安全措施均已到位。主要改进方向：

1. **将 `backup.rs` 的 nonce 生成改为密码学安全随机数**（H1）
2. **拆分 `ffmpeg-builder.ts`**（H2）
3. **添加 CI 流水线**（M6）
4. **将自实现密钥派生迁移到标准库**（M3）

**项目整体健康度：良好**
