/**
 * 插件验证模块
 */

import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const VALID_CATEGORIES = ['effect', 'export', 'workflow', 'ai-model'];
const VALID_PERMISSIONS = [
  'read-project',
  'write-project',
  'read-media',
  'export-hook',
  'menu-register',
  'timeline-mutation',
  'ai-inference',
  'network-access',
];

export async function validatePlugin(pluginPath) {
  const dir = resolve(pluginPath);
  const manifestPath = join(dir, 'plugin.json');
  const indexPath = join(dir, 'index.js');

  console.log(`\n验证插件：${dir}\n`);

  const errors = [];
  const warnings = [];

  // 检查 plugin.json
  let manifest;
  try {
    const content = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  } catch (error) {
    errors.push(`无法读取 plugin.json：${error.message}`);
    printResult(errors, warnings);
    return;
  }

  // 验证必填字段
  if (!manifest.id) errors.push('缺少必填字段：id');
  if (!manifest.name) errors.push('缺少必填字段：name');
  if (!manifest.version) errors.push('缺少必填字段：version');
  if (!manifest.category) errors.push('缺少必填字段：category');

  // 验证 id 格式
  if (manifest.id && !/^[a-z][a-z0-9.-]*$/.test(manifest.id)) {
    errors.push(`id 格式无效：${manifest.id}（应使用小写字母、数字、点和连字符）`);
  }

  // 验证版本格式
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push(`版本格式无效：${manifest.version}（应使用语义化版本 x.y.z）`);
  }

  // 验证分类
  if (manifest.category && !VALID_CATEGORIES.includes(manifest.category)) {
    errors.push(`无效的分类：${manifest.category}（有效值：${VALID_CATEGORIES.join(', ')}）`);
  }

  // 验证权限
  if (Array.isArray(manifest.permissions)) {
    for (const perm of manifest.permissions) {
      if (!VALID_PERMISSIONS.includes(perm)) {
        errors.push(`无效的权限：${perm}`);
      }
    }
  }

  // 检查 index.js
  try {
    await access(indexPath);
  } catch {
    errors.push('缺少入口文件：index.js');
  }

  // 验证入口文件内容
  if (!errors.some((e) => e.includes('index.js'))) {
    try {
      const content = await readFile(indexPath, 'utf-8');

      // 检查是否导出了 manifest
      if (!content.includes('manifest')) {
        warnings.push('index.js 中未找到 manifest 导出');
      }

      // 检查是否导出了 hooks
      if (!content.includes('hooks')) {
        warnings.push('index.js 中未找到 hooks 导出');
      }

      // 检查是否包含危险代码
      const dangerousPatterns = [
        { pattern: /eval\s*\(/, name: 'eval()' },
        { pattern: /new\s+Function\s*\(/, name: 'new Function()' },
        { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, name: 'child_process' },
        { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, name: 'fs 模块（应使用插件 API）' },
      ];

      for (const { pattern, name } of dangerousPatterns) {
        if (pattern.test(content)) {
          warnings.push(`检测到潜在安全风险：${name}`);
        }
      }
    } catch (error) {
      errors.push(`读取 index.js 失败：${error.message}`);
    }
  }

  // 检查测试文件
  try {
    await access(join(dir, 'index.test.js'));
  } catch {
    warnings.push('建议添加测试文件：index.test.js');
  }

  printResult(errors, warnings);
}

function printResult(errors, warnings) {
  if (errors.length > 0) {
    console.log('❌ 验证失败：');
    for (const error of errors) {
      console.log(`  ✗ ${error}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  警告：');
    for (const warning of warnings) {
      console.log(`  ⚠ ${warning}`);
    }
  }

  if (errors.length === 0) {
    console.log('✅ 验证通过！');
  }

  console.log('');
}
