/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: '禁止循环依赖',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment: '禁止孤立模块（无引用的文件）',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(jest|vitest)\\.config\\.(js|cjs|mjs|ts)$',
          '(^|/)vite\\.config\\.(js|cjs|mjs|ts)$',
          '(^|/)eslint\\.config\\.(js|cjs|mjs|ts)$',
          '(^|/)\\.dependency-cruiser\\.cjs$',
          '__tests__/',
          '\\.test\\.ts$',
          '\\.spec\\.ts$',
        ],
      },
      to: {},
    },
    {
      name: 'no-deprecated-core',
      comment: '禁止使用已废弃的 Node.js 核心模块',
      severity: 'warn',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: ['^(punycode|domain|constants|sys|_linklist|_stream_wrap)$'],
      },
    },
    {
      name: 'not-to-deprecated',
      comment: '禁止引用已废弃的 npm 包',
      severity: 'warn',
      from: {},
      to: { dependencyTypes: ['deprecated'] },
    },
    {
      name: 'no-non-package-json',
      comment: '禁止引用未在 package.json 中声明的依赖',
      severity: 'error',
      from: { pathNot: ['__tests__/', '\\.test\\.ts$', '\\.spec\\.ts$'] },
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'not-to-unresolvable',
      comment: '禁止引用无法解析的模块',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-duplicate-dep-types',
      comment: '禁止同一依赖出现多种类型',
      severity: 'warn',
      from: {},
      to: { moreThanOneDependencyType: true },
    },
    {
      name: 'editor-core-no-desktop-import',
      comment: 'editor-core 不得引用 desktop 应用层',
      severity: 'error',
      from: { path: '^packages/editor-core/' },
      to: { path: '^apps/desktop/' },
    },
    {
      name: 'desktop-no-internal-packages',
      comment: 'desktop 不得引用其他内部包的内部实现',
      severity: 'warn',
      from: { path: '^apps/desktop/' },
      to: { path: '^packages/[^/]+/src/', pathNot: ['^packages/editor-core/src/'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
      text: { highlightFocused: true },
    },
  },
};
