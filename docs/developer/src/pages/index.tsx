import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

/**
 * Feature definitions for the homepage.
 * Each feature represents a major capability of the Open Factory platform.
 */
interface FeatureItem {
  title: string;
  icon: string;
  description: JSX.Element;
}

const FeatureList: FeatureItem[] = [
  {
    title: 'Editor Core',
    icon: '🎬',
    description: (
      <>
        强大的非线性编辑引擎，支持时间线管理、关键帧动画、多轨混音、
        AI 智能剪辑等专业级视频编辑功能。
      </>
    ),
  },
  {
    title: 'Plugin SDK',
    icon: '🔌',
    description: (
      <>
        完整的插件开发框架，提供安全沙箱、生命周期管理、
        API 访问控制和插件市场集成。
      </>
    ),
  },
  {
    title: 'CLI 工具',
    icon: '⚡',
    description: (
      <>
        命令行渲染引擎，支持批量导出、模板应用、质量分析和
        自动化工作流编排。
      </>
    ),
  },
  {
    title: '协作服务',
    icon: '🤝',
    description: (
      <>
        实时多人协作服务器，支持并发编辑、冲突解决、
        权限管理和操作同步。
      </>
    ),
  },
  {
    title: 'TypeScript SDK',
    icon: '📦',
    description: (
      <>
        用于构建 Open Factory 扩展的 TypeScript SDK，
        提供类型安全的 API 和开发工具。
      </>
    ),
  },
  {
    title: '插件市场',
    icon: '🏪',
    description: (
      <>
        插件发现、安装和管理平台，支持插件搜索、评分、
        版本管理和自动更新。
      </>
    ),
  },
];

/**
 * Feature card component displayed on the homepage.
 */
function Feature({ title, icon, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="feature-card">
        <div className="feature-card__icon">{icon}</div>
        <Heading as="h3" className="feature-card__title">
          {title}
        </Heading>
        <p className="feature-card__description">{description}</p>
      </div>
    </div>
  );
}

/**
 * Homepage header with title and call-to-action buttons.
 */
function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started"
          >
            快速开始
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="/docs/api/editor-core"
            style={{ marginLeft: '1rem' }}
          >
            API 参考
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Features section displayed below the header.
 */
function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Main homepage component.
 */
export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="首页"
      description="Open Factory 开发者文档 - 本地优先的 AI 视频编辑器"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
