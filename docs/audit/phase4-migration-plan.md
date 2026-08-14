# 阶段四 #10：云端包群迁移方案（方案 C）

> 状态：仅方案文档，不执行实际迁移
> 依据：docs/audit/phase4-cloud-and-endpoints.md 选项 C

---

## 待移出的 6 个包

| 包 | 文件数 | 代码行数 | 说明 |
|-----|--------|----------|------|
| packages/api-gateway | 244 | 71,983 | API 网关服务 |
| packages/auth | 10 | 736 | JWT 认证模块 |
| packages/rbac | 7 | 672 | 角色权限控制 |
| packages/audit-log | 7 | 556 | 审计日志 |
| packages/cloud-sync | 3 | 518 | 云同步 |
| packages/collaboration-server | 120 | 55,382 | 协作服务 |

**合计**：391 文件，约 129,847 行代码。

---

## 迁移步骤

### 第 1 步：创建目标仓库

1. 在 GitHub 上创建新仓库 `open-factory-cloud-services`
2. 设置仓库为 private 或 public（根据产品策略决定）
3. 配置 CI：复制现有 `.github/workflows/ci.yml` 中与这些包相关的部分

### 第 2 步：提取代码并保留 git 历史

使用 `git filter-repo` 提取子目录：

```bash
git clone https://github.com/a137460387/open-factory.git cloud-temp
cd cloud-temp
git filter-repo \
  --subdirectory-filter packages/api-gateway \
  --subdirectory-filter packages/auth \
  --subdirectory-filter packages/rbac \
  --subdirectory-filter packages/audit-log \
  --subdirectory-filter packages/cloud-sync \
  --subdirectory-filter packages/collaboration-server
```

注意：`git filter-repo` 不支持多 `--subdirectory-filter`。替代方案：

- **方案 2a（推荐）**：使用 `git subtree split` 分别提取每个包，然后在新仓库中合并
- **方案 2b**：使用 `git filter-repo --path` 多路径模式一次性提取

```bash
# 方案 2b 示例
git filter-repo \
  --path packages/api-gateway \
  --path packages/auth \
  --path packages/rbac \
  --path packages/audit-log \
  --path packages/cloud-sync \
  --path packages/collaboration-server
```

### 第 3 步：调整目录结构

迁移后，新仓库中包路径从 `packages/xxx` 变为 `xxx`（或保持 `packages/xxx`），
需要更新：
- 各包的 `package.json` 中的 `name` 字段（保持 `@open-factory/xxx` 不变）
- 包间相互引用的 import 路径
- CI 配置中的工作目录

### 第 4 步：处理 workspace 协议引用

当前 monorepo 中，这些包之间的引用使用 `workspace:*` 协议：

| 引用方 | 被引用方 | 处理方式 |
|--------|---------|---------|
| api-gateway → auth | @open-factory/auth | 新仓库中改为 `workspace:*` |
| api-gateway → rbac | @open-factory/rbac | 新仓库中改为 `workspace:*` |
| collaboration-server → auth | @open-factory/auth | 新仓库中改为 `workspace:*` |

这些引用在新仓库中继续使用 `workspace:*` 协议（因为目标包也在同一仓库中）。

### 第 5 步：处理与 editor-core 的类型依赖

部分云端包可能引用了 `@open-factory/editor-core` 中的类型（通过 `import type`）。
处理方式：

- **选项 A**：在新仓库中通过 npm 安装 `@open-factory/editor-core`（需要先发布到 npm）
- **选项 B**：将共享类型提取到独立的 `@open-factory/types` 包中
- **选项 C**：在新仓库中复制所需的类型定义（不推荐，会导致类型漂移）

推荐选项 A 或 B，取决于 editor-core 是否计划发布到 npm。

### 第 6 步：清理原仓库

1. 从原仓库中删除 6 个包的目录
2. 从根 `package.json` 的 `workspaces` 中移除对应条目
3. 更新 CI 配置，移除对这些包的 typecheck/build/test
4. 提交删除并 push

### 第 7 步：验证

- 新仓库：CI 全部通过（typecheck + build + test）
- 原仓库：CI 全部通过，无对已删除包的引用
- 原仓库 `apps/desktop` 功能不受影响（已确认零耦合）

---

## 保留在 monorepo 中的包

| 包 | 保留理由 |
|-----|---------|
| apps/plugin-market + packages/plugin-market | 插件生态与桌面应用间接相关 |
| apps/creator-dashboard + packages/creator-dashboard | 创作者面板，独立产品但暂时保留 |

---

## 工作量预估

| 步骤 | 预估时间 | 风险 |
|------|---------|------|
| 创建目标仓库 + CI | 0.5 天 | 低 |
| git filter-repo 提取历史 | 0.5 天 | 中（需验证历史完整性） |
| 调整目录结构和引用 | 0.5 天 | 低 |
| 处理 editor-core 类型依赖 | 1 天 | 中（取决于方案选择） |
| 清理原仓库 | 0.5 天 | 低 |
| 验证 | 0.5 天 | 低 |
| **合计** | **3.5 天** | |

---

## 风险点

1. **git 历史丢失**：filter-repo 操作不可逆，建议先在 clone 上操作，原仓库保留备份
2. **类型依赖断裂**：如果云端包依赖 editor-core 的类型，迁移后需要解决引用问题
3. **CI 配置遗漏**：需确保新仓库的 CI 覆盖所有必要的检查
4. **npm 发布**：如果选择方案 A（npm 安装 editor-core），需要先建立发布流程
5. **开发体验**：迁移后跨仓库的修改需要分别提交 PR，不如 monorepo 方便