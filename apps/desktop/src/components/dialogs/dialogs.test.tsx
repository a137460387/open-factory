import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Radix Dialog wraps content in a Portal (createPortal). renderToStaticMarkup
// cannot serialise portals — they produce empty output. Mock the Portal to
// render children inline and all other primitives as simple <div> wrappers.
vi.mock('@radix-ui/react-dialog', () => {
  const div = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) =>
    React.createElement('div', { ...props, ref }),
  );
  const pass = ({ children }: React.PropsWithChildren) => children as React.ReactElement;
  return {
    Root: ({ children }: React.PropsWithChildren) => React.createElement('div', null, children),
    Trigger: div,
    Portal: pass,
    Overlay: div,
    Content: div,
    Title: div,
    Description: div,
    Close: div,
  };
});

vi.mock('../../store/editorStore', () => ({
  useEditorStore: { getState: () => ({ project: { timeline: { tracks: [] } } }) },
}));
vi.mock('../../store/commandManager', () => ({
  commandManager: { execute: vi.fn() },
  timelineAccessor: {},
}));

import { ProjectEncryptionSaveDialog } from './ProjectEncryptionSaveDialog';
import { ProjectPasswordDialog } from './ProjectPasswordDialog';
import { AutosaveRecoveryDialog } from './AutosaveRecoveryDialog';
import { ExportQueueRecoveryDialog } from './ExportQueueRecoveryDialog';
import { ArchiveProgressDialog } from './ArchiveProgressDialog';
import { PasteKeyframeDialog } from './PasteKeyframeDialog';
import { SharePackageProgressDialog } from './SharePackageProgressDialog';

describe('P1-4 extracted dialog render tests', () => {
  it('ProjectEncryptionSaveDialog renders with data-testid', () => {
    const html = renderToStaticMarkup(<ProjectEncryptionSaveDialog onConfirm={() => {}} onClose={() => {}} />);
    expect(html).toContain('data-testid="project-encryption-dialog"');
  });

  it('ProjectPasswordDialog renders with data-testid', () => {
    const html = renderToStaticMarkup(
      <ProjectPasswordDialog
        request={{ title: 'Test', description: 'Desc', resolve: () => {} }}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(html).toContain('data-testid="project-password-dialog"');
  });

  it('AutosaveRecoveryDialog renders with data-testid', () => {
    const html = renderToStaticMarkup(<AutosaveRecoveryDialog onRestore={() => {}} onDiscard={() => {}} />);
    expect(html).toContain('data-testid="autosave-recovery-dialog"');
  });

  it('ExportQueueRecoveryDialog renders with data-testid', () => {
    const candidate = {
      tasks: [
        {
          id: 't1',
          name: 'Export 1',
          outputPath: '/out.mp4',
          status: 'pending' as const,
          plan: { full_args: [] } as any,
          priority: 'normal' as const,
          progress: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      pendingCount: 1,
      interruptedCount: 0,
    };
    const html = renderToStaticMarkup(
      <ExportQueueRecoveryDialog
        candidate={candidate}
        onRestoreAll={() => {}}
        onRestoreSelected={() => {}}
        onDiscardAll={() => {}}
      />,
    );
    expect(html).toContain('data-testid="export-queue-recovery-dialog"');
  });

  it('ArchiveProgressDialog renders with data-testid', () => {
    const html = renderToStaticMarkup(<ArchiveProgressDialog progress={{ copied: 5, total: 10 }} />);
    expect(html).toContain('data-testid="archive-progress-dialog"');
  });

  it('PasteKeyframeDialog renders with data-testid', () => {
    const html = renderToStaticMarkup(<PasteKeyframeDialog groups={[]} targetClipId="clip-1" onClose={() => {}} />);
    expect(html).toContain('data-testid="paste-keyframe-dialog"');
  });

  it('SharePackageProgressDialog renders with data-testid', () => {
    const html = renderToStaticMarkup(
      <SharePackageProgressDialog
        progress={{ stage: 'exporting', progress: 0.5, current: 1, total: 3, outputPath: '/out' }}
      />,
    );
    expect(html).toContain('data-testid="share-package-progress-dialog"');
  });
});
