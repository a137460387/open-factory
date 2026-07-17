/**
 * 社交媒体导出 - 测试文件
 */
const { describe, it, expect } = require('vitest');
const plugin = require('./index');

describe('社交媒体导出插件', () => {
  it('应正确导出 manifest', () => {
    expect(plugin.manifest.id).toBe('open-factory.example.social-export');
    expect(plugin.manifest.category).toBe('export');
    expect(plugin.manifest.permissions).toContain('export-hook');
    expect(plugin.manifest.permissions).toContain('read-project');
  });

  it('应有 onExportBefore 钩子', () => {
    expect(typeof plugin.hooks.onExportBefore).toBe('function');
  });

  it('getPlatformPresets 应返回预设列表', () => {
    const presets = plugin.getPlatformPresets();
    expect(presets.length).toBeGreaterThanOrEqual(4);
    expect(presets.map((p) => p.platform)).toContain('抖音');
    expect(presets.map((p) => p.platform)).toContain('B站');
    expect(presets.map((p) => p.platform)).toContain('YouTube');
  });

  it('抖音预设应为竖屏', () => {
    const presets = plugin.getPlatformPresets();
    const douyin = presets.find((p) => p.id === 'douyin-vertical');
    expect(douyin.width).toBe(1080);
    expect(douyin.height).toBe(1920);
  });

  it('recommendPreset 应返回推荐预设', () => {
    const project = { timeline: { tracks: [{ type: 'video', clips: [] }] } };
    const presets = plugin.getPlatformPresets();
    const recommended = plugin.recommendPreset(project, presets);
    expect(recommended).toBe('bilibili-1080p');
  });

  it('estimateDuration 应计算正确时长', () => {
    const project = {
      timeline: {
        tracks: [
          {
            type: 'video',
            clips: [
              { startTime: 0, duration: 10 },
              { startTime: 10, duration: 20 },
              { startTime: 30, duration: 15 },
            ],
          },
        ],
      },
    };
    expect(plugin.estimateDuration(project)).toBe(45);
  });

  it('estimateDuration 应处理空项目', () => {
    expect(plugin.estimateDuration({})).toBe(0);
    expect(plugin.estimateDuration({ timeline: { tracks: [] } })).toBe(0);
  });

  it('buildExportArgs 应生成正确的 FFmpeg 参数', () => {
    const presets = plugin.getPlatformPresets();
    const args = plugin.buildExportArgs(presets[0]);
    expect(args).toContain('-c:v');
    expect(args).toContain('h264');
    expect(args).toContain('-movflags');
    expect(args).toContain('+faststart');
    expect(args).toContain('-pix_fmt');
    expect(args).toContain('yuv420p');
  });

  it('onExportBefore 应返回完整结果', () => {
    const result = plugin.hooks.onExportBefore({
      project: {
        timeline: {
          tracks: [
            { type: 'video', clips: [{ startTime: 0, duration: 30 }] },
          ],
        },
      },
    });
    expect(result.message).toContain('平台预设');
    expect(result.presets.length).toBeGreaterThanOrEqual(4);
    expect(result.recommendedPreset).toBeDefined();
    expect(result.estimatedDuration).toBe(30);
  });
});
