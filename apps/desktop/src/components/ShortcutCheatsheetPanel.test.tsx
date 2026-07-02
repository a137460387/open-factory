import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { getLanguage, setLanguage } from '../i18n/strings';
import { ShortcutCheatsheetPanel } from './ShortcutCheatsheetPanel';

describe('ShortcutCheatsheetPanel', () => {
  beforeAll(() => {
    // Debug: log locale values in CI
    console.log('[DEBUG] typeof navigator:', typeof globalThis.navigator);
    console.log('[DEBUG] navigator.language:', typeof globalThis.navigator !== 'undefined' ? globalThis.navigator.language : 'N/A');
    console.log('[DEBUG] currentLanguage before setLanguage:', getLanguage());
    setLanguage('zh');
    console.log('[DEBUG] currentLanguage after setLanguage("zh"):', getLanguage());
  });

  it('renders the shortcuts panel with timeline, media, and inspector keyboard sections', () => {
    const html = renderToStaticMarkup(<ShortcutCheatsheetPanel bindings={{ 'toggle-playback': ['P'] }} onClose={() => undefined} />);
    console.log('[DEBUG] rendered html snippet:', html.substring(0, 500));
    expect(html).toContain('data-testid="shortcut-cheatsheet-panel"');
    expect(html).toContain('快捷键速查');
    expect(html).toContain('P');
    expect(html).toContain('移动媒体卡焦点');
    expect(html).toContain('滑轨大步长');
  });
});
