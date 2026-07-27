import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginNetworkAPIImpl } from '../src/api/network-api';

describe('PluginNetworkAPIImpl', () => {
  let hostChecker: ReturnType<typeof vi.fn>;
  let rateChecker: ReturnType<typeof vi.fn>;
  let api: PluginNetworkAPIImpl;

  beforeEach(() => {
    hostChecker = vi.fn();
    rateChecker = vi.fn();
    api = new PluginNetworkAPIImpl(hostChecker, rateChecker);
  });

  describe('canAccess', () => {
    it('returns true when host is allowed', async () => {
      expect(await api.canAccess('https://example.com')).toBe(true);
      expect(hostChecker).toHaveBeenCalledWith('example.com');
    });

    it('returns false for invalid URL', async () => {
      expect(await api.canAccess('not-a-url')).toBe(false);
    });

    it('returns false when hostChecker throws', async () => {
      hostChecker.mockImplementation(() => { throw new Error('blocked'); });
      expect(await api.canAccess('https://blocked.com')).toBe(false);
    });
  });

  describe('fetch', () => {
    it('calls hostChecker and rateChecker', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('body'),
        ok: true,
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await api.fetch('https://example.com/api');
      expect(hostChecker).toHaveBeenCalledWith('example.com');
      expect(rateChecker).toHaveBeenCalled();
      expect(result.status).toBe(200);
      expect(result.body).toBe('body');
      expect(result.ok).toBe(true);

      vi.unstubAllGlobals();
    });

    it('passes method and headers to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve(''),
        ok: true,
      });
      vi.stubGlobal('fetch', mockFetch);

      await api.fetch('https://example.com', {
        method: 'POST',
        headers: { 'x-custom': 'val' },
        body: '{"data":1}',
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
        method: 'POST',
        headers: { 'x-custom': 'val' },
        body: '{"data":1}',
      }));

      vi.unstubAllGlobals();
    });

    it('uses default GET method', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve(''),
        ok: true,
      });
      vi.stubGlobal('fetch', mockFetch);

      await api.fetch('https://example.com');
      expect(mockFetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
        method: 'GET',
      }));

      vi.unstubAllGlobals();
    });

    it('collects response headers', async () => {
      const headers = new Headers({ 'x-test': 'abc', 'content-type': 'text/html' });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers,
        text: () => Promise.resolve(''),
        ok: true,
      }));

      const result = await api.fetch('https://example.com');
      expect(result.headers['x-test']).toBe('abc');
      expect(result.headers['content-type']).toBe('text/html');

      vi.unstubAllGlobals();
    });
  });
});
