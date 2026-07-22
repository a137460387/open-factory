import { describe, it, expect } from 'vitest';
import {
  createInitialResourcePanelState,
  resourcePanelReducer,
  getTotalReclaimableSpace,
  getProxyStats,
  getRiskColor,
  getRiskLabel,
  getRecommendationTypeLabel,
  formatFileSize,
  formatDate,
} from '../../src/resources/resource-panel';
import type {
  ResourceReport,
  ResourceStats,
  CleanupRecommendation,
  ProxyFile,
} from '../../src/resources/types';

function makeRecommendation(overrides: Partial<CleanupRecommendation> = {}): CleanupRecommendation {
  return {
    id: 'rec-1',
    type: 'cache-expired',
    files: ['file-1'],
    totalSize: 1024,
    description: '过期缓存',
    risk: 'low',
    autoCleanable: true,
    ...overrides,
  };
}

function makeStats(): ResourceStats {
  return {
    totalFiles: 10,
    totalSize: 10240,
    byType: {} as never,
    byStatus: {} as never,
    proxyCount: 2,
    proxySize: 2048,
    cacheSize: 1024,
    duplicateCount: 1,
  } as ResourceStats;
}

function makeProxy(overrides: Partial<ProxyFile> = {}): ProxyFile {
  return {
    id: 'proxy-1',
    originalId: 'file-1',
    originalPath: '/original.mp4',
    proxyPath: '/proxy.mp4',
    width: 640,
    height: 360,
    bitrate: 1000000,
    size: 1024,
    status: 'ready',
    progress: 100,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('resource-panel: 初始状态', () => {
  it('createInitialResourcePanelState 返回 idle 相位', () => {
    const state = createInitialResourcePanelState();
    expect(state.phase).toBe('idle');
    expect(state.activeTab).toBe('overview');
    expect(state.scanProgress).toBe(0);
    expect(state.currentStep).toBe('');
    expect(state.error).toBeUndefined();
    expect(state.selectedRecommendationId).toBeUndefined();
  });

  it('初始集合为空', () => {
    const state = createInitialResourcePanelState();
    expect(state.files).toEqual([]);
    expect(state.proxies).toEqual([]);
    expect(state.duplicates).toEqual([]);
    expect(state.cacheEntries).toEqual([]);
    expect(state.recommendations).toEqual([]);
    expect(state.stats).toBeUndefined();
  });

  it('初始 config 来自 DEFAULT_RESOURCE_CONFIG', () => {
    const state = createInitialResourcePanelState();
    expect(state.config).toBeDefined();
    expect(state.config.proxy.width).toBe(640);
  });
});

describe('resource-panel: reducer 状态转换', () => {
  it('START_SCAN 进入 scanning 相位', () => {
    const state = resourcePanelReducer(createInitialResourcePanelState(), { type: 'START_SCAN' });
    expect(state.phase).toBe('scanning');
    expect(state.scanProgress).toBe(0);
    expect(state.currentStep).toBe('开始扫描...');
    expect(state.error).toBeUndefined();
  });

  it('UPDATE_SCAN_PROGRESS 更新进度', () => {
    let state = resourcePanelReducer(createInitialResourcePanelState(), { type: 'START_SCAN' });
    state = resourcePanelReducer(state, { type: 'UPDATE_SCAN_PROGRESS', progress: 75, step: '分析重复文件' });
    expect(state.scanProgress).toBe(75);
    expect(state.currentStep).toBe('分析重复文件');
  });

  it('SCAN_COMPLETE 设置统计和推荐', () => {
    const report: ResourceReport = {
      timestamp: Date.now(),
      stats: makeStats(),
      recommendations: [makeRecommendation({ id: 'r1', totalSize: 500 })],
      proxyStats: { total: 2, ready: 1, generating: 1, failed: 0 },
    };
    let state = resourcePanelReducer(createInitialResourcePanelState(), { type: 'START_SCAN' });
    state = resourcePanelReducer(state, { type: 'SCAN_COMPLETE', report });

    expect(state.phase).toBe('complete');
    expect(state.scanProgress).toBe(100);
    expect(state.currentStep).toBe('扫描完成');
    expect(state.stats).toBe(report.stats);
    expect(state.recommendations).toHaveLength(1);
  });

  it('SCAN_ERROR 设置错误', () => {
    let state = resourcePanelReducer(createInitialResourcePanelState(), { type: 'START_SCAN' });
    state = resourcePanelReducer(state, { type: 'SCAN_ERROR', error: '扫描失败' });
    expect(state.phase).toBe('error');
    expect(state.error).toBe('扫描失败');
  });

  it('SET_TAB 切换标签页', () => {
    const state = resourcePanelReducer(createInitialResourcePanelState(), { type: 'SET_TAB', tab: 'proxies' });
    expect(state.activeTab).toBe('proxies');
  });

  it('UPDATE_CONFIG 合并配置', () => {
    const state = resourcePanelReducer(createInitialResourcePanelState(), {
      type: 'UPDATE_CONFIG',
      config: { proxy: { width: 1280, height: 720, bitrate: 2000000, codec: 'h264', enabled: true, autoGenerate: false, generateThreshold: 0 } } as never,
    });
    expect(state.config.proxy.width).toBe(1280);
  });

  it('SELECT_RECOMMENDATION 设置选中', () => {
    let state = resourcePanelReducer(createInitialResourcePanelState(), {
      type: 'SELECT_RECOMMENDATION',
      id: 'rec-5',
    });
    expect(state.selectedRecommendationId).toBe('rec-5');

    state = resourcePanelReducer(state, { type: 'SELECT_RECOMMENDATION', id: undefined });
    expect(state.selectedRecommendationId).toBeUndefined();
  });

  it('GENERATE_PROXY 添加生成中的代理', () => {
    const state = resourcePanelReducer(createInitialResourcePanelState(), {
      type: 'GENERATE_PROXY',
      fileId: 'file-9',
    });
    expect(state.proxies).toHaveLength(1);
    expect(state.proxies[0].status).toBe('generating');
    expect(state.proxies[0].originalId).toBe('file-9');
    expect(state.proxies[0].id).toBe('proxy-file-9');
  });

  it('PROXY_GENERATED 更新已完成的代理', () => {
    let state = resourcePanelReducer(createInitialResourcePanelState(), { type: 'GENERATE_PROXY', fileId: 'file-1' });
    const readyProxy = makeProxy({ originalId: 'file-1', status: 'ready', size: 2048 });
    state = resourcePanelReducer(state, { type: 'PROXY_GENERATED', proxy: readyProxy });

    expect(state.proxies[0].status).toBe('ready');
    expect(state.proxies[0].size).toBe(2048);
  });

  it('CLEANUP_RECOMMENDATION 移除指定推荐', () => {
    let state = resourcePanelReducer(createInitialResourcePanelState(), {
      type: 'SCAN_COMPLETE',
      report: { timestamp: 0, stats: makeStats(), recommendations: [makeRecommendation({ id: 'r1' }), makeRecommendation({ id: 'r2' })], proxyStats: { total: 0, ready: 0, generating: 0, failed: 0 } },
    });
    state = resourcePanelReducer(state, { type: 'CLEANUP_RECOMMENDATION', id: 'r1' });
    expect(state.recommendations).toHaveLength(1);
    expect(state.recommendations[0].id).toBe('r2');
  });

  it('CLEANUP_COMPLETE 移除选中的推荐并清除选择', () => {
    let state = resourcePanelReducer(createInitialResourcePanelState(), {
      type: 'SCAN_COMPLETE',
      report: { timestamp: 0, stats: makeStats(), recommendations: [makeRecommendation({ id: 'r1' }), makeRecommendation({ id: 'r2' })], proxyStats: { total: 0, ready: 0, generating: 0, failed: 0 } },
    });
    state = resourcePanelReducer(state, { type: 'SELECT_RECOMMENDATION', id: 'r1' });
    state = resourcePanelReducer(state, { type: 'CLEANUP_COMPLETE', freedSpace: 1024 });

    expect(state.recommendations).toHaveLength(1);
    expect(state.recommendations[0].id).toBe('r2');
    expect(state.selectedRecommendationId).toBeUndefined();
  });

  it('RESET 恢复初始状态', () => {
    let state = resourcePanelReducer(createInitialResourcePanelState(), { type: 'START_SCAN' });
    state = resourcePanelReducer(state, { type: 'RESET' });
    expect(state.phase).toBe('idle');
    expect(state.scanProgress).toBe(0);
  });

  it('未知 action 返回原状态', () => {
    const initial = createInitialResourcePanelState();
    const state = resourcePanelReducer(initial, { type: 'UNKNOWN' } as never);
    expect(state).toBe(initial);
  });
});

describe('resource-panel: selectors', () => {
  it('getTotalReclaimableSpace 累加推荐总大小', () => {
    let state = resourcePanelReducer(createInitialResourcePanelState(), {
      type: 'SCAN_COMPLETE',
      report: { timestamp: 0, stats: makeStats(), recommendations: [makeRecommendation({ totalSize: 500 }), makeRecommendation({ id: 'r2', totalSize: 300 })], proxyStats: { total: 0, ready: 0, generating: 0, failed: 0 } },
    });
    expect(getTotalReclaimableSpace(state)).toBe(800);
  });

  it('getTotalReclaimableSpace 无推荐时返回 0', () => {
    expect(getTotalReclaimableSpace(createInitialResourcePanelState())).toBe(0);
  });

  it('getProxyStats 统计代理状态', () => {
    const proxies = [
      makeProxy({ id: 'p1', status: 'ready' }),
      makeProxy({ id: 'p2', status: 'ready' }),
      makeProxy({ id: 'p3', status: 'generating' }),
      makeProxy({ id: 'p4', status: 'failed' }),
    ];
    const stats = getProxyStats(proxies);
    expect(stats.total).toBe(4);
    expect(stats.ready).toBe(2);
    expect(stats.generating).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it('getProxyStats 空数组返回全零', () => {
    const stats = getProxyStats([]);
    expect(stats).toEqual({ total: 0, ready: 0, generating: 0, failed: 0 });
  });
});

describe('resource-panel: 显示工具函数', () => {
  it('getRiskColor 返回风险颜色', () => {
    expect(getRiskColor('low')).toBe('#22c55e');
    expect(getRiskColor('medium')).toBe('#f59e0b');
    expect(getRiskColor('high')).toBe('#ef4444');
  });

  it('getRiskLabel 返回中文风险标签', () => {
    expect(getRiskLabel('low')).toBe('低风险');
    expect(getRiskLabel('medium')).toBe('中风险');
    expect(getRiskLabel('high')).toBe('高风险');
  });

  it('getRecommendationTypeLabel 返回中文类型标签', () => {
    expect(getRecommendationTypeLabel('cache-expired')).toBe('过期缓存');
    expect(getRecommendationTypeLabel('unused-file')).toBe('未使用文件');
    expect(getRecommendationTypeLabel('duplicate-file')).toBe('重复文件');
    expect(getRecommendationTypeLabel('old-version')).toBe('历史版本');
    expect(getRecommendationTypeLabel('temp-file')).toBe('临时文件');
  });

  it('formatFileSize 格式化文件大小', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1048576)).toBe('1.00 MB');
    expect(formatFileSize(1073741824)).toBe('1.00 GB');
  });

  it('formatDate 返回中文日期字符串', () => {
    const ts = new Date('2026-01-15T10:30:00').getTime();
    const formatted = formatDate(ts);
    expect(formatted).toContain('2026');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
