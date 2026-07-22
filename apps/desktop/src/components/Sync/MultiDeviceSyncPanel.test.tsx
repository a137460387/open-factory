// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh' },
  }),
}));

// Mock editor-core sync module
vi.mock('@open-factory/editor-core/sync/multi-device-sync', () => ({
  MultiDeviceSyncManager: vi.fn(),
  createSyncManager: vi.fn(),
  createLocalDevice: vi.fn(),
}));

describe('MultiDeviceSyncPanel', () => {
  it('module can be imported', async () => {
    const mod = await import('./MultiDeviceSyncPanel');
    expect(mod.MultiDeviceSyncPanel).toBeDefined();
    expect(typeof mod.MultiDeviceSyncPanel).toBe('function');
  });
});
