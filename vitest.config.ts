import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@': fileURLToPath(new URL('./apps/desktop/src', import.meta.url)),
      '@open-factory/editor-core': fileURLToPath(new URL('./packages/editor-core/src', import.meta.url)),
      '@open-factory/plugin-sdk': fileURLToPath(new URL('./packages/plugin-sdk/src/index.ts', import.meta.url)),
      '@open-factory/cli': fileURLToPath(new URL('./packages/cli/src/index.ts', import.meta.url)),
      '@open-factory/auth': fileURLToPath(new URL('./packages/auth/src/index.ts', import.meta.url)),
      '@open-factory/rbac': fileURLToPath(new URL('./packages/rbac/src/index.ts', import.meta.url)),
      '@open-factory/audit-log': fileURLToPath(new URL('./packages/audit-log/src/index.ts', import.meta.url))
    }
  },
  test: {
    testTimeout: 15000,
    hookTimeout: 10000,
    include: ['packages/editor-core/__tests__/**/*.test.ts', 'packages/editor-core/src/**/*.test.ts', 'packages/plugin-sdk/__tests__/**/*.test.ts', 'packages/cli/__tests__/**/*.test.ts', 'packages/cli/src/**/*.test.ts', 'packages/sdk/__tests__/**/*.test.ts', 'packages/api-client/__tests__/**/*.test.ts', 'packages/auth/src/**/*.test.ts', 'packages/rbac/src/**/*.test.ts', 'packages/audit-log/src/**/*.test.ts', 'packages/collaboration-server/src/**/*.test.ts', 'packages/cloud-sync/src/**/*.test.ts', 'packages/plugin-market/src/**/*.test.ts', 'apps/desktop/src/**/*.test.ts', 'apps/desktop/src/**/*.test.tsx', 'apps/plugin-market/src/**/*.test.ts', 'apps/creator-dashboard/src/**/*.test.ts', 'scripts/**/*.test.mjs', 'tools/**/*.test.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'packages/editor-core/src/**/*.ts',
        'packages/cli/src/**/*.ts',
        'packages/auth/src/**/*.ts',
        'packages/rbac/src/**/*.ts',
        'packages/audit-log/src/**/*.ts',
        'packages/plugin-sdk/src/**/*.ts',
        'packages/collaboration-server/src/**/*.ts',
        'packages/cloud-sync/src/**/*.ts',
        'packages/plugin-market/src/**/*.ts',
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
        'packages/auth/src/**/*.test.ts',
        'packages/rbac/src/**/*.test.ts',
        'packages/audit-log/src/**/*.test.ts',
        'packages/collaboration-server/src/**/*.test.ts',
        'packages/plugin-market/src/**/*.test.ts',
        'apps/desktop/src/**/*.test.ts',
        'apps/desktop/src/**/*.test.tsx',
        '**/node_modules/**',
        '**/dist/**',
      ],
      reportOnFailure: true,
      thresholds: {
        lines: 75,
        functions: 78,
        branches: 75,
        statements: 75
      }
    }
  }
});
