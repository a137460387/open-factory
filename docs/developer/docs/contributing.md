---
sidebar_position: 4
---

# 贡献指南

感谢你对 Open Factory 项目的兴趣！本指南将帮助你了解如何参与项目开发。

## 开发环境

### 系统要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18.0 | JavaScript 运行时 |
| Bun | >= 1.3 | 包管理器和运行时 |
| Rust | >= 1.77 | Tauri 桌面应用 |
| Git | >= 2.0 | 版本控制 |

### 克隆与安装

```bash
# Fork 并克隆仓库
git clone https://github.com/YOUR_USERNAME/open-factory.git
cd open-factory

# 添加上游远程
git remote add upstream https://github.com/a137460387/open-factory.git

# 安装依赖
bun install

# 验证环境
bun run typecheck
bun run test
```

## 项目结构

```
open-factory/
├── apps/
│   └── desktop/          # Tauri 桌面应用
├── packages/
│   ├── editor-core/      # 编辑器核心引擎
│   ├── plugin-sdk/       # 插件开发 SDK
│   ├── cli/              # 命令行工具
│   ├── collaboration-server/  # 协作服务器
│   ├── plugin-market/    # 插件市场
│   └── plugin-cli/       # 插件脚手架
├── docs/                 # 项目文档
├── tests/                # 集成测试
├── tools/                # 开发工具
└── scripts/              # 构建脚本
```

## 开发工作流

### 1. 创建分支

```bash
# 同步上游
git fetch upstream
git checkout main
git merge upstream/main

# 创建功能分支
git checkout -b feature/my-feature

# 或 Bug 修复分支
git checkout -b fix/my-bugfix
```

### 2. 开发

```bash
# 启动开发模式
bun run dev

# 类型检查（持续运行）
bun run typecheck

# 运行测试（持续运行）
bun run test
```

### 3. 提交

遵循约定式提交格式：

```bash
# 提交信息格式
git commit -m "feat: add new timeline feature"
git commit -m "fix: resolve clip splitting issue"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for keyframes"
git commit -m "refactor: simplify color grading module"
git commit -m "chore: update dependencies"
```

**提交类型：**

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `test` | 测试相关 |
| `refactor` | 代码重构 |
| `perf` | 性能优化 |
| `chore` | 构建/工具变更 |
| `ci` | CI/CD 配置 |

### 4. 推送与 PR

```bash
# 推送分支
git push origin feature/my-feature

# 创建 Pull Request
# 在 GitHub 上创建 PR，填写模板
```

## 编码规范

### TypeScript

```typescript
// 使用明确的类型注解
function processClip(clip: Clip, options: ProcessOptions): ProcessResult {
  // ...
}

// 使用 interface 定义对象形状
interface ProcessOptions {
  quality: 'low' | 'medium' | 'high';
  timeout: number;
}

// 使用 type 定义联合类型和工具类型
type ClipType = 'video' | 'audio' | 'image';
type PartialClip = Partial<Clip>;
```

### 不可变性

```typescript
// 错误：直接修改对象
clip.start = 5;

// 正确：创建新对象
const updatedClip = { ...clip, start: 5 };

// 错误：修改数组
clips.push(newClip);

// 正确：创建新数组
const updatedClips = [...clips, newClip];
```

### 错误处理

```typescript
// 显式处理错误
async function loadProject(id: string): Promise<Project> {
  try {
    const data = await fetchProjectData(id);
    return validateProject(data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new Error(`Project ${id} not found`);
    }
    throw error;
  }
}
```

### 命名规范

```typescript
// 变量和函数：camelCase
const clipDuration = 5.0;
function findClipAtTime(time: number): Clip | undefined { }

// 布尔值：is/has/should 前缀
const isSelected = true;
const hasEffects = false;

// 接口和类型：PascalCase
interface TimelineTrack { }
type TrackType = 'video' | 'audio';

// 常量：UPPER_SNAKE_CASE
const MAX_ZOOM_LEVEL = 10;
const DEFAULT_FPS = 30;
```

## 测试

### 测试要求

- 新功能必须包含测试
- Bug 修复必须包含回归测试
- 测试覆盖率目标：80%+

### 运行测试

```bash
# 运行所有测试
bun run test

# 运行特定包的测试
bun run test --filter editor-core

# 运行带覆盖率的测试
bun run test --coverage

# 运行 E2E 测试
bun run e2e
```

### 编写测试

```typescript
import { describe, it, expect } from 'vitest';
import { splitClip, findClipAtTime } from '../src/timeline';

describe('Timeline Operations', () => {
  describe('splitClip', () => {
    it('should split clip at specified time', () => {
      const clip = createTestClip({ start: 0, duration: 10 });
      const [left, right] = splitClip(clip, 5);

      expect(left.duration).toBe(5);
      expect(right.duration).toBe(5);
      expect(left.start).toBe(0);
      expect(right.start).toBe(5);
    });

    it('should throw for invalid split time', () => {
      const clip = createTestClip({ start: 0, duration: 10 });

      expect(() => splitClip(clip, 0)).toThrow(RangeError);
      expect(() => splitClip(clip, 10)).toThrow(RangeError);
    });
  });

  describe('findClipAtTime', () => {
    it('should find clip at given time', () => {
      const track = createTestTrack([
        { start: 0, duration: 5 },
        { start: 5, duration: 5 },
      ]);

      expect(findClipAtTime(track, 3)?.id).toBe('clip-1');
      expect(findClipAtTime(track, 7)?.id).toBe('clip-2');
      expect(findClipAtTime(track, 10)).toBeUndefined();
    });
  });
});
```

## 提交 Pull Request

### PR 模板

```markdown
## 描述

简要描述此 PR 的目的和实现方式。

## 变更类型

- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能优化
- [ ] 测试相关

## 测试

- [ ] 已添加/更新单元测试
- [ ] 已通过所有现有测试
- [ ] 已手动测试关键路径

## 截图（如适用）

## 相关 Issue

Closes #123
```

### PR 检查清单

- [ ] 代码符合项目编码规范
- [ ] 已添加必要的测试
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] 已更新相关文档
- [ ] 提交信息符合约定式提交格式
- [ ] 没有硬编码的密钥或敏感信息
- [ ] 没有遗留的 `console.log` 或调试代码

## 代码审查

### 审查重点

1. **正确性** — 代码是否正确实现了预期功能
2. **安全性** — 是否存在安全漏洞
3. **性能** — 是否有性能问题
4. **可读性** — 代码是否易于理解
5. **测试** — 测试是否充分

### 审查流程

1. 阅读 PR 描述和相关 Issue
2. 审查代码变更
3. 运行测试验证
4. 提供建设性反馈
5. 批准或请求修改

## 发布流程

### 版本号

遵循语义化版本：

- **MAJOR** — 不兼容的 API 变更
- **MINOR** — 向后兼容的功能添加
- **PATCH** — 向后兼容的 Bug 修复

### 发布步骤

```bash
# 更新版本号
bun run version patch  # 或 minor, major

# 更新 CHANGELOG
bun run changelog

# 提交版本变更
git add .
git commit -m "chore: release v4.x.x"

# 创建标签
git tag v4.x.x

# 推送
git push origin main --tags
```

## 获取帮助

- **GitHub Issues** — 报告 Bug 或请求功能
- **GitHub Discussions** — 提问和讨论
- **文档** — 查阅项目文档

## 行为准则

请遵守项目的 [行为准则](https://github.com/a137460387/open-factory/blob/main/CODE_OF_CONDUCT.md)，保持友善和专业的交流环境。
