import type {Clip, GapFillStrategy, MediaAsset} from '@open-factory/editor-core';
import {
  CloseGapCommand,
  FillGapCommand,
  buildGapFillCommandOperation,
  createId,
  findTimelineGapAtTime,
  getClipSourceVisibleDuration,
} from '@open-factory/editor-core';
import type {GapMenuState} from '../../TimelineMenus';
import {commandManager, timelineAccessor} from '../../../../store/commandManager';
import {zhCN} from '../../../../i18n/strings';
import {generateGapFillMedia} from '../../../../lib/tauri-bridge';
import {showToast} from '../../../../lib/toast';
import type {TimelineHandlerParams} from './types';

export function createGapHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClip: (clipId: string) => Clip;
    getClipMediaAsset: (clip: Clip) => MediaAsset | undefined;
  },
) {
  const {
    project,
    gapMenu,
    setGapMenu,
    setSelectedClipId,
    addMedia,
    setTransitionMenu,
    setClipMenu,
    setVolumeEnvelopeMenu,
    setRulerMenu,
  } = params;

  const {findClip, getClipMediaAsset} = helpers;

  function openGapMenu(request: import('../TimelineParts').GapMenuRequest): void {
    setTransitionMenu(undefined);
    setClipMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setRulerMenu(undefined);
    setGapMenu({
      ...request,
      x: Math.min(request.x, Math.max(0, window.innerWidth - 220)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 260)),
    });
  }

  function closeGap(): void {
    if (!gapMenu) {
      return;
    }
    try {
      commandManager.execute(new CloseGapCommand(timelineAccessor, gapMenu.trackId, gapMenu.time));
      setGapMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.closeGapFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  async function fillGap(strategy: GapFillStrategy): Promise<void> {
    if (!gapMenu) {
      return;
    }
    const menu = gapMenu;
    try {
      if (strategy === 'repeat' || strategy === 'crossfade') {
        commandManager.execute(
          new FillGapCommand(timelineAccessor, menu.trackId, menu.time, buildGapFillCommandOperation(strategy)),
        );
        setGapMenu(undefined);
        return;
      }
      const media = await createGapFillMediaAsset(menu, strategy);
      const gap = findTimelineGapAtTime(project.timeline, menu.trackId, menu.time);
      if (!gap) {
        throw new Error(zhCN.timeline.noFillableGapMessage);
      }
      addMedia([media]);
      const clip = createGapFillImageClip({
        name: media.name,
        mediaId: media.id,
        trackId: menu.trackId,
        start: gap.start,
        duration: gap.duration,
      });
      commandManager.execute(
        new FillGapCommand(timelineAccessor, menu.trackId, menu.time, buildGapFillCommandOperation(strategy, { clip })),
      );
      setSelectedClipId(clip.id);
      setGapMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.smartGapFillFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  async function createGapFillMediaAsset(
    menu: GapMenuState,
    strategy: Extract<GapFillStrategy, 'freeze-frame' | 'black' | 'white'>,
  ): Promise<MediaAsset> {
    if (strategy === 'freeze-frame') {
      try {
        const gap = findTimelineGapAtTime(project.timeline, menu.trackId, menu.time);
        const sourceClip = gap?.previousClip;
        const sourceAsset = sourceClip ? getClipMediaAsset(sourceClip) : undefined;
        if (!sourceClip || !sourceAsset || sourceAsset.type === 'audio') {
          throw new Error(zhCN.timeline.freezeFrameUnavailableMessage);
        }
        const frameDuration = 1 / Math.max(1, project.settings.fps || 30);
        const sourceTime =
          'mediaId' in sourceClip
            ? Math.max(0, sourceClip.trimStart + getClipSourceVisibleDuration(sourceClip) - frameDuration)
            : 0;
        const result = await generateGapFillMedia({
          kind: 'freeze-frame',
          sourcePath: sourceAsset.path,
          sourceTime,
          width: sourceAsset.width || project.settings.width,
          height: sourceAsset.height || project.settings.height,
        });
        return buildGapFillAsset(result, zhCN.timeline.gapFillFreezeFrameName);
      } catch {
        return createGapFillMediaAsset(menu, 'black');
      }
    }
    const result = await generateGapFillMedia({
      kind: 'solid-color',
      color: strategy === 'white' ? '#ffffff' : '#000000',
      width: project.settings.width,
      height: project.settings.height,
    });
    return buildGapFillAsset(
      result,
      strategy === 'white' ? zhCN.timeline.gapFillWhiteName : zhCN.timeline.gapFillBlackName,
    );
  }

  function buildGapFillAsset(
    result: { path: string; name: string; width: number; height: number },
    fallbackName: string,
  ): MediaAsset {
    return {
      id: createId('media-gap-fill'),
      type: 'image',
      name: result.name || `${fallbackName}.png`,
      path: result.path,
      duration: 0,
      width: result.width || project.settings.width,
      height: result.height || project.settings.height,
      importedAt: new Date().toISOString(),
    };
  }

  return {
    openGapMenu,
    closeGap,
    fillGap,
    createGapFillMediaAsset,
    buildGapFillAsset,
  };
}

function createGapFillImageClip(options: {
  name: string;
  mediaId: string;
  trackId: string;
  start: number;
  duration: number;
}): Clip {
  // This function is imported from editor-core in the original file
  // For now, we'll create a minimal implementation
  return {
    id: createId('clip'),
    type: 'image',
    name: options.name,
    mediaId: options.mediaId,
    trackId: options.trackId,
    start: options.start,
    duration: options.duration,
    trimStart: 0,
    trimEnd: 0,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    keyframes: {},
    colorLabel: null,
    locked: false,
  } as Clip;
}
