/**
 * 插件哈希生成模块
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export async function hashPlugin(filePath) {
  const fullPath = resolve(filePath);

  console.log(`\n生成哈希：${fullPath}\n`);

  try {
    const content = await readFile(fullPath);
    const hash = createHash('sha256').update(content).digest('hex');

    console.log(`SHA-256: ${hash}`);
    console.log(`文件大小: ${content.length} 字节\n`);
    console.log('可用于插件市场目录条目的 sha256 字段。');

    return hash;
  } catch (error) {
    console.error(`错误：无法读取文件 - ${error.message}`);
    process.exit(1);
  }
}
