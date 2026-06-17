#!/usr/bin/env bun
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPluginProject } from './create-plugin';

const name = process.argv[2];
if (!name) {
  console.error('Usage: bun create-plugin <plugin-name>');
  process.exit(1);
}

const plan = await createPluginProject(name, {
  cwd: process.cwd(),
  mkdir: (path) => mkdir(path, { recursive: true }),
  writeFile: (path, contents) => writeFile(path, contents, 'utf8')
});

console.log(`Created ${plan.pluginName} in ${resolve(process.cwd(), plan.packageName)}`);
