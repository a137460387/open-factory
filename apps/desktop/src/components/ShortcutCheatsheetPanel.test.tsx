import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShortcutCheatsheetPanel } from './ShortcutCheatsheetPanel';

describe('ShortcutCheatsheetPanel', () => {
  it('renders the shortcuts panel with timeline, media, and inspector keyboard sections', () => {
    const html = renderToStaticMarkup(<ShortcutCheatsheetPanel bindings={{ 'toggle-playback': ['P'] }} onClose={() => undefined} />);
    expect(html).toContain('data-testid="shortcut-cheatsheet-panel"');
    expect(html).toContain('快捷键速查');
    expect(html).toContain('P');
    expect(html).toContain('移动媒体卡焦点');
    expect(html).toContain('滑轨大步长');
  });
});
