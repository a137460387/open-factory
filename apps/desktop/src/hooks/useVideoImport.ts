import { useCallback } from 'react';
import { probeMediaPath } from '../lib/media';
import { extractCoverFrames } from '../lib/tauri-bridge';
import { openPath } from '../lib/tauri-bridge/window';
import { showToast } from '../lib/toast';
import { useEditorStore } from '../store/editorStore';
import { runUiFeedbackTask } from '../media/background-media-task-queue';

/**
 * Hook for importing AI-generated video into the timeline.
 * Probes the video file, adds it to the media bin, extracts a cover frame,
 * and provides a function to reveal the file in the system file manager.
 */
export function useVideoImport() {
  const addMedia = useEditorStore((s) => s.addMedia);

  const importToTimeline = useCallback(
    async (videoPath: string): Promise<boolean> => {
      try {
        const asset = await probeMediaPath(videoPath);
        addMedia([asset]);

        // Extract cover frame in background (non-blocking). Single-shot
        // interaction path → UI feedback pool so it is not starved by
        // batch background jobs.
        const outputDir = videoPath.replace(/[/\\][^/\\]+$/, '');
        const outputStem = videoPath
          .replace(/^.*[/\\]/, '')
          .replace(/\.[^.]+$/, '');
        runUiFeedbackTask(() =>
          extractCoverFrames({
            clipId: asset.id,
            sourcePath: videoPath,
            outputDir,
            outputStem,
            mode: 'i-frame',
            count: 1,
          }),
        ).catch(() => {
          // Cover frame extraction is best-effort; don't block import
        });

        showToast({
          kind: 'success',
          title: 'Video imported to timeline',
          message: asset.name,
        });
        return true;
      } catch (error) {
        showToast({
          kind: 'error',
          title: 'Failed to import video',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },
    [addMedia],
  );

  const revealInExplorer = useCallback(async (filePath: string) => {
    try {
      const dir = filePath.replace(/[/\\][^/\\]+$/, '');
      await openPath(dir);
    } catch (error) {
      showToast({
        kind: 'error',
        title: 'Failed to open file location',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, []);

  return { importToTimeline, revealInExplorer };
}
