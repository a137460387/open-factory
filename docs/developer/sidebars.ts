import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Sidebar configuration for Open Factory developer documentation.
 *
 * This defines the navigation structure for all documentation pages,
 * organized by topic: getting started, API references, guides, and contributing.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'getting-started',
      label: '快速开始',
    },
    {
      type: 'category',
      label: 'API 参考',
      collapsed: false,
      items: [
        'api/editor-core',
        'api/plugin-sdk',
        'api/cli',
        'api/sdk',
      ],
    },
    {
      type: 'category',
      label: '开发指南',
      collapsed: false,
      items: [
        'guides/plugin-development',
        'guides/collaboration',
        'guides/workflow-nodes',
      ],
    },
    {
      type: 'doc',
      id: 'contributing',
      label: '贡献指南',
    },
  ],
};

export default sidebars;
