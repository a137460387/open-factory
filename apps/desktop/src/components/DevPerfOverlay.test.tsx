// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('__DEV_PERF_MONITOR__', true);

vi.mock('../hooks/usePerfMonitor', () => ({
  usePerfMonitor: () => ({
    renderCounts: new Map([['TestComp', 5]]),
    fps: { current: 60, avg: 58, min: 45, history: [60, 58, 55] },
    subscriptions: [{ store: 'editorStore', field: 'dirty', timestamp: 1000 }],
    resetRenderCounts: vi.fn(),
    clearSubscriptions: vi.fn(),
  }),
  trackRender: vi.fn(),
}));

import { render, screen, cleanup, act } from '@testing-library/react';
import { DevPerfOverlay } from './DevPerfOverlay';

afterEach(() => {
  cleanup();
});

describe('DevPerfOverlay', () => {
  it('renders when __DEV_PERF_MONITOR__ is true', () => {
    render(<DevPerfOverlay />);
    expect(screen.getByText('Perf Monitor')).toBeDefined();
    expect(screen.getByText('FPS')).toBeDefined();
    expect(screen.getByText('Renders')).toBeDefined();
    expect(screen.getByText('Subscriptions')).toBeDefined();
    expect(screen.getByText('Reset')).toBeDefined();
  });

  it('shows FPS value from mock data', () => {
    render(<DevPerfOverlay />);
    expect(screen.getByText(/60 fps/)).toBeDefined();
  });

  it('shows render count from mock data', () => {
    render(<DevPerfOverlay />);
    expect(screen.getByText('TestComp')).toBeDefined();
  });

  it('collapses to FPS bar when _ is clicked', () => {
    render(<DevPerfOverlay />);
    act(() => {
      screen.getByText('_').click();
    });
    expect(screen.queryByText('Perf Monitor')).toBeNull();
  });

  it('returns null when __DEV_PERF_MONITOR__ is false', () => {
    vi.stubGlobal('__DEV_PERF_MONITOR__', false);
    const { container } = render(<DevPerfOverlay />);
    expect(container.innerHTML).toBe('');
    vi.stubGlobal('__DEV_PERF_MONITOR__', true);
  });

  it('is click-through in e2e mode but interactive in plain dev', () => {
    const env = import.meta.env;
    const original = env.VITE_E2E;
    env.VITE_E2E = 'true';
    const { container: e2eContainer } = render(<DevPerfOverlay />);
    expect((e2eContainer.firstElementChild as HTMLElement).style.pointerEvents).toBe('none');
    cleanup();
    env.VITE_E2E = original;
    const { container: devContainer } = render(<DevPerfOverlay />);
    expect((devContainer.firstElementChild as HTMLElement).style.pointerEvents).toBe('');
  });
});
