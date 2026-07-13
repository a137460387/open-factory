# 本地化媒体管理增强：SQLite 索引 + AI 标签 + 高级检索

**日期**: 2026-07-13
**状态**: 已批准
**作者**: AI Agent
**关联 Issue**: 本地化媒体管理增强

---

## 1. 背景与动机

open-factory 是一个本地化优先的专业视频编辑器。随着项目规模增大，现有的媒体管理（基于内存 Zustand Store 和简单文件遍历）在以下场景存在瓶颈：

- **大素材库检索慢**：1000+ 媒体资产时，前端文本搜索 O(n) 遍历效率低下
- **无持久化索引**：每次打开项目都需要重新扫描文件系统
- **缺乏结构化检索**：无法按分辨率、时长、帧率等维度进行范围查询
- **手动标签繁琐**：用户需要手动为每个资产添加标签，无自动化

## 2. 设计目标

1. 引入本地 SQLite 数据库作为媒体资产持久化索引
2. 媒体导入时自动分析元数据并生成 AI 标签
3. 提供多条件组合的高级检索 UI（标签、类型、分辨率、时长范围）
4. 保持现有导入流程不变，仅在已有的 metadata 提取后追加索引写入步骤
5. 所有数据库操作在 Rust 端完成，前端通过 Tauri invoke 调用

## 3. 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   MediaBin    │  │ AdvancedSearch│  │  mediaIndex   │  │
│  │   (existing)  │  │   Panel (new) │  │  Store (new)  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│         └─────────────────┴───────────────────┘          │
│                           │                              │
│                    tauri-bridge.ts                        │
│                     (invoke 调用)                         │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────┐
│                   Tauri Rust Backend                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ media_index   │  │  auto_tag    │  │   db/mod      │  │
│  │ commands (new)│  │  engine (new)│  │   (new)       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│         └─────────────────┴───────────────────┘          │
│                           │                              │
│                    rusqlite (SQLite)                      │
│                  {app_data}/media-index.db                │
└─────────────────────────────────────────────────────────┘
```

## 4. 数据库设计

### 4.1 存储位置

数据库文件存储在 Tauri app_data_dir 下：`{app_data}/media-index.db`

每个项目文件对应一个独立的数据库实例，通过项目路径关联。

### 4.2 表结构

```sql
-- 媒体资产索引表
CREATE TABLE media_assets (
    id              TEXT PRIMARY KEY,       -- 与前端 MediaAsset.id 一致
    path            TEXT NOT NULL UNIQUE,   -- 文件绝对路径
    name            TEXT NOT NULL,          -- 文件名（不含路径）
    asset_type      TEXT NOT NULL,          -- 'video' | 'audio' | 'image'
    file_size       INTEGER,               -- 字节
    duration_ms     INTEGER,               -- 时长（毫秒）
    width           INTEGER,               -- 分辨率宽
    height          INTEGER,               -- 分辨率高
    frame_rate      REAL,                  -- 帧率
    video_codec     TEXT,                  -- 视频编解码器
    audio_codec     TEXT,                  -- 音频编解码器
    color_space     TEXT,                  -- 色彩空间
    label_color     TEXT,                  -- 标签色
    rating          INTEGER,               -- 评分 (1-5)
    flag            TEXT,                  -- 旗帜 ('green' | 'red')
    imported_at     TEXT NOT NULL,         -- ISO 8601 导入时间
    updated_at      TEXT NOT NULL,         -- ISO 8601 最后更新时间
    thumbnail_path  TEXT,                  -- 缩略图缓存路径
    proxy_path      TEXT                   -- 代理视频路径
);

-- 标签表
CREATE TABLE tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE              -- 标签名称（去重）
);

-- 资产-标签关联表
CREATE TABLE asset_tags (
    asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    source   TEXT NOT NULL DEFAULT 'auto', -- 'auto' | 'manual'
    PRIMARY KEY (asset_id, tag_id)
);

-- 全文搜索虚拟表（FTS5）
CREATE VIRTUAL TABLE media_fts USING fts5(
    name, path,
    content=media_assets,
    content_rowid=rowid
);
```

### 4.3 索引

```sql
CREATE INDEX idx_media_type ON media_assets(asset_type);
CREATE INDEX idx_media_resolution ON media_assets(width, height);
CREATE INDEX idx_media_duration ON media_assets(duration_ms);
CREATE INDEX idx_media_imported ON media_assets(imported_at);
CREATE INDEX idx_media_rating ON media_assets(rating);
CREATE INDEX idx_media_label ON media_assets(label_color);
CREATE INDEX idx_asset_tags_asset ON asset_tags(asset_id);
CREATE INDEX idx_asset_tags_tag ON asset_tags(tag_id);
```

### 4.4 迁移策略

使用版本号管理 schema 迁移：

```rust
const SCHEMA_VERSION: i32 = 1;

