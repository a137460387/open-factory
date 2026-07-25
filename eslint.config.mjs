import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'apps/desktop/src-tauri/',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/__tests__/**',
      'e2e/',
    ],
  },
);
