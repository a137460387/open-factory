import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 英文 locale 懒加载健壮性（issue #114 系列 i18n:6 根因回归测试）。
 *
 * 根因：zh→en 切换依赖 ensureEnglishLocale() 动态 import。若该 import 失败，
 * 被 reject 的 Promise 会被永久缓存，导致本页面会话内切换到英文永久失效；
 * 且未预热时切换要等待加载完成才重渲染。修复：失败不缓存（可重试）+
 * 启动预热（切换命中同步路径）。
 */
describe('English locale lazy-load robustness', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('failed en-overrides import is not cached: a later switch retries and succeeds', async () => {
    // 初始语言来自 navigator（Node 全局 navigator 跟随 OS locale：本地 zh /
    // CI en-US）。本用例的前提是"初始 zh"，stub 使其在任何环境确定成立。
    vi.stubGlobal('navigator', { language: 'zh-CN' });

    let shouldFail = true;
    vi.doMock('./en-overrides.js', () => {
      if (shouldFail) {
        throw new Error('simulated transient import failure');
      }
      return { enOverrides: { toolbar: { fileMenu: 'File' } } };
    });

    const { getLanguage, setLanguageAsync } = await import('./strings');
    expect(getLanguage()).toBe('zh');

    // 第一次切换：import 失败 → 切换失败，语言保持 zh
    // （vitest 会包装 mock 工厂抛出的错误信息，此处只断言 reject 行为本身）
    await expect(setLanguageAsync('en')).rejects.toThrow();
    expect(getLanguage()).toBe('zh');

    // 瞬时故障恢复后再次切换：必须重试成功（失败未被缓存）
    shouldFail = false;
    await expect(setLanguageAsync('en')).resolves.toBe('en');
    expect(getLanguage()).toBe('en');
  });

  it('after prefetch the zh→en switch happens synchronously', async () => {
    vi.doMock('./en-overrides.js', () => ({
      enOverrides: { toolbar: { fileMenu: 'File' } },
    }));

    const { getLanguage, prefetchEnglishLocale, setLanguage, t } = await import('./strings');
    await prefetchEnglishLocale();

    // locale 已预热：同步 setLanguage 立即生效（无需等待异步加载）
    const result = setLanguage('en');
    expect(result).toBe('en');
    expect(getLanguage()).toBe('en');
    expect(t('toolbar.fileMenu')).toBe('File');
  });

  it('prefetchEnglishLocale never rejects even when the import fails', async () => {
    vi.doMock('./en-overrides.js', () => {
      throw new Error('simulated import failure');
    });

    const { prefetchEnglishLocale } = await import('./strings');
    await expect(prefetchEnglishLocale()).resolves.toBeUndefined();
  });
});
