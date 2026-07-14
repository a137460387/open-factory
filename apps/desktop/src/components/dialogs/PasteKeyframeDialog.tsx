import type { ClipboardKeyframeGroup, PasteMode, Clip } from '@open-factory/editor-core';
import { PasteKeyframesCommand } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useEditorStore } from '../../store/editorStore';
import { commandManager, timelineAccessor } from '../../store/commandManager';

export function PasteKeyframeDialog({
  groups,
  targetClipId,
  onClose,
}: {
  groups: ClipboardKeyframeGroup[];
  targetClipId: string;
  onClose(): void;
}) {
  const targetClip = useEditorStore
    .getState()
    .project.timeline.tracks.flatMap((t: { clips: Clip[] }) => t.clips)
    .find((c: Clip) => c.id === targetClipId);
  const hasCrossProperty = targetClip
    ? groups.some((g) => !Object.keys(targetClip.keyframes ?? {}).includes(g.property))
    : false;

  function handlePaste(mode: PasteMode): void {
    commandManager.execute(new PasteKeyframesCommand(timelineAccessor, { groups, targetClipId, mode }));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="paste-keyframe-dialog"
    >
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.keyframePaste.title}</h2>
        </div>
        <div className="space-y-3 px-4 py-3">
          {hasCrossProperty && (
            <p className="text-xs text-amber-600" data-testid="paste-cross-property-warning">
              {zhCN.keyframePaste.crossPropertyWarning}
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel"
              onClick={() => handlePaste('relative')}
              data-testid="paste-relative-button"
            >
              {zhCN.keyframePaste.relative}
            </button>
            <button
              className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]"
              onClick={() => handlePaste('absolute')}
              data-testid="paste-absolute-button"
            >
              {zhCN.keyframePaste.absolute}
            </button>
          </div>
        </div>
        <div className="flex justify-end border-t border-line px-4 py-2">
          <button
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-panel"
            onClick={onClose}
            data-testid="paste-cancel-button"
          >
            {zhCN.duplicateMedia.cancel}
          </button>
        </div>
      </section>
    </div>
  );
}
