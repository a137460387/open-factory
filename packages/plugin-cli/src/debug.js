/**
 * 插件调试模块
 *
 * 在隔离环境中加载并执行插件，检查钩子输出、权限和生命周期。
 */

import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createContext, runInNewContext } from 'node:vm';

const VALID_HOOKS = ['onClipSelected', 'onExportBefore', 'onMenuRegister'];
const VALID_PERMISSIONS = ['read-project', 'write-project', 'export-hook', 'menu-register'];

/**
 * 在沙箱中加载并调试插件。
 * @param {string} pluginPath - 插件目录路径
 * @param {object} options - 调试选项
 */
export async function debugPlugin(pluginPath, options = {}) {
  const dir = resolve(pluginPath);
  const verbose = options.verbose ?? false;

  console.log(`\n🔍 插件调试器 - ${dir}\n`);

  // 1. 加载清单
  const manifest = await loadManifest(dir);
  console.log(`📋 清单信息：`);
  console.log(`   ID:      ${manifest.id}`);
  console.log(`   名称:    ${manifest.name}`);
  console.log(`   版本:    ${manifest.version}`);
  console.log(`   分类:    ${manifest.category ?? '未指定'}`);
  console.log(`   权限:    ${(manifest.permissions ?? []).join(', ') || '无'}`);

  // 2. 加载入口文件
  const entryPath = join(dir, manifest.main ?? 'index.js');
  let source;
  try {
    source = await readFile(entryPath, 'utf-8');
  } catch (error) {
    console.error(`\n❌ 无法读取入口文件：${entryPath}`);
    console.error(`   ${error.message}`);
    return { success: false, errors: [`入口文件读取失败: ${error.message}`] };
  }

  // 3. 在沙箱中执行
  console.log(`\n⚙️  加载插件代码...`);
  const plugin = loadPluginInSandbox(source, manifest, verbose);

  if (!plugin) {
    console.error(`❌ 插件加载失败`);
    return { success: false, errors: ['沙箱加载失败'] };
  }

  // 4. 检查钩子
  console.log(`\n🪝 钩子检查：`);
  const hooks = plugin.hooks ?? {};
  const hookNames = Object.keys(hooks).filter((k) => typeof hooks[k] === 'function');
  const invalidHooks = hookNames.filter((h) => !VALID_HOOKS.includes(h));

  if (hookNames.length === 0) {
    console.log(`   ⚠️  未定义任何钩子`);
  } else {
    for (const hook of hookNames) {
      const valid = VALID_HOOKS.includes(hook);
      console.log(`   ${valid ? '✅' : '❌'} ${hook}`);
    }
  }

  if (invalidHooks.length > 0) {
    console.log(`\n   ⚠️  未知钩子（可能无效）: ${invalidHooks.join(', ')}`);
  }

  // 5. 权限检查
  console.log(`\n🔐 权限检查：`);
  const declaredPerms = manifest.permissions ?? [];
  for (const perm of declaredPerms) {
    const valid = VALID_PERMISSIONS.includes(perm);
    console.log(`   ${valid ? '✅' : '❌'} ${perm} ${valid ? '' : '(无效权限)'}`);
  }

  // 检查钩子是否需要额外权限
  const requiredPerms = new Set();
  if (hooks.onExportBefore) requiredPerms.add('export-hook');
  if (hooks.onMenuRegister) requiredPerms.add('menu-register');

  for (const perm of requiredPerms) {
    if (!declaredPerms.includes(perm)) {
      console.log(`   ⚠️  钩子需要 ${perm} 权限但未声明`);
    }
  }

  // 6. 模拟钩子执行
  console.log(`\n🧪 模拟执行：`);
  const results = {};

  if (hooks.onExportBefore) {
    try {
      const mockProject = {
        timeline: {
          tracks: [
            { type: 'video', clips: [{ id: 'c1', startTime: 0, duration: 10 }] },
            { type: 'audio', clips: [{ id: 'c2', startTime: 0, duration: 10 }] },
          ],
        },
      };
      const result = await hooks.onExportBefore({
        project: mockProject,
        outputPath: '/tmp/test-output.mp4',
      });
      console.log(`   ✅ onExportBefore → ${JSON.stringify(result)}`);
      results.onExportBefore = { success: true, result };
    } catch (error) {
      console.log(`   ❌ onExportBefore → ${error.message}`);
      results.onExportBefore = { success: false, error: error.message };
    }
  }

  if (hooks.onMenuRegister) {
    try {
      const payload = { menus: [] };
      await hooks.onMenuRegister(payload);
      console.log(`   ✅ onMenuRegister → 注册了 ${payload.menus.length} 个菜单项`);
      for (const menu of payload.menus) {
        console.log(`      - ${menu.id}: ${menu.label}`);
      }
      results.onMenuRegister = { success: true, menus: payload.menus };
    } catch (error) {
      console.log(`   ❌ onMenuRegister → ${error.message}`);
      results.onMenuRegister = { success: false, error: error.message };
    }
  }

  if (hooks.onClipSelected) {
    try {
      const result = await hooks.onClipSelected({
        clip: { id: 'test-clip', startTime: 0, duration: 5 },
      });
      console.log(`   ✅ onClipSelected → ${JSON.stringify(result)}`);
      results.onClipSelected = { success: true, result };
    } catch (error) {
      console.log(`   ❌ onClipSelected → ${error.message}`);
      results.onClipSelected = { success: false, error: error.message };
    }
  }

  // 7. 安全扫描
  console.log(`\n🛡️  安全扫描：`);
  const securityIssues = scanForSecurityIssues(source);
  if (securityIssues.length === 0) {
    console.log(`   ✅ 未发现安全风险`);
  } else {
    for (const issue of securityIssues) {
      console.log(`   ⚠️  ${issue}`);
    }
  }

  const errors = [
    ...invalidHooks.map((h) => `未知钩子: ${h}`),
    ...declaredPerms.filter((p) => !VALID_PERMISSIONS.includes(p)).map((p) => `无效权限: ${p}`),
    ...securityIssues,
  ];

  console.log(`\n${errors.length === 0 ? '✅' : '⚠️'} 调试完成\n`);

  return {
    success: errors.length === 0,
    manifest,
    hooks: hookNames,
    permissions: declaredPerms,
    results,
    errors,
    securityIssues,
  };
}

