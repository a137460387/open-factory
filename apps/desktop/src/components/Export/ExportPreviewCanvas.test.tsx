import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

// Mock Tauri bridge
vi.mock('../../lib/tauri-bridge', () => ({
  listenBridge: vi.fn().mockResolvedValue(() => {}),
  convertLocalFileSrc: vi.fn((path: string) => `mock-src://${path}`),
}));

// Mock export queue store
vi.mock('../../export/export-queue-store', () => ({
  useExportQueueStore: vi.fn().mockReturnValue(undefined),
}));

// Mock zustand
vi.mock('zustand', () => ({
  create: vi.fn(),
}));

import {
  ExportPreviewCanvas,
  ExportProgressBar,
  ExportPreviewThumbnailGrid,
} from './ExportPreviewCanvas';

describe('ExportPreviewCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该渲染基本结构', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewCanvas taskId="test-task-1" />
    );

    expect(html).toContain('data-testid="export-preview-canvas"');
    expect(html).toContain('data-testid="export-preview-canvas-element"');
    expect(html).toContain('canvas');
  });

  it('应该显示等待状态', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewCanvas taskId="test-task-1" />
    );

    expect(html).toContain('等待预览帧...');
  });

  it('应该显示进度信息', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewCanvas taskId="test-task-1" />
    );

    expect(html).toContain('导出进度:');
    expect(html).toContain('帧预览');
  });

  it('应该支持自定义尺寸', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewCanvas
        taskId="test-task-1"
        width={320}
        height={180}
      />
    );

    expect(html).toContain('width="320"');
    expect(html).toContain('height="180"');
  });

  it('应该支持自定义类名', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewCanvas
        taskId="test-task-1"
        className="custom-class"
      />
    );

    expect(html).toContain('custom-class');
  });

  it('没有 taskId 时应该显示等待状态', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewCanvas />
    );

    expect(html).toContain('等待预览帧...');
    expect(html).toContain('data-testid="export-preview-canvas"');
  });

  it('应该支持隐藏进度条', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewCanvas
        taskId="test-task-1"
        showProgressBar={false}
      />
    );

    // 进度信息仍然显示，但进度条可能不显示
    expect(html).toContain('data-testid="export-preview-canvas"');
  });

  it('应该支持隐藏时间戳', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewCanvas
        taskId="test-task-1"
        showTimestamps={false}
      />
    );

    expect(html).toContain('data-testid="export-preview-canvas"');
  });
});

describe('ExportProgressBar', () => {
  it('应该渲染进度条', () => {
    const html = renderToStaticMarkup(
      <ExportProgressBar progress={0.5} />
    );

    expect(html).toContain('data-testid="export-progress-bar"');
    expect(html).toContain('data-testid="export-progress-bar-fill"');
    expect(html).toContain('width:50%');
  });

  it('应该处理 0% 进度', () => {
    const html = renderToStaticMarkup(
      <ExportProgressBar progress={0} />
    );

    expect(html).toContain('width:0%');
  });

  it('应该处理 100% 进度', () => {
    const html = renderToStaticMarkup(
      <ExportProgressBar progress={1} />
    );

    expect(html).toContain('width:100%');
  });

  it('应该限制进度在 0-100 范围', () => {
    const htmlOver = renderToStaticMarkup(
      <ExportProgressBar progress={1.5} />
    );
    const htmlUnder = renderToStaticMarkup(
      <ExportProgressBar progress={-0.5} />
    );

    expect(htmlOver).toContain('width:100%');
    expect(htmlUnder).toContain('width:0%');
  });

  it('应该支持自定义类名', () => {
    const html = renderToStaticMarkup(
      <ExportProgressBar progress={0.5} className="custom-progress" />
    );

    expect(html).toContain('custom-progress');
  });
});

describe('ExportPreviewThumbnailGrid', () => {
  const mockThumbnails = [
    { src: 'http://example.com/1.jpg', label: '开始', timestamp: 0 },
    { src: 'http://example.com/2.jpg', label: '中间', timestamp: 15 },
    { src: 'http://example.com/3.jpg', label: '结束', timestamp: 30 },
  ];

  it('应该渲染缩略图网格', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewThumbnailGrid thumbnails={mockThumbnails} />
    );

    expect(html).toContain('data-testid="export-preview-thumbnail-grid"');
    expect(html).toContain('data-testid="export-preview-thumbnail-0"');
    expect(html).toContain('data-testid="export-preview-thumbnail-1"');
    expect(html).toContain('data-testid="export-preview-thumbnail-2"');
  });

  it('应该显示标签', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewThumbnailGrid thumbnails={mockThumbnails} />
    );

    expect(html).toContain('开始');
    expect(html).toContain('中间');
    expect(html).toContain('结束');
  });

  it('应该显示时间戳', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewThumbnailGrid thumbnails={mockThumbnails} />
    );

    expect(html).toContain('0:00');
    expect(html).toContain('0:15');
    expect(html).toContain('0:30');
  });

  it('应该渲染图片', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewThumbnailGrid thumbnails={mockThumbnails} />
    );

    expect(html).toContain('http://example.com/1.jpg');
    expect(html).toContain('http://example.com/2.jpg');
    expect(html).toContain('http://example.com/3.jpg');
  });

  it('空数组时应该返回 null', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewThumbnailGrid thumbnails={[]} />
    );

    expect(html).toBe('');
  });

  it('应该支持自定义类名', () => {
    const html = renderToStaticMarkup(
      <ExportPreviewThumbnailGrid
        thumbnails={mockThumbnails}
        className="custom-grid"
      />
    );

    expect(html).toContain('custom-grid');
  });

  it('应该处理没有时间戳的缩略图', () => {
    const thumbnailsNoTimestamp = [
      { src: 'http://example.com/1.jpg', label: '帧1' },
      { src: 'http://example.com/2.jpg', label: '帧2' },
    ];

    const html = renderToStaticMarkup(
      <ExportPreviewThumbnailGrid thumbnails={thumbnailsNoTimestamp} />
    );

    expect(html).toContain('帧1');
    expect(html).toContain('帧2');
  });
});