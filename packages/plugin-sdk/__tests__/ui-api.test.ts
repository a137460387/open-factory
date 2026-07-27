import { describe, it, expect, beforeEach } from 'vitest';
import { PluginUIAPIImpl } from '../src/api/ui-api';

describe('PluginUIAPIImpl', () => {
  let api: PluginUIAPIImpl;

  beforeEach(() => {
    api = new PluginUIAPIImpl();
  });

  describe('panels', () => {
    it('registerPanel stores and returns panel id', async () => {
      const id = await api.registerPanel({
        id: 'p1',
        title: 'My Panel',
        position: 'left',
        content: '<div>hello</div>',
      });
      expect(id).toBe('p1');
      expect(api.getPanels()).toHaveLength(1);
    });

    it('removePanel removes panel', async () => {
      await api.registerPanel({ id: 'p1', title: 'P', position: 'right', content: '' });
      await api.removePanel('p1');
      expect(api.getPanels()).toHaveLength(0);
    });

    it('removePanel throws for missing panel', async () => {
      await expect(api.removePanel('missing')).rejects.toThrow('not found');
    });

    it('getPanels returns all registered panels', async () => {
      await api.registerPanel({ id: 'a', title: 'A', position: 'left', content: '' });
      await api.registerPanel({ id: 'b', title: 'B', position: 'bottom', content: '' });
      expect(api.getPanels()).toHaveLength(2);
    });
  });

  describe('dialogs and toasts', () => {
    it('showDialog returns default button index', async () => {
      const result = await api.showDialog({ title: 'T', message: 'M' });
      expect(result).toBe(0);
    });

    it('showToast does not throw', async () => {
      await api.showToast({ type: 'success', title: 'Done' });
    });
  });

  describe('menu items', () => {
    it('registerMenuItem stores item', async () => {
      await api.registerMenuItem({ id: 'm1', label: 'File', onClick: () => {} });
      expect(api.getMenuItems()).toHaveLength(1);
    });

    it('removeMenuItem removes item', async () => {
      await api.registerMenuItem({ id: 'm1', label: 'File', onClick: () => {} });
      await api.removeMenuItem('m1');
      expect(api.getMenuItems()).toHaveLength(0);
    });

    it('removeMenuItem throws for missing', async () => {
      await expect(api.removeMenuItem('missing')).rejects.toThrow('not found');
    });

    it('getMenuItems returns all items', async () => {
      await api.registerMenuItem({ id: 'a', label: 'A', onClick: () => {} });
      await api.registerMenuItem({ id: 'b', label: 'B', shortcut: 'Ctrl+B', onClick: () => {} });
      expect(api.getMenuItems()).toHaveLength(2);
    });
  });

  describe('status bar', () => {
    it('setStatusBar does not throw', async () => {
      await api.setStatusBar('Ready');
    });
  });
});
