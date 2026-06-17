import { describe, expect, it } from 'vitest';
import { createPluginProject, getScaffoldFileList, planCreatePlugin } from './create-plugin';

describe('create-plugin scaffold', () => {
  it('generates the required template file list', () => {
    const plan = planCreatePlugin('my-plugin');

    expect(getScaffoldFileList(plan)).toEqual(['index.ts', 'plugin.json', 'README.md', 'vite.config.ts']);
    expect(JSON.parse(plan.files.find((file) => file.path === 'plugin.json')!.contents)).toMatchObject({
      id: 'my.plugin',
      main: 'dist/index.js',
      dev: true
    });
  });

  it('writes the scaffold into the requested directory', async () => {
    const writes: string[] = [];
    await createPluginProject('Color Helper', {
      cwd: 'C:/Plugins',
      mkdir: (path) => writes.push(`dir:${path}`),
      writeFile: (path) => writes.push(path)
    });

    expect(writes).toEqual([
      'dir:C:/Plugins/color-helper',
      'C:/Plugins/color-helper/plugin.json',
      'C:/Plugins/color-helper/index.ts',
      'C:/Plugins/color-helper/vite.config.ts',
      'C:/Plugins/color-helper/README.md'
    ]);
  });
});
