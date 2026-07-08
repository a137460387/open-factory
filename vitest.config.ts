import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/desktop/src', import.meta.url)),
      '@open-factory/editor-core': fileURLToPath(new URL('./packages/editor-core/src/index.ts', import.meta.url)),
      '@open-factory/plugin-sdk': fileURLToPath(new URL('./packages/plugin-sdk/src/index.ts', import.meta.url))
    }
  },
  test: {
    include: ['packages/editor-core/__tests__/**/*.test.ts', 'apps/desktop/src/**/*.test.ts', 'apps/desktop/src/**/*.test.tsx', 'scripts/**/*.test.mjs', 'tools/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['packages/editor-core/src/**/*.ts'],
      exclude: [
        'packages/editor-core/src/index.ts',
        'packages/editor-core/src/model-types.ts',
        'packages/editor-core/src/project/project-types.ts',
        'packages/editor-core/src/proxy/proxy-types.ts',
        'packages/editor-core/src/cache/cache-types.ts',
        'packages/editor-core/src/commands/command.ts',
        'packages/editor-core/src/**/earcut.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