fn migrate(conn: &Connection) -> Result<()> {
    let current: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if current < 1 {
        conn.execute_batch(include_str!("schema_v1.sql"))?;
        conn.pragma_update(None, "user_version", 1)?;
    }
    Ok(())
}
```

## 5. AI 自动打标策略

### 5.1 触发时机

在 `analyze_media` 完成后、`extract_cover_frames` 之前，调用 `auto_tag_asset` 命令。

### 5.2 标签生成规则

```rust
fn generate_auto_tags(analysis: &MediaAnalysis) -> Vec<String> {
    let mut tags = Vec::new();

    // 分辨率标签
    if let Some(w) = analysis.width {
        if w >= 3840 { tags.push("4K".into()); }
        else if w >= 2560 { tags.push("2K".into()); }
        else if w >= 1920 { tags.push("1080p".into()); }
        else if w >= 1280 { tags.push("720p".into()); }
        else { tags.push("SD".into()); }
    }

    // 帧率标签
    if let Some(fps) = analysis.frame_rate {
        if fps >= 120.0 { tags.push("超高帧率".into()); tags.push("慢动作".into()); }
        else if fps >= 60.0 { tags.push("高帧率".into()); }
        else if fps < 24.0 { tags.push("低帧率".into()); }
    }

    // 时长标签
    if let Some(dur) = analysis.duration_ms {
        if dur < 10_000 { tags.push("短视频".into()); }
        else if dur > 1_800_000 { tags.push("长视频".into()); }
        else if dur > 600_000 { tags.push("中等视频".into()); }
    }

    // 色彩空间标签
    if let Some(ref cs) = analysis.color_space {
        if cs.contains("2020") { tags.push("HDR".into()); }
        else { tags.push("SDR".into()); }
    }

    // 媒体类型标签
    tags.push(match analysis.asset_type {
        "video" => "视频",
        "audio" => "音频",
        "image" => "图片",
        _ => "其他",
    }.into());

    // 文件名语义标签
    let name_lower = analysis.name.to_lowercase();
    if name_lower.starts_with("img_") { tags.push("照片".into()); }
    if name_lower.contains("screen") || name_lower.contains("录屏") { tags.push("录屏".into()); }
    if name_lower.contains("screenshot") { tags.push("截图".into()); }

    tags
}
```

### 5.3 标签存储

自动标签通过 `asset_tags` 表存储，`source = 'auto'`。重新导入时清除旧的自动标签并重新生成。

## 6. Tauri 命令接口

### 6.1 新增命令列表

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `init_media_index_db` | `project_path: String` | `()` | 初始化/迁移数据库 |
| `upsert_media_asset` | `asset: MediaIndexAsset` | `()` | 插入或更新资产索引 |
| `batch_upsert_media_assets` | `assets: Vec<MediaIndexAsset>` | `usize` | 批量插入/更新，返回处理数量 |
| `delete_media_asset` | `id: String` | `()` | 删除资产索引 |
| `search_media_assets` | `query: MediaSearchQuery` | `MediaSearchResult` | 多条件组合检索 |
| `auto_tag_asset` | `id: String, metadata: MediaAnalysis` | `Vec<String>` | 自动打标并入库 |
| `get_all_tags` | `()` | `Vec<TagWithCount>` | 获取所有标签及使用计数 |
| `add_manual_tag` | `asset_id: String, tag_name: String` | `()` | 手动添加标签 |
| `remove_manual_tag` | `asset_id: String, tag_name: String` | `()` | 手动移除标签 |

### 6.2 检索查询结构

```rust
#[derive(Deserialize)]
pub struct MediaSearchQuery {
    pub text: Option<String>,           // 全文搜索关键词
    pub asset_types: Option<Vec<String>>, // 类型过滤
    pub tags: Option<Vec<String>>,      // 标签过滤（AND 逻辑）
    pub min_width: Option<i32>,         // 最小宽度
    pub max_width: Option<i32>,
    pub min_height: Option<i32>,
    pub max_height: Option<i32>,
    pub min_duration_ms: Option<i64>,   // 最小时长
    pub max_duration_ms: Option<i64>,
    pub min_rating: Option<i32>,        // 最低评分
    pub label_color: Option<String>,    // 标签色
    pub flag: Option<String>,           // 旗帜
    pub sort_by: Option<String>,        // 排序字段
    pub sort_desc: Option<bool>,        // 降序
    pub page: Option<u32>,              // 页码（从1开始）
    pub page_size: Option<u32>,         // 每页数量（默认50）
}
```

## 7. 前端集成

### 7.1 Tauri Bridge 新增方法

```typescript
// tauri-bridge.ts 新增
export async function initMediaIndexDb(projectPath: string): Promise<void>
export async function upsertMediaAsset(asset: MediaIndexAsset): Promise<void>
export async function batchUpsertMediaAssets(assets: MediaIndexAsset[]): Promise<number>
export async function deleteMediaAsset(id: string): Promise<void>
export async function searchMediaAssets(query: MediaSearchQuery): Promise<MediaSearchResult>
export async function autoTagAsset(id: string, metadata: MediaAnalysis): Promise<string[]>
export async function getAllTags(): Promise<TagWithCount[]>
export async function addManualTag(assetId: string, tagName: string): Promise<void>
export async function removeManualTag(assetId: string, tagName: string): Promise<void>
```

### 7.2 Zustand Store 新增

```typescript
// mediaIndexStore.ts
interface MediaIndexState {
  // 搜索状态
  searchQuery: MediaSearchQuery
  searchResults: MediaSearchResult | null
  isSearching: boolean
  allTags: TagWithCount[]

