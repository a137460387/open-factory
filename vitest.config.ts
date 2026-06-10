import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@open-factory/editor-core': fileURLToPath(new URL('./packages/editor-core/src/index.ts', import.meta.url))
    }
  },
  test: {
    include: ['packages/editor-core/__tests__/**/*.test.ts', 'apps/desktop/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['packages/editor-core/src/**/*.ts'],
      exclude: ['packages/editor-core/src/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
