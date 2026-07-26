import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-console': 'warn',
      'no-undef': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'warn',
      'no-unreachable': 'warn',
      'no-case-declarations': 'warn',
      'no-var': 'warn',
      'no-redeclare': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-wrapper-object-types': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
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
