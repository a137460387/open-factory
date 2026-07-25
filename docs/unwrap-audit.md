# Rust unwrap()/expect() 审计报告

**扫描日期**: 2026-07-25
**扫描范围**: `apps/desktop/src-tauri/src/` 及 `apps/desktop/src-tauri/tests/`

## 结论

**生产代码中无 `.unwrap()` 调用** — 所有 `.unwrap()` 均位于 `#[cfg(test)]` 模块内，符合最佳实践。

## unwrap() 清单（全部在测试代码中）

| 文件 | 行号 | 上下文 | 分类 |
|------|------|--------|------|
| `zero_copy_io.rs` | 247-262 | ChunkReader 测试 | 测试代码 — 保留 |
| `db/schema.rs` | 92-129 | 数据库迁移测试 | 测试代码 — 保留 |
| `commands/ai.rs` | 499-506 | normalize_provider_id 测试 | 测试代码 — 保留 |
| `commands/backup.rs` | 596-826 | 备份功能测试 | 测试代码 — 保留 |
| `commands/ffmpeg.rs` | 4382-4540 | FFmpeg 命令解析测试 | 测试代码 — 保留 |
| `commands/hw_decode.rs` | 772-867 | 硬件解码序列化测试 | 测试代码 — 保留 |
| `commands/media_index.rs` | 537-905 | 媒体索引 CRUD 测试 | 测试代码 — 保留 |
| `commands/privacy.rs` | 213 | 隐私功能测试 | 测试代码 — 保留 |
| `commands/project_crypto.rs` | 147-198 | 加密解密测试 | 测试代码 — 保留 |
| `commands/publish.rs` | 152-180 | 发布功能测试 | 测试代码 — 保留 |
| `commands/render_preview_cache.rs` | 144-157 | 预览缓存序列化测试 | 测试代码 — 保留 |
| `commands/secrets.rs` | 133-135 | 密钥管理测试 | 测试代码 — 保留 |
| `commands/share.rs` | 306-390 | 分享打包测试 | 测试代码 — 保留 |
| `commands/shared_library.rs` | 301-340 | 共享库导入测试 | 测试代码 — 保留 |
| `commands/spatial_audio.rs` | 132-156 | 空间音频测试 | 测试代码 — 保留 |

**总计**: 65 处 `.unwrap()`，全部在测试代码中。

## 生产代码中的 expect() 审查

以下 `.expect()` 调用位于生产代码中，需要评估是否应改为错误传播：

| 文件 | 行号 | 调用 | 风险 | 建议 |
|------|------|------|------|------|
| `lib.rs` | 296 | `.expect("error while running tauri application")` | 低 — 应用入口点，panic 是合理的 | 保留 |
| `commands/demucs.rs` | 174 | `.expect("checked above")` | 中 — 依赖前置条件检查 | 考虑改为 `?` 传播 |
| `commands/transcode.rs` | 299 | `.expect("checked above")` | 中 — 依赖前置条件检查 | 考虑改为 `?` 传播 |
| `commands/project_crypto.rs` | 111 | `.expect("valid argon2 params")` | 低 — 硬编码参数，不会失败 | 保留 |
| `commands/project_crypto.rs` | 117 | `.expect("argon2 hash failed")` | 中 — 依赖系统资源 | 考虑改为错误传播 |
| `commands/visual_highlight.rs` | 226 | `.expect("peaks non-empty")` | 中 — 依赖前置条件 | 考虑改为安全访问 |

## 建议

1. **unwrap()**: 无需修改，全部在测试代码中
2. **expect()**: 生产代码中有 6 处，其中 4 处可考虑改为错误传播（demucs.rs、transcode.rs、project_crypto.rs:117、visual_highlight.rs）
3. **整体质量**: Rust 层错误处理良好，生产代码已使用 `?` 操作符和自定义错误类型
