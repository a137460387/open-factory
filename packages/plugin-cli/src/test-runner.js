/**
 * 插件测试运行模块
 *
 * 在隔离环境中运行插件的单元测试，支持 vitest 集成。
 */

import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * 运行插件测试套件。
 * @param {string} pluginPath - 插件目录路径
 * @param {object} options - 测试选项
 */
export async function testPlugin(pluginPath, options = {}) {
  const dir = resolve(pluginPath);
  const watch = options.watch ?? false;

  console.log(`\n🧪 插件测试运行器 - ${dir}\n`);

  // 1. 检查测试文件是否存在
  const testFiles = await findTestFiles(dir);
  if (testFiles.length === 0) {
    console.log(`⚠️  未找到测试文件`);
    console.log(`   建议创建 index.test.js 或 *.test.js 文件\n`);
    return { success: true, tests: 0, passed: 0, failed: 0, skipped: true };
  }

  console.log(`📁 发现 ${testFiles.length} 个测试文件：`);
  for (const file of testFiles) {
    console.log(`   - ${file}`);
  }

  // 2. 检查 vitest 是否可用
  const hasVitest = await checkVitest(dir);
  if (!hasVitest) {
    console.log(`\n⚠️  未找到 vitest，请先安装：npm install -D vitest\n`);
    return { success: false, error: 'vitest not found' };
  }

  // 3. 运行测试
  console.log(`\n▶️  运行测试...\n`);

  try {
    const args = ['vitest', 'run'];
    if (watch) args.pop(); // 改为 watch 模式
    if (options.coverage) args.push('--coverage');

    const result = execSync(`npx ${args.join(' ')} --reporter=verbose`, {
      cwd: dir,
      encoding: 'utf-8',
      timeout: 60_000,
      stdio: 'pipe',
    });

    console.log(result);

    // 解析结果
    const passed = (result.match(/✓/g) ?? []).length;
    const failed = (result.match(/✗|FAIL/g) ?? []).length;

    console.log(`\n✅ 测试完成: ${passed} 通过, ${failed} 失败\n`);

    return { success: failed === 0, tests: passed + failed, passed, failed };
  } catch (error) {
    // vitest 返回非零退出码时也会抛出异常
    const output = error.stdout ?? error.stderr ?? error.message;
    console.log(output);

    const passed = (output.match(/✓/g) ?? []).length;
    const failed = (output.match(/✗|FAIL/g) ?? []).length;

    console.log(`\n❌ 测试完成: ${passed} 通过, ${failed} 失败\n`);

    return { success: false, tests: passed + failed, passed, failed };
  }
}

/**
 * 查找测试文件。
 */
async function findTestFiles(dir) {
  const candidates = [
    'index.test.js',
    'index.test.ts',
    'index.spec.js',
    'index.spec.ts',
    'test.js',
    'tests.js',
  ];

  const found = [];
  for (const file of candidates) {
    try {
      await access(join(dir, file));
      found.push(file);
    } catch {
      // 文件不存在
    }
  }
  return found;
}

/**
 * 检查 vitest 是否可用。
 */
async function checkVitest(dir) {
  try {
    // 检查本地 node_modules
    await access(join(dir, 'node_modules', '.bin', 'vitest'));
    return true;
  } catch {
    // 检查全局
    try {
      execSync('npx vitest --version', { stdio: 'pipe', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}
