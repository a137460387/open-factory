/**
 * 批量字幕翻译 - 测试文件
 */
const { describe, it, expect } = require('vitest');
const plugin = require('./index');

describe('批量字幕翻译插件', () => {
  it('应正确导出 manifest', () => {
    expect(plugin.manifest.id).toBe('open-factory.example.subtitle-translator');
    expect(plugin.manifest.category).toBe('workflow');
    expect(plugin.manifest.permissions).toContain('read-project');
    expect(plugin.manifest.permissions).toContain('write-project');
  });

  it('应注册翻译菜单项', () => {
    const menus = [];
    plugin.hooks.onMenuRegister({ menus });
    expect(menus).toHaveLength(2);
    expect(menus[0].id).toBe('subtitle-translator.translate');
    expect(menus[1].id).toBe('subtitle-translator.glossary');
  });

  it('onExportBefore 应统计字幕数量', () => {
    const result = plugin.hooks.onExportBefore({
      project: {
        timeline: {
          tracks: [
            { type: 'video', clips: [{ id: '1' }] },
            { type: 'subtitle', clips: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
          ],
        },
      },
    });
    expect(result.message).toContain('3 条字幕');
    expect(result.subtitleCount).toBe(3);
  });

  it('onExportBefore 应在无字幕时返回 undefined', () => {
    const result = plugin.hooks.onExportBefore({
      project: {
        timeline: {
          tracks: [{ type: 'video', clips: [{ id: '1' }] }],
        },
      },
    });
    expect(result).toBeUndefined();
  });

  it('translateText 应使用术语表', () => {
    const { translateText } = plugin;
    expect(translateText('Hello', 'ja', { Hello: 'こんにちは' })).toBe('こんにちは');
  });

  it('translateText 应添加语言前缀', () => {
    const { translateText } = plugin;
    expect(translateText('你好', 'en')).toBe('[EN] 你好');
    expect(translateText('你好', 'ja')).toBe('[JA] 你好');
  });

  it('batchSubtitles 应正确分批', () => {
    const { batchSubtitles } = plugin;
    const subtitles = Array.from({ length: 45 }, (_, i) => ({ id: i }));
    const batches = batchSubtitles(subtitles, 20);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(20);
    expect(batches[1]).toHaveLength(20);
    expect(batches[2]).toHaveLength(5);
  });

  it('batchSubtitles 应处理空数组', () => {
    const { batchSubtitles } = plugin;
    expect(batchSubtitles([])).toEqual([]);
  });
});
