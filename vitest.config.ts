import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/desktop/src', import.meta.url)),
      '@open-factory/editor-core': fileURLToPath(new URL('./packages/editor-core/src', import.meta.url)),
      '@open-factory/plugin-sdk': fileURLToPath(new URL('./packages/plugin-sdk/src/index.ts', import.meta.url)),
      '@open-factory/cli': fileURLToPath(new URL('./packages/cli/src/index.ts', import.meta.url))
    }
  },
  test: {
    testTimeout: 15000,
    hookTimeout: 10000,
    include: ['packages/editor-core/__tests__/**/*.test.ts', 'packages/editor-core/src/**/*.test.ts', 'packages/plugin-sdk/__tests__/**/*.test.ts', 'packages/cli/__tests__/**/*.test.ts', 'packages/cli/src/**/*.test.ts', 'packages/api-client/__tests__/**/*.test.ts', 'apps/desktop/src/**/*.test.ts', 'apps/desktop/src/**/*.test.tsx', 'apps/plugin-market/src/**/*.test.ts', 'apps/creator-dashboard/src/**/*.test.ts', 'scripts/**/*.test.mjs', 'tools/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'packages/editor-core/src/**/*.ts',
        'packages/cli/src/**/*.ts',
        'packages/plugin-sdk/src/**/*.ts',
        'apps/desktop/src/**/*.ts',
      ],
      exclude: [
        'packages/editor-core/src/index.ts',
        'packages/editor-core/src/model-types.ts',
        'packages/editor-core/src/project/project-types.ts',
        'packages/editor-core/src/proxy/proxy-types.ts',
        'packages/editor-core/src/cache/cache-types.ts',
        'packages/editor-core/src/commands/command.ts',
        'packages/editor-core/src/**/earcut.d.ts',
        'packages/editor-core/src/**/*.test.ts',
        'apps/desktop/src/**/*.test.ts',
        'apps/desktop/src/**/*.test.tsx',
        'apps/desktop/src/e2e/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
      thresholds: {
        'packages/editor-core/src/**': {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    }
  }
});
