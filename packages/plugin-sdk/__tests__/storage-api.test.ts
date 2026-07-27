import { describe, it, expect, beforeEach } from 'vitest';
import { PluginStorageAPIImpl } from '../src/api/storage-api';

describe('PluginStorageAPIImpl', () => {
  let api: PluginStorageAPIImpl;

  beforeEach(() => {
    api = new PluginStorageAPIImpl('test-plugin');
  });

  describe('key-value store', () => {
    it('get returns null for missing key', async () => {
      expect(await api.get('missing')).toBeNull();
    });

    it('set and get roundtrip', async () => {
      await api.set('key1', 'value1');
      expect(await api.get('key1')).toBe('value1');
    });

    it('set overwrites existing value', async () => {
      await api.set('key1', 'old');
      await api.set('key1', 'new');
      expect(await api.get('key1')).toBe('new');
    });

    it('delete removes key', async () => {
      await api.set('key1', 'value1');
      await api.delete('key1');
      expect(await api.get('key1')).toBeNull();
    });

    it('delete on missing key is no-op', async () => {
      await api.delete('missing');
    });

    it('keys returns only plugin-prefixed keys', async () => {
      await api.set('a', 1);
      await api.set('b', 2);
      const keys = await api.keys();
      expect(keys.sort()).toEqual(['a', 'b']);
    });

    it('clear removes only this plugin keys', async () => {
      await api.set('a', 1);
      await api.set('b', 2);
      await api.clear();
      expect(await api.keys()).toEqual([]);
    });

    it('getUsage calculates byte usage', async () => {
      await api.set('key', 'value');
      const usage = await api.getUsage();
      expect(usage.usedBytes).toBeGreaterThan(0);
      expect(usage.quotaBytes).toBe(10 * 1024 * 1024);
    });

    it('getUsage with custom quota', async () => {
      const custom = new PluginStorageAPIImpl('p', 1024);
      const usage = await custom.getUsage();
      expect(usage.quotaBytes).toBe(1024);
    });
  });

  describe('file operations', () => {
    it('writeFile and readFile roundtrip', async () => {
      await api.writeFile('data.txt', 'hello');
      expect(await api.readFile('data.txt')).toBe('hello');
    });

    it('readFile throws for missing file', async () => {
      await expect(api.readFile('missing.txt')).rejects.toThrow('File not found');
    });

    it('deleteFile removes file', async () => {
      await api.writeFile('data.txt', 'hello');
      await api.deleteFile('data.txt');
      await expect(api.readFile('data.txt')).rejects.toThrow();
    });

    it('listFiles returns files in directory', async () => {
      await api.writeFile('dir/a.txt', 'a');
      await api.writeFile('dir/b.txt', 'b');
      const files = await api.listFiles('dir/');
      expect(files.sort()).toEqual(['a.txt', 'b.txt']);
    });

    it('writeFile throws on quota exceeded', async () => {
      const small = new PluginStorageAPIImpl('p', 50);
      await expect(small.writeFile('big.txt', 'x'.repeat(100))).rejects.toThrow('quota exceeded');
    });

    it('getUsage includes file bytes', async () => {
      await api.writeFile('test.txt', 'content');
      const usage = await api.getUsage();
      expect(usage.usedBytes).toBeGreaterThan(0);
    });
  });
});
