// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));
vi.mock('../../i18n/strings', () => ({
  zhCN: {
    errors: {
      panelCrashed: (name: string) => `${name} crashed`,
      panelUnexpected: 'Unexpected error',
      panelCouldNotRender: (name: string) => `Could not render ${name}`,
      reloadPanel: 'Reload Panel',
    },
  },
}));

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <div>Child content</div>;
}

afterEach(() => {
  cleanup();
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary name="TestPanel">
        <div>Safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeDefined();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary name="Timeline">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Could not render Timeline')).toBeDefined();
  });

  it('shows retry button in fallback UI', () => {
    render(
      <ErrorBoundary name="Preview">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Reload Panel')).toBeDefined();
  });

  it('calls console.error with component name and stack', () => {
    const spy = vi.spyOn(console, 'error');
    render(
      <ErrorBoundary name="Properties">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(spy).toHaveBeenCalledWith('[ErrorBoundary:Properties]', expect.any(Error), expect.any(String));
  });

  it('calls showToast on error', async () => {
    const { showToast } = await import('../../lib/toast');
    render(
      <ErrorBoundary name="Export">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(showToast).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Export crashed',
      message: 'Test error',
    });
  });

  it('retry button restores children when error is resolved', () => {
    let shouldThrow = true;
    function DynamicThrower() {
      if (shouldThrow) throw new Error('Transient error');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary name="Plugins">
        <DynamicThrower />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Could not render Plugins')).toBeDefined();

    shouldThrow = false;
    act(() => {
      screen.getByText('Reload Panel').click();
    });
    expect(screen.getByText('Recovered')).toBeDefined();
  });
});
