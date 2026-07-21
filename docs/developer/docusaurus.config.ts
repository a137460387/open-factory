import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * Docusaurus configuration for Open Factory developer documentation.
 *
 * This site documents the Open Factory video editor API, plugin SDK,
 * CLI tools, and developer guides.
 */
const config: Config = {
  title: 'Open Factory 开发者文档',
  tagline: '本地优先的 AI 视频编辑器 — 开发者 API 与插件开发指南',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://docs.open-factory.dev',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'a137460387',
  projectName: 'open-factory',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
    localeConfigs: {
      'zh-Hans': {
        htmlLang: 'zh-CN',
      },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/a137460387/open-factory/tree/main/docs/developer/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/open-factory-social-card.png',
    navbar: {
      title: 'Open Factory',
      logo: {
        alt: 'Open Factory Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: '文档',
        },
        {
          to: '/docs/api/editor-core',
          label: 'API 参考',
          position: 'left',
        },
        {
          to: '/docs/guides/plugin-development',
          label: '开发指南',
          position: 'left',
        },
        {
          href: 'https://github.com/a137460387/open-factory',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {
              label: '快速开始',
              to: '/docs/getting-started',
            },
            {
              label: 'API 参考',
              to: '/docs/api/editor-core',
            },
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/a137460387/open-factory',
            },
            {
              label: 'Issues',
              href: 'https://github.com/a137460387/open-factory/issues',
            },
          ],
        },
        {
          title: '更多',
          items: [
            {
              label: '贡献指南',
              to: '/docs/contributing',
            },
            {
              label: 'Changelog',
              href: 'https://github.com/a137460387/open-factory/blob/main/CHANGELOG.md',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Open Factory. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript', 'toml'],
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
