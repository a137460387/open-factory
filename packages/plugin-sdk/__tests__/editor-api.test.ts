import { describe, it, expect, beforeEach } from 'vitest';
import { PluginEditorAPIImpl } from '../src/api/editor-api';

describe('PluginEditorAPIImpl', () => {
  let api: PluginEditorAPIImpl;

  beforeEach(() => {
    api = new PluginEditorAPIImpl();
  });

  describe('getProject', () => {
    it('throws when no project loaded', async () => {
      await expect(api.getProject()).rejects.toThrow('No project loaded');
    });

    it('returns project clone', async () => {
      const proj = { name: 'test', clips: [] } as any;
      api.setProject(proj);
      const result = await api.getProject();
      expect(result.name).toBe('test');
      expect(result).not.toBe(proj); // structuredClone
    });
  });

  describe('updateProject', () => {
    it('stores project clone', async () => {
      const proj = { name: 'updated' } as any;
      await api.updateProject(proj);
      const result = await api.getProject();
      expect(result.name).toBe('updated');
    });
  });

  describe('selectedClips', () => {
    it('returns empty when no project', async () => {
      expect(await api.getSelectedClips()).toEqual([]);
    });

    it('returns empty when no clips in project', async () => {
      api.setProject({} as any);
      expect(await api.getSelectedClips()).toEqual([]);
    });

    it('filters clips by selected ids', async () => {
      const proj = { clips: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } as any;
      api.setProject(proj);
      await api.selectClips(['a', 'c']);
      const selected = await api.getSelectedClips();
      expect(selected.map((c: any) => c.id)).toEqual(['a', 'c']);
    });

    it('selectClips replaces previous selection', async () => {
      await api.selectClips(['a', 'b']);
      await api.selectClips(['c']);
      api.setProject({ clips: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } as any);
      const selected = await api.getSelectedClips();
      expect(selected.map((c: any) => c.id)).toEqual(['c']);
    });
  });

  describe('addClip', () => {
    it('returns clip with generated id', async () => {
      const clip = await api.addClip({ startTime: 0, duration: 5 } as any);
      expect(clip.id).toMatch(/^clip-/);
    });
  });

  describe('removeClip', () => {
    it('removes clip from selection', async () => {
      await api.selectClips(['a', 'b']);
      await api.removeClip('a');
      api.setProject({ clips: [{ id: 'a' }, { id: 'b' }] } as any);
      const selected = await api.getSelectedClips();
      expect(selected.map((c: any) => c.id)).toEqual(['b']);
    });
  });

  describe('updateClip', () => {
    it('does not throw', async () => {
      await api.updateClip('c1', { startTime: 5 } as any);
    });
  });

  describe('timeline', () => {
    it('getTimelineDuration returns 0', async () => {
      expect(await api.getTimelineDuration()).toBe(0);
    });

    it('getPlaybackPosition returns 0 initially', async () => {
      expect(await api.getPlaybackPosition()).toBe(0);
    });

    it('seekTo updates position', async () => {
      await api.seekTo(10);
      expect(await api.getPlaybackPosition()).toBe(10);
    });

    it('seekTo clamps negative to 0', async () => {
      await api.seekTo(-5);
      expect(await api.getPlaybackPosition()).toBe(0);
    });
  });
});
