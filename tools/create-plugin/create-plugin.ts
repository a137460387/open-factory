export interface PluginScaffoldPlan {
  pluginName: string;
  packageName: string;
  pluginId: string;
  files: Array<{ path: string; contents: string }>;
}

export function planCreatePlugin(rawName: string): PluginScaffoldPlan {
  const packageName = sanitizePackageName(rawName);
  const pluginId = packageName.replace(/^open-factory-plugin-/, '').replace(/-/g, '.');
  const pluginName = titleCase(packageName.replace(/^open-factory-plugin-/, '').replace(/-/g, ' '));
  return {
    pluginName,
    packageName,
    pluginId,
    files: [
      { path: 'plugin.json', contents: renderPluginJson(pluginId, pluginName) },
      { path: 'index.ts', contents: renderIndexTs(pluginId, pluginName) },
      { path: 'vite.config.ts', contents: renderViteConfig() },
      { path: 'README.md', contents: renderReadme(pluginName, pluginId) }
    ]
  };
}

export async function createPluginProject(
  rawName: string,
  {
    cwd,
    mkdir,
    writeFile
  }: {
    cwd: string;
    mkdir(path: string): Promise<void> | void;
    writeFile(path: string, contents: string): Promise<void> | void;
  }
): Promise<PluginScaffoldPlan> {
  const plan = planCreatePlugin(rawName);
  const root = `${trimTrailingSlash(cwd)}/${plan.packageName}`;
  await mkdir(root);
  for (const file of plan.files) {
    await writeFile(`${root}/${file.path}`, file.contents);
  }
  return plan;
}

export function getScaffoldFileList(plan: PluginScaffoldPlan): string[] {
  return plan.files.map((file) => file.path).sort((left, right) => left.localeCompare(right));
}

function renderPluginJson(pluginId: string, pluginName: string): string {
  return `${JSON.stringify(
    {
      id: pluginId,
      name: pluginName,
      version: '0.1.0',
      description: 'Local Open Factory plugin.',
      main: 'dist/index.js',
      dev: true,
      permissions: ['export-hook']
    },
    null,
    2
  )}\n`;
}

function renderIndexTs(pluginId: string, pluginName: string): string {
  return `import type { OpenFactoryPluginModule } from '@open-factory/plugin-sdk';

const plugin: OpenFactoryPluginModule = {
  manifest: {
    id: '${pluginId}',
    name: '${pluginName}',
    version: '0.1.0',
    permissions: ['export-hook'],
    dev: true
  },
  hooks: {
    async onExportBefore(payload) {
      await openFactory.sendMessage('${pluginId}', 'export:before', {
        outputPath: payload.outputPath
      });
    }
  }
};

export default plugin;
`;
}

function renderViteConfig(): string {
  return `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'index.ts',
      formats: ['cjs'],
      fileName: () => 'index.js'
    },
    outDir: 'dist',
    emptyOutDir: true
  }
});
`;
}

function renderReadme(pluginName: string, pluginId: string): string {
  return `# ${pluginName}

Local-first Open Factory plugin.

- Plugin ID: \`${pluginId}\`
- Entry: \`dist/index.js\`
- Development mode: enabled through \`plugin.json\`

Run \`bunx vite build --watch\` while Open Factory is open. The app reloads this plugin automatically when files in the plugin directory change.
`;
}

function sanitizePackageName(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/-+/g, '-');
  return cleaned || 'open-factory-plugin';
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function trimTrailingSlash(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/\\/g, '/');
}
