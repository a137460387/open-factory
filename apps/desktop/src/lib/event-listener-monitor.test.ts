/**
 * Event Listener Monitor Tests
 *
 * Tests the dev-only global addEventListener monitor that tracks
 * registrations and reports leaked listeners.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the module logic directly, but the module auto-installs
// on import when DEV is true. We'll test the exported functions.

describe('EventListenerMonitor', () => {
  let monitor: typeof import('./event-listener-monitor');

  beforeEach(async () => {
    vi.resetModules();
    monitor = await import('./event-listener-monitor');
  });

  afterEach(() => {
    // Clean up any listeners we registered during tests
  });

  describe('getActiveListeners', () => {
    it('returns an array', () => {
      const listeners = monitor.getActiveListeners();
      expect(Array.isArray(listeners)).toBe(true);
    });
  });

  describe('reportLeakedListeners', () => {
    it('does not throw when called', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      expect(() => monitor.reportLeakedListeners()).not.toThrow();
      consoleSpy.mockRestore();
    });

    it('logs info when no leaked listeners', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      monitor.reportLeakedListeners();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No leaked listeners'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('installEventListenerMonitor', () => {
    it('is a function', () => {
      expect(typeof monitor.installEventListenerMonitor).toBe('function');
    });

    it('does not throw when called', () => {
      expect(() => monitor.installEventListenerMonitor()).not.toThrow();
    });
  });
});
