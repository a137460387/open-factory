/**
 * 高级色彩校正器 - 测试文件
 */
const { describe, it, expect } = require('vitest');
const plugin = require('./index');

describe('高级色彩校正器插件', () => {
  it('应正确导出 manifest', () => {
    expect(plugin.manifest.id).toBe('open-factory.example.color-corrector');
    expect(plugin.manifest.name).toBe('高级色彩校正器');
    expect(plugin.manifest.version).toBe('1.0.0');
    expect(plugin.manifest.category).toBe('effect');
    expect(plugin.manifest.permissions).toContain('read-project');
  });

  it('应有 onExportBefore 钩子', () => {
    expect(typeof plugin.hooks.onExportBefore).toBe('function');
  });

  it('onExportBefore 应返回正确的消息', () => {
    const result = plugin.hooks.onExportBefore({
      project: {
        timeline: {
          tracks: [
            { clips: [{ id: '1' }, { id: '2' }] },
            { clips: [{ id: '3' }] },
          ],
        },
      },
    });
    expect(result.message).toContain('3 个片段');
    expect(result.ffmpegFilter).toBeDefined();
  });

  it('buildColorFilter 应生成正确的滤镜字符串', () => {
    const { buildColorFilter } = plugin;

    // 默认参数应返回空字符串
    expect(buildColorFilter({ brightness: 0, contrast: 1.0, saturation: 1.0, temperature: 0 })).toBe('');

    // 亮度调节
    const brightnessFilter = buildColorFilter({ brightness: 0.1, contrast: 1.0, saturation: 1.0, temperature: 0 });
    expect(brightnessFilter).toContain('eq=brightness=0.1');

    // 对比度调节
    const contrastFilter = buildColorFilter({ brightness: 0, contrast: 1.5, saturation: 1.0, temperature: 0 });
    expect(contrastFilter).toContain('eq=contrast=1.5');

    // 色温偏移
    const warmFilter = buildColorFilter({ brightness: 0, contrast: 1.0, saturation: 1.0, temperature: 50 });
    expect(warmFilter).toContain('colorbalance=');
  });
});
