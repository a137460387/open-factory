# Open Factory 插件发布指南

本指南帮助开发者创建、测试和发布 Open Factory 插件到插件市场。

## 目录

1. [快速开始](#快速开始)
2. [插件架构](#插件架构)
3. [开发插件](#开发插件)
4. [测试插件](#测试插件)
5. [发布到市场](#发布到市场)
6. [安全规范](#安全规范)
7. [最佳实践](#最佳实践)

## 快速开始

### 使用脚手架创建插件

```bash
# 全局安装插件 CLI
npm install -g @open-factory/plugin-cli

# 创建新插件
open-factory-plugin create my-plugin

# 进入插件目录
cd my-plugin

# 安装依赖
npm install

# 运行测试
npm test

# 构建插件
npm run build
```

### 手动创建插件

1. 创建项目目录
2. 创建 `plugin.json` 清单文件
3. 创建 `index.js` 入口文件
4. 编写测试
5. 发布

## 插件架构

### 插件类型

Open Factory 支持四种插件类型：

| 类型 | 说明 | 典型用途 |
|------|------|----------|
| `effect` | 效果插件 | 视觉效果、滤镜、色彩校正 |
| `export` | 导出插件 | 自定义导出格式、平台预设 |
| `workflow` | 工作流插件 | 自动化任务、批量处理 |
| `ai-model` | AI 模型插件 | 智能分析、识别、生成 |

### 钩子系统

插件通过钩子与主程序交互：

```typescript
interface PluginHooks {
  onClipSelected?(payload: { clip?: Clip }): unknown;
  onExportBefore?(payload: { project: Project; outputPath: string }): unknown;
  onMenuRegister?(payload: { menus: PluginMenuItem[] }): unknown;
}
```

### 权限系统

插件需要声明所需权限：

| 权限 | 说明 |
|------|------|
| `read-project` | 读取项目数据 |
| `write-project` | 修改项目数据 |
| `read-media` | 读取媒体文件 |
| `export-hook` | 注册导出钩子 |
| `menu-register` | 注册菜单项 |
| `timeline-mutation` | 修改时间线 |
| `ai-inference` | AI 推理 |
| `network-access` | 网络访问 |

## 开发插件

### 清单文件 (plugin.json)

```json
{
  "id": "com.example.my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "description": "插件功能描述",
  "category": "effect",
  "author": "开发者名称",
  "homepage": "https://github.com/example/my-plugin",
  "permissions": ["read-project"],
  "main": "index.js",
  "minAppVersion": "4.35.0"
}
```

**字段说明：**

- `id`: 唯一标识符，建议使用反向域名格式
- `name`: 显示名称
- `version`: 语义化版本号
- `description`: 简短描述（建议 100 字以内）
- `category`: 插件类型
- `permissions`: 所需权限列表
- `main`: 入口文件路径（相对于插件根目录）
- `minAppVersion`: 最低支持的 Open Factory 版本

### 入口文件 (index.js)

```javascript
module.exports = {
  manifest: {
    id: 'com.example.my-plugin',
    name: '我的插件',
    version: '1.0.0',
    permissions: ['read-project'],
  },
  hooks: {
    onExportBefore(payload) {
      const clipCount = payload.project.timeline.tracks
        .reduce((sum, t) => sum + t.clips.length, 0);
      return { message: `处理了 ${clipCount} 个片段` };
    },
  },
};
```

### TypeScript 开发

推荐使用 TypeScript 开发插件：

```typescript
import type { PluginHooks } from '@open-factory/plugin-sdk';

const hooks: PluginHooks = {
  onExportBefore(payload) {
    // 类型安全的代码
    return { message: '完成' };
  },
};

export default { manifest, hooks };
```

## 测试插件

### 单元测试

```javascript
const { describe, it, expect } = require('vitest');
const plugin = require('./index');

describe('我的插件', () => {
  it('应正确导出 manifest', () => {
    expect(plugin.manifest.id).toBe('com.example.my-plugin');
  });

  it('应有 onExportBefore 钩子', () => {
    expect(typeof plugin.hooks.onExportBefore).toBe('function');
  });
});
```

### 集成测试

1. 将插件复制到 `{appDataDir}/plugins/`
2. 启动 Open Factory
3. 在设置 → 插件中确认插件已加载
4. 触发相关功能验证插件行为

### 测试覆盖率

目标覆盖率：80% 以上

```bash
vitest run --coverage
```

## 发布到市场

### 发布流程

1. **准备发布**
   ```bash
   # 验证插件
   open-factory-plugin validate

   # 生成 SHA-256 哈希
   open-factory-plugin hash
   ```

2. **提交到市场仓库**
   - Fork [open-factory-plugins](https://github.com/open-factory/open-factory-plugins) 仓库
   - 在 `catalog/` 目录下创建插件条目
   - 提交 Pull Request

3. **市场条目格式**
   ```json
   {
     "id": "com.example.my-plugin",
     "name": "我的插件",
     "author": "开发者名称",
     "version": "1.0.0",
     "description": "插件描述",
     "category": "effect",
     "permissions": ["read-project"],
     "downloadUrl": "https://releases.example.com/my-plugin/1.0.0/index.js",
     "sha256": "a1b2c3d4...",
     "tags": ["color", "filter"],
     "homepage": "https://github.com/example/my-plugin",
     "minAppVersion": "4.35.0"
   }
   ```

4. **审核流程**
   - 自动验证：SHA-256 哈希、权限声明、语法检查
   - 人工审核：代码安全性、功能正确性
   - 审核通过后自动发布

### 版本更新

更新插件版本时：

1. 更新 `plugin.json` 中的 `version`
2. 更新 `index.js` 中的 `manifest.version`
3. 重新生成 SHA-256 哈希
4. 提交 PR 更新市场条目

## 安全规范

### 必须遵守

- ✅ 只请求必要的权限
- ✅ 不收集用户数据
- ✅ 不执行远程代码
- ✅ 不访问未经授权的文件系统
- ✅ 不修改系统设置

### 禁止行为

- ❌ 包含恶意代码
- ❌ 窃取用户信息
- ❌ 挖矿或消耗计算资源
- ❌ 弹出广告或推广内容
- ❌ 绕过权限检查

### 代码审查

市场审核将检查：

1. **静态分析**：检测潜在的安全风险
2. **权限验证**：确认声明权限与实际使用一致
3. **依赖检查**：确保第三方依赖安全
4. **行为测试**：验证插件功能符合描述

## 最佳实践

### 性能优化

- 使用异步操作处理耗时任务
- 避免在钩子中执行长时间阻塞操作
- 合理使用缓存减少重复计算

### 用户体验

- 提供清晰的错误提示
- 支持国际化（i18n）
- 遵循 Open Factory 的设计规范

### 代码质量

- 编写单元测试（覆盖率 80%+）
- 使用 ESLint 检查代码风格
- 添加 JSDoc 注释

### 发布频率

- 语义化版本：MAJOR.MINOR.PATCH
- 重大更新前发布 beta 版本
- 及时修复安全漏洞

## 常见问题

### Q: 插件不显示在市场中？

A: 检查：
1. `plugin.json` 格式是否正确
2. `id` 是否唯一
3. `sha256` 是否匹配
4. PR 是否通过自动验证

### Q: 插件安装后无法加载？

A: 检查：
1. 权限声明是否正确
2. 入口文件路径是否正确
3. JavaScript 语法是否正确
4. 查看控制台错误信息

### Q: 如何调试插件？

A: 
1. 使用 `dev: true` 标记开发模式插件
2. 查看开发者工具控制台
3. 使用 `plugin.log` 输出调试信息

## 相关资源

- [插件 SDK 文档](../packages/plugin-sdk/README.md)
- [示例插件](../examples/plugins/)
- [API 参考](./plugin-api-reference.md)
- [社区论坛](https://community.open-factory.dev)

## 许可证

插件开发遵循 MIT 许可证。