/**
 * 在 Node.js VM 沙箱中加载插件代码。
 */
function loadPluginInSandbox(source, manifest, verbose) {
  const module = { exports: {} };
  const exports = module.exports;

  // 创建受限的 globalThis
  const sandboxGlobals = {
    console: verbose ? console : { log() {}, warn() {}, error() {}, info() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
    Promise,
    Map,
    Set,
    // 插件 API mock
    openFactory: {
      getProject: async () => ({ timeline: { tracks: [] } }),
      updateProject: async () => {},
      registerMenu: async () => {},
      showToast: async () => {},
      readTextFile: async () => '',
      writeTextFile: async () => {},
      sendMessage: async () => {},
      onMessage: () => () => {},
    },
  };

  try {
    const sandbox = createContext(sandboxGlobals);
    runInNewContext(
      `"use strict";\n(function(module, exports, openFactory) { ${source} })(module, exports, openFactory);`,
      sandbox,
      { timeout: 5_000 },
    );

    const exported = module.exports && Object.keys(module.exports).length > 0 ? module.exports : undefined;
    const plugin = exported ?? sandboxGlobals.openFactory?.plugin ?? sandboxGlobals.openFactory?.plugin;
    return plugin;
  } catch (error) {
    if (verbose) {
      console.error(`   沙箱执行错误: ${error.message}`);
    }
    return null;
  }
}

/**
 * 加载插件清单文件。
 */
async function loadManifest(dir) {
  try {
    const content = await readFile(join(dir, 'plugin.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    // 尝试从 index.js 中提取
    return {
      id: 'unknown',
      name: 'unknown',
      version: '0.0.0',
    };
  }
}

/**
 * 静态安全扫描。
 */
function scanForSecurityIssues(source) {
  const issues = [];
  const patterns = [
    { pattern: /\beval\s*\(/, name: '使用 eval()' },
    { pattern: /new\s+Function\s*\(/, name: '使用 new Function()' },
    { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, name: '加载 child_process 模块' },
    { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, name: '直接加载 fs 模块（应使用插件 API）' },
    { pattern: /require\s*\(\s*['"]net['"]\s*\)/, name: '加载 net 模块' },
    { pattern: /require\s*\(\s*['"]http['"]\s*\)/, name: '加载 http 模块' },
    { pattern: /process\.env/, name: '访问 process.env' },
    { pattern: /process\.exit/, name: '调用 process.exit' },
    { pattern: /__dirname|__filename/, name: '访问文件系统路径' },
    { pattern: /\.exec\s*\(/, name: '调用 .exec()' },
  ];

  for (const { pattern, name } of patterns) {
    if (pattern.test(source)) {
      issues.push(name);
    }
  }

  return issues;
}
