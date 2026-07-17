/**
 * 插件创建模块
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const VALID_TYPES = ['effect', 'export', 'workflow', 'ai-model'];

const TYPE_DESCRIPTIONS = {
  effect: '效果插件 - 视觉效果、滤镜、色彩校正',
  export: '导出插件 - 自定义导出格式、平台预设',
  workflow: '工作流插件 - 自动化任务、批量处理',
  'ai-model': 'AI 模型插件 - 智能分析、识别、生成',
};

export async function createPlugin(name, options = {}) {
  const pluginType = options.type || 'effect';
  const author = options.author || 'Developer';
  const description = options.description || `${name} 插件`;

  if (!VALID_TYPES.includes(pluginType)) {
    console.error(`错误：无效的插件类型 "${pluginType}"`);
    console.error(`有效类型：${VALID_TYPES.join(', ')}`);
    process.exit(1);
  }

  // 清理名称
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const pluginId = `com.example.${safeName}`;
  const dir = join(process.cwd(), safeName);

  console.log(`\n创建插件：${safeName}`);
  console.log(`类型：${TYPE_DESCRIPTIONS[pluginType]}`);
  console.log(`作者：${author}\n`);

  // 创建目录
  await mkdir(dir, { recursive: true });

  // 生成 plugin.json
  const manifest = {
    id: pluginId,
    name: safeName,
    version: '1.0.0',
    description,
    category: pluginType,
    author,
    permissions: getDefaultPermissions(pluginType),
    main: 'index.js',
  };
  await writeFile(join(dir, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');

  // 生成 index.js
  const indexContent = generateIndexJs(pluginId, safeName, pluginType, description, author);
  await writeFile(join(dir, 'index.js'), indexContent);

  // 生成 index.test.js
  const testContent = generateTestJs(pluginId, safeName, pluginType);
  await writeFile(join(dir, 'index.test.js'), testContent);

  // 生成 README.md
  const readmeContent = generateReadme(safeName, description, pluginType, author);
  await writeFile(join(dir, 'README.md'), readmeContent);

  console.log(`✅ 插件创建成功！\n`);
  console.log(`目录结构：`);
  console.log(`  ${safeName}/`);
  console.log(`  ├── plugin.json      插件清单`);
  console.log(`  ├── index.js         入口文件`);
  console.log(`  ├── index.test.js    单元测试`);
  console.log(`  └── README.md        说明文档\n`);
  console.log(`下一步：`);
  console.log(`  cd ${safeName}`);
  console.log(`  npm test             运行测试`);
  console.log(`  open-factory-plugin validate  验证插件`);
}

function getDefaultPermissions(type) {
  switch (type) {
    case 'effect':
      return ['read-project'];
    case 'export':
      return ['export-hook', 'read-project'];
    case 'workflow':
      return ['read-project', 'write-project'];
    case 'ai-model':
      return ['read-project', 'ai-inference'];
    default:
      return ['read-project'];
  }
}

function generateIndexJs(id, name, type, description, author) {
  const hooks = generateHooks(type);
  return `/**
 * ${name} - ${description}
 *
 * @author ${author}
 * @version 1.0.0
 */
module.exports = {
  manifest: {
    id: '${id}',
    name: '${name}',
    version: '1.0.0',
    description: '${description}',
    category: '${type}',
    author: '${author}',
    permissions: ${JSON.stringify(getDefaultPermissions(type))},
  },
  hooks: {
${hooks}
  },
};
`;
}

function generateHooks(type) {
  switch (type) {
    case 'effect':
      return `    /**
     * 导出前钩子 - 应用效果参数
     */
    onExportBefore(payload) {
      return {
        message: '${name}：效果已准备就绪',
      };
    },`;
    case 'export':
      return `    /**
     * 导出前钩子 - 添加导出参数
     */
    onExportBefore(payload) {
      return {
        message: '自定义导出已就绪',
        ffmpegArgs: [],
      };
    },`;
    case 'workflow':
      return `    /**
     * 菜单注册钩子
     */
    onMenuRegister(payload) {
      payload.menus.push({
        id: 'my-plugin.run',
        label: '运行工作流',
      });
    },

    /**
     * 导出前钩子
     */
    onExportBefore(payload) {
      const clipCount = payload.project.timeline.tracks
        .reduce((sum, t) => sum + t.clips.length, 0);
      return { message: \`处理了 \${clipCount} 个片段\` };
    },`;
    case 'ai-model':
      return `    /**
     * 导出前钩子 - AI 分析
     */
    onExportBefore(payload) {
      return {
        message: 'AI 分析完成',
      };
    },`;
    default:
      return '';
  }
}

function generateTestJs(id, name, type) {
  return `const { describe, it, expect } = require('vitest');
const plugin = require('./index');

describe('${name}', () => {
  it('应正确导出 manifest', () => {
    expect(plugin.manifest.id).toBe('${id}');
    expect(plugin.manifest.name).toBe('${name}');
    expect(plugin.manifest.version).toBe('1.0.0');
    expect(plugin.manifest.category).toBe('${type}');
  });

  it('应有必要的钩子', () => {
    expect(plugin.hooks).toBeDefined();
    ${type === 'workflow' ? "expect(typeof plugin.hooks.onMenuRegister).toBe('function');" : ''}
    ${type !== 'ai-model' ? "expect(typeof plugin.hooks.onExportBefore).toBe('function');" : ''}
  });
});
`;
}

function generateReadme(name, description, type, author) {
  return `# ${name}

${description}

## 类型

${TYPE_DESCRIPTIONS[type]}

## 作者

${author}

## 安装

将此插件目录复制到 Open Factory 的插件目录：

- Windows: \`%APPDATA%/open-factory/plugins/\`
- macOS: \`~/Library/Application Support/open-factory/plugins/\`
- Linux: \`~/.local/share/open-factory/plugins/\`

## 开发

\`\`\`bash
npm test
\`\`\`

## 许可证

MIT
`;
}
