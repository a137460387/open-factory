# 阶段四：云端包群存废 + 端点边界调研（#10/#11）

> 调研日期：2026-08-13 | 只读分析，未做任何修改
> 强制停止点：以下仅为选项分析，最终裁决由维护者做出

---

## #10 云端包群存废调研

### 包状态一览

| 包 | 文件数 | 代码行数 | 最后 commit | 有测试 | 有构建 |
|-----|--------|----------|------------|--------|--------|
| packages/auth | 10 | 736 | 2026-07-28 | Yes | Yes |
| packages/rbac | 7 | 672 | 2026-07-28 | Yes | Yes |
| packages/api-gateway | 244 | 71,983 | 2026-08-13 | Yes | Yes |
| packages/audit-log | 7 | 556 | 2026-07-28 | Yes | Yes |
| packages/cloud-sync | 3 | 518 | 2026-07-28 | No | Yes |
| packages/collaboration-server | 120 | 55,382 | 2026-07-28 | Yes | Yes |
| packages/creator-dashboard | 240 | 68,874 | 2026-07-28 | Yes | Yes |
| apps/creator-dashboard | 28 | 1,468 | 2026-08-13 | Yes | Yes |
| apps/plugin-market | 270 | 80,163 | 2026-08-13 | Yes | Yes |

**合计**：929 文件，约 280,352 行代码。

### 与 desktop 耦合度

**零耦合。** 全仓 grep 确认：
- 9 个云端包均无任何对 `apps/desktop` 的 import
- `apps/desktop` 无任何对上述 9 个包的 import
- 这些包是完全独立的子系统，与桌面应用无代码级依赖

### 选项分析

#### 选项 A：保留为独立产品线

影响面：
- 保持现有 monorepo 结构，9 个包继续留在仓库中
- CI 需要继续为这些包运行 typecheck/build/test
- 代码量占仓库约 30%（280K / ~900K 总行数）
- 维护负担：依赖版本更新、安全漏洞修复需覆盖这些包

理由：
- 这些包是独立产品线（SaaS 后台、协作服务、插件市场），有独立的技术栈和用户群
- 代码已完成，移除后如需恢复成本高

#### 选项 B：移出到独立仓库

影响面：
- 需创建新仓库，迁移 9 个包 + 对应 CI 配置
- monorepo 减少约 280K 行代码，CI 时间缩短
- 需要处理 workspace 协议引用（如 `@open-factory/plugin-market` 被 `apps/plugin-market` 依赖）
- 共享类型（如 `packages/editor-core` 被某些云端包引用）需要改为 npm 发布或 git submodule

风险：
- 迁移过程中可能丢失 git 历史
- 跨仓库类型同步需要额外基础设施

### 逐包子选项

部分包可以考虑不同的处理方式：

| 包 | 建议 | 理由 |
|-----|------|------|
| plugin-market（apps + packages） | 保留 | 与桌面应用有间接关系（插件生态），有独立前端界面 |
| creator-dashboard（apps + packages） | 保留或移出 | 创作者面板，独立产品 |
| api-gateway + auth + rbac | 移出 | 纯 SaaS 后台基础设施，与桌面应用零关系 |
| collaboration-server | 移出 | 独立协作服务 |
| audit-log + cloud-sync | 移出 | 体量小，纯云服务 |

---

## #11 硬编码端点条款边界

### AGENTS.md 原文

> "禁止在代码中硬编码云服务端点或第三方 API 地址"
> "禁止添加用户登录/注册/认证功能"
> "禁止添加遥测数据上报或分析跟踪"
> "所有数据处理必须在本地完成，不发送到外部服务器"

### 实际硬编码端点逐条对照

#### 1. 更新器端点（updater/update-settings.ts）

```typescript
export const DEFAULT_UPDATE_ENDPOINT =
  "https://github.com/open-factory/open-factory/releases/latest/download/latest.json";
export const DEFAULT_RELEASE_NOTES_ENDPOINT =
  "https://api.github.com/repos/open-factory/open-factory/releases/latest";
```

- 功能必需性：更新检查是桌面应用的基础功能
- 是否可配置化：**已支持**。用户可通过设置面板关闭自动更新或填写自定义端点
- 条款边界：该端点仅在用户主动启用更新检查时访问，且可配置自定义端点。**属于可接受的默认值，不违反条款精神**

#### 2. AI 供应商目录（editor-core/ai-service.ts）

15 个硬编码 baseUrl：OpenAI、Anthropic、Google、DeepSeek、智谱、阿里、Moonshot、百度、讯飞、火山、Groq、Together、ElevenLabs、Ollama(localhost)

- 功能必需性：AI 功能需要知道供应商的 API 端点
- 是否可配置化：**部分支持**。用户可添加自定义供应商（`aiSettingsStore.ts` 支持 baseUrl + apiKey 自定义），但 15 个内置供应商的 URL 是硬编码的
- 条款边界：AI 功能是可选特性，用户主动选择供应商并配置 API Key 后才发起请求。内置供应商 URL 是"默认配置"而非"强制上报"。**属于灰色地带**——技术上可配置化（已有自定义供应商功能），但内置列表的 URL 没有被提取为可外部修改的配置文件

#### 3. 导出预设同步端点（export/export-presets.ts）

```typescript
const PRESET_SYNC_URL =
  "https://github.com/open-factory/open-factory/releases/latest/download/export-presets.ofpreset.json";
```

- 功能必需性：导出预设同步是可选的增强功能
- 是否可配置化：**未发现配置入口**
- 条款边界：访问 GitHub 下载预设文件，用户可选使用。**低风险**

#### 4. 翻译服务（e2e mock 中引用 DeepL/Google Translate）

- 实际生产代码中未发现硬编码翻译 API 端点
- e2e mock 中的端点仅用于测试拦截
- **不违反条款**

#### 5. 分发 OAuth

- 全仓搜索未发现硬编码 OAuth 端点
- **不违反条款**

### 端点边界总结

| 端点类型 | 文件 | 是否功能必需 | 是否可配置化 | 风险评估 |
|----------|------|------------|------------|---------|
| 更新检查 | update-settings.ts | 是 | 已支持 | 低（可关闭/自定义） |
| AI 供应商目录 | ai-service.ts | 是 | 部分支持 | 中（15 个硬编码 URL，建议提取为配置文件） |
| 导出预设同步 | export-presets.ts | 否 | 未发现 | 低（可选功能） |
| 翻译服务 | 仅在 e2e mock | N/A | N/A | 无 |
| 分发 OAuth | 未发现 | N/A | N/A | 无 |

### 建议的配置化方案（供裁决）

如果决定收紧条款执行，可以：
1. 将 ai-service.ts 中的 15 个供应商 URL 提取为 JSON 配置文件（如 `ai-providers.json`），用户可编辑
2. 将导出预设同步 URL 改为可配置项
3. 更新器端点已支持配置化，无需改动

---

## 等待裁决

以上为 #10 和 #11 的完整调研结果。需要你裁决的事项：

**#10 云端包群**：
- 选项 A：全部保留在 monorepo 中
- 选项 B：全部移出到独立仓库
- 选项 C：部分移出（如 api-gateway/auth/rbac/audit-log/cloud-sync/collaboration-server 移出，plugin-market 和 creator-dashboard 保留）

**#11 端点边界**：
- 选项 A：维持现状（现有端点均属可接受的默认配置）
- 选项 B：将 AI 供应商 URL 提取为配置文件
- 选项 C：更严格地执行——所有外部端点必须可配置且默认关闭