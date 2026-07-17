#!/usr/bin/env node

/**
 * Open Factory Plugin CLI
 *
 * 用法：
 *   open-factory-plugin create <name> [--type <type>]
 *   open-factory-plugin validate [path]
 *   open-factory-plugin hash [path]
 */

import { createPlugin } from './create.js';
import { validatePlugin } from './validate.js';
import { hashPlugin } from './hash.js';
import { debugPlugin } from './debug.js';
import { testPlugin } from './test-runner.js';

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
Open Factory Plugin CLI

用法：
  open-factory-plugin create <name> [options]    创建新插件
  open-factory-plugin validate [path]            验证插件
  open-factory-plugin hash [path]                生成 SHA-256 哈希
  open-factory-plugin debug [path]               调试插件（沙箱执行）
  open-factory-plugin test [path]                运行插件测试
  open-factory-plugin help                       显示帮助

选项：
  --type <type>     插件类型 (effect|export|workflow|ai-model)，默认 effect
  --author <name>   作者名称
  --desc <text>     插件描述
  --verbose         详细输出（用于 debug）
  --coverage        生成覆盖率报告（用于 test）

示例：
  open-factory-plugin create my-color-effect --type effect --author "张三"
  open-factory-plugin validate ./my-plugin
  open-factory-plugin hash ./my-plugin/index.js
  open-factory-plugin debug ./my-plugin --verbose
  open-factory-plugin test ./my-plugin
`);
}

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  switch (command) {
    case 'create': {
      const name = args[1];
      if (!name) {
        console.error('错误：请指定插件名称');
        console.error('用法：open-factory-plugin create <name>');
        process.exit(1);
      }
      const options = parseOptions(args.slice(2));
      await createPlugin(name, options);
      break;
    }

    case 'validate': {
      const path = args[1] || '.';
      await validatePlugin(path);
      break;
    }

    case 'hash': {
      const path = args[1] || './index.js';
      await hashPlugin(path);
      break;
    }

    case 'debug': {
      const path = args[1] || '.';
      const options = parseOptions(args.slice(2));
      await debugPlugin(path, { verbose: options.verbose });
      break;
    }

    case 'test': {
      const path = args[1] || '.';
      const options = parseOptions(args.slice(2));
      await testPlugin(path, { coverage: options.coverage });
      break;
    }

    default:
      console.error(`未知命令：${command}`);
      printUsage();
      process.exit(1);
  }
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      options.type = args[++i];
    } else if (args[i] === '--author' && args[i + 1]) {
      options.author = args[++i];
    } else if (args[i] === '--desc' && args[i + 1]) {
      options.description = args[++i];
    } else if (args[i] === '--verbose') {
      options.verbose = true;
    } else if (args[i] === '--coverage') {
      options.coverage = true;
    }
  }
  return options;
}

main().catch((error) => {
  console.error('错误：', error.message);
  process.exit(1);
});
