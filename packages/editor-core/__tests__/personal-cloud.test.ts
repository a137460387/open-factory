import { describe, it, expect } from 'vitest';
import {
  createConnectionConfig,
  updateConnectionConfig,
  createConnectionState,
  setConnectionStatus,
  filterMediaFiles,
  sortDirectoryEntries,
  estimateProxySize,
  getProxyCachePath,
  createSnapshot,
  sortSnapshots,
} from '../../cloud-sync/src/personal-cloud';
import type { CloudFileEntry } from '../../cloud-sync/src/personal-cloud';

describe('personal-cloud', () => {
  describe('createConnectionConfig', () => {
    it('creates WebDAV config', () => {
      const config = createConnectionConfig({
        provider: 'webdav',
        label: '我的NAS',
        endpoint: 'https://nas.example.com/dav',
        username: 'user',
        credentialRef: 'cred-1',
      });
      expect(config.provider).toBe('webdav');
      expect(config.label).toBe('我的NAS');
      expect(config.endpoint).toBe('https://nas.example.com/dav');
      expect(config.rootPath).toBe('/');
      expect(config.autoConnect).toBe(false);
    });

    it('creates OneDrive config', () => {
      const config = createConnectionConfig({
        provider: 'onedrive',
        label: 'OneDrive',
        endpoint: 'https://graph.microsoft.com',
        credentialRef: 'cred-2',
        rootPath: '/Documents',
      });
      expect(config.provider).toBe('onedrive');
      expect(config.rootPath).toBe('/Documents');
    });

    it('normalizes root path', () => {
      const config = createConnectionConfig({
        provider: 'webdav',
        label: 'test',
        endpoint: 'https://example.com',
        credentialRef: 'c',
        rootPath: 'some/path',
      });
      expect(config.rootPath).toBe('/some/path');
    });
  });

  describe('updateConnectionConfig', () => {
    it('updates fields immutably', () => {
      const config = createConnectionConfig({
        provider: 'webdav',
        label: 'old',
        endpoint: 'https://old.com',
        credentialRef: 'c',
      });
      const updated = updateConnectionConfig(config, { label: 'new' });
      expect(updated.label).toBe('new');
      expect(updated.id).toBe(config.id);
      // updatedAt should be present and valid
      expect(updated.updatedAt).toBeTruthy();
      expect(new Date(updated.updatedAt).getTime()).not.toBeNaN();
    });
  });

  describe('connection state', () => {
    it('creates disconnected state', () => {
      const state = createConnectionState('config-1');
      expect(state.status).toBe('disconnected');
    });

    it('transitions to connected', () => {
      let state = createConnectionState('config-1');
      state = setConnectionStatus(state, 'connected');
      expect(state.status).toBe('connected');
      expect(state.connectedAt).toBeTruthy();
    });

    it('records error', () => {
      let state = createConnectionState('config-1');
      state = setConnectionStatus(state, 'error', 'Auth failed');
      expect(state.status).toBe('error');
      expect(state.lastError).toBe('Auth failed');
    });
  });

  describe('filterMediaFiles', () => {
    const entries: CloudFileEntry[] = [
      { path: '/a.mp4', name: 'a.mp4', isDirectory: false, hasLocalProxy: false },
      { path: '/b.txt', name: 'b.txt', isDirectory: false, hasLocalProxy: false },
      { path: '/folder', name: 'folder', isDirectory: true, hasLocalProxy: false },
      { path: '/c.wav', name: 'c.wav', isDirectory: false, hasLocalProxy: false },
      { path: '/d.jpg', name: 'd.jpg', isDirectory: false, hasLocalProxy: false },
    ];

    it('filters to media files only', () => {
      const result = filterMediaFiles(entries);
      expect(result.length).toBe(3);
      expect(result.map((e) => e.name)).toContain('a.mp4');
      expect(result.map((e) => e.name)).toContain('c.wav');
      expect(result.map((e) => e.name)).toContain('d.jpg');
    });

    it('excludes directories', () => {
      const result = filterMediaFiles(entries);
      expect(result.every((e) => !e.isDirectory)).toBe(true);
    });
  });

  describe('sortDirectoryEntries', () => {
    it('sorts by name ascending', () => {
      const entries: CloudFileEntry[] = [
        { path: '/c.mp4', name: 'c.mp4', isDirectory: false, hasLocalProxy: false },
        { path: '/a.mp4', name: 'a.mp4', isDirectory: false, hasLocalProxy: false },
        { path: '/b', name: 'b', isDirectory: true, hasLocalProxy: false },
      ];
      const sorted = sortDirectoryEntries(entries, 'name', 'asc');
      expect(sorted[0].name).toBe('b'); // directory first
      expect(sorted[1].name).toBe('a.mp4');
      expect(sorted[2].name).toBe('c.mp4');
    });
  });

  describe('estimateProxySize', () => {
    it('estimates proxy sizes at different quality levels', () => {
      const original = 100 * 1024 * 1024; // 100MB
      expect(estimateProxySize(original, 'low')).toBeLessThan(estimateProxySize(original, 'medium'));
      expect(estimateProxySize(original, 'medium')).toBeLessThan(estimateProxySize(original, 'high'));
    });
  });

  describe('getProxyCachePath', () => {
    it('generates structured cache path', () => {
      const path = getProxyCachePath('conn-1', '/videos/test.mp4', 'low');
      expect(path).toContain('conn-1');
      expect(path).toContain('low');
    });
  });

  describe('createSnapshot', () => {
    it('creates snapshot with version 1', () => {
      const snap = createSnapshot({
        projectId: 'proj-1',
        projectName: '我的项目',
        connectionId: 'conn-1',
      });
      expect(snap.version).toBe(1);
      expect(snap.projectName).toBe('我的项目');
      expect(snap.remotePath).toContain('proj-1');
    });

    it('increments version from previous', () => {
      const snap = createSnapshot({
        projectId: 'proj-1',
        projectName: 'test',
        connectionId: 'conn-1',
        previousVersion: 5,
      });
      expect(snap.version).toBe(6);
    });
  });

  describe('sortSnapshots', () => {
    it('sorts by newest first', () => {
      const snaps = [
        createSnapshot({ projectId: 'p', projectName: 'n', connectionId: 'c', previousVersion: 0 }),
        createSnapshot({ projectId: 'p', projectName: 'n', connectionId: 'c', previousVersion: 2 }),
      ];
      const sorted = sortSnapshots(snaps, 'newest');
      expect(sorted[0].version).toBe(3);
    });
  });
});