  // 操作
  setSearchQuery: (query: Partial<MediaSearchQuery>) => void
  executeSearch: () => Promise<void>
  refreshTags: () => Promise<void>
  addTagFilter: (tag: string) => void
  removeTagFilter: (tag: string) => void
  clearFilters: () => void
}
```

### 7.3 UI 组件

**AdvancedSearchPanel.tsx** — 嵌入 MediaBin 顶部的高级检索面板：

- 搜索输入框（防抖 300ms）
- 标签云区域（标签 + 计数气泡，点击添加筛选）
- 属性筛选行：文件类型 Select + 分辨率范围 Slider + 时长范围 Slider
- 已选条件 Chips 区域（可单独移除）
- 搜索结果计数和分页控件

### 7.4 导入流程集成

在现有 `addMedia` 流程中追加索引写入：

```
现有流程：文件对话框 → 授权 → probe → analyze → integrity → cover → proxy
新增步骤：analyze 完成后 → auto_tag_asset → batch_upsert_media_assets
```

## 8. 测试策略

### 8.1 Rust 单元测试

- `db/mod.rs`: 数据库初始化、迁移、连接管理
- `commands/media_index.rs`: SQL 构建器、CRUD 操作、分页逻辑
- `commands/auto_tag.rs`: 标签生成规则覆盖所有分支

### 8.2 E2E 测试 (`media-management.spec.ts`)

- 导入测试素材 → 断言数据库包含正确元数据
- 验证 AI 标签自动生成并显示
- 使用多条件筛选 → 断言过滤结果正确
- 手动添加/移除标签 → 断言数据库更新
- 全文搜索 → 断言结果包含匹配项

## 9. 依赖变更

### Cargo.toml 新增

```toml
rusqlite = { version = "0.31", features = ["bundled"] }
```

### 无前端新增依赖

使用现有的 `@tanstack/react-virtual`、`zustand`、`lucide-react`。

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| rusqlite 编译时间增加 | CI 构建变慢 | 使用 `bundled` feature 避免系统依赖 |
| 数据库与项目文件不同步 | 索引过期 | 启动时校验路径存在性，移除无效条目 |
| FTS5 不支持中文分词 | 中文搜索不准确 | 文件名通常为英文/拼音，暂可接受；后续可引入 jieba 分词 |
| 大项目首次索引慢 | 用户体验 | 后台异步执行，显示进度条 |

## 11. 实施计划

| 阶段 | 内容 | 预估 |
|------|------|------|
| Phase 1 | Rust DB 层 + schema + 迁移 | 1h |
| Phase 2 | media_index 命令（CRUD + 检索） | 2h |
| Phase 3 | auto_tag 引擎 | 1h |
| Phase 4 | Tauri Bridge + Store | 1h |
| Phase 5 | AdvancedSearchPanel UI | 2h |
| Phase 6 | 导入流程集成 | 1h |
| Phase 7 | 单元测试 + E2E 测试 | 2h |
| Phase 8 | 类型检查 + Lint + 提交 | 1h |
