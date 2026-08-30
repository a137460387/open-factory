import type { Clip } from '@open-factory/editor-core';
import { AddTransitionCommand, DEFAULT_TRANSITION_DURATION, type TransitionType } from '@open-factory/editor-core';
import { TITLE_TEMPLATE_DRAG_MIME } from '../../../../lib/titleTemplates';
import { commandManager, timelineAccessor } from '../../../../store/commandManager';
import { zhCN } from '../../../../i18n/strings';
import { showToast } from '../../../../lib/toast';
import type { TimelineHandlerParams } from './types';
import { TRANSITION_DRAG_MIME, isCreditsTextFile, getTimelineDropStart } from './utils';

export function createDropHandlers(
  params: TimelineHandlerParams,
  helpers: {
    addCredits: (text?: string, start?: number) => void;
    addTitleTemplate: (templateId: string, start?: number) => void;
  },
) {
  const { project, zoom, scrollRef } = params;

  const { addCredits, addTitleTemplate } = helpers;

  function onTimelineDragOver(event: React.DragEvent<HTMLDivElement>): void {
    const types = Array.from(event.dataTransfer.types);
    if (types.includes(TITLE_TEMPLATE_DRAG_MIME) || types.includes('Files') || types.includes(TRANSITION_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function onTimelineDrop(event: React.DragEvent<HTMLDivElement>): void {
    const templateId = event.dataTransfer.getData(TITLE_TEMPLATE_DRAG_MIME);
    const transitionType = event.dataTransfer.getData(TRANSITION_DRAG_MIME);
    const start = getTimelineDropStart(event, scrollRef.current, zoom);

    // 转场拖拽：在最近的相邻片段之间插入转场
    if (transitionType) {
      event.preventDefault();
      const dropTime = start ?? 0;
      const droppedTransitionType = transitionType as TransitionType;
      // 找到所有视频轨道上的片段，按时间排序
      const videoTracks = project.timeline.tracks.filter((t) => t.type === 'video');
      for (const track of videoTracks) {
        const sorted = [...track.clips].sort((a, b) => a.start - b.start);
        for (let i = 0; i < sorted.length - 1; i++) {
          const left = sorted[i];
          const right = sorted[i + 1];
          const junctionTime = left.start + left.duration;
          // 如果落点在 left-right 交界处附近（±0.5 秒内），则在此处插入转场
          if (Math.abs(junctionTime - dropTime) < 0.5) {
            try {
              commandManager.execute(
                new AddTransitionCommand(timelineAccessor, {
                  type: droppedTransitionType,
                  duration: DEFAULT_TRANSITION_DURATION,
                  fromClipId: left.id,
                  toClipId: right.id,
                }),
              );
            } catch {
              showToast({
                kind: 'warning',
                title: zhCN.timeline.transitionUnavailableTitle,
                message: zhCN.timeline.transitionUnavailableMessage,
              });
            }
            return;
          }
        }
      }
      return;
    }

    if (!templateId) {
      const creditsFile = Array.from(event.dataTransfer.files).find(isCreditsTextFile);
      if (!creditsFile) {
        return;
      }
      event.preventDefault();
      void creditsFile
        .text()
        .then((text) => addCredits(text, start))
        .catch((error) => {
          showToast({
            kind: 'warning',
            title: zhCN.timeline.editRejectedTitle,
            message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
          });
        });
      return;
    }
    event.preventDefault();
    addTitleTemplate(templateId, start);
  }

  return {
    onTimelineDragOver,
    onTimelineDrop,
  };
}
