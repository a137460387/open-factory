import React from 'react';
import { useEditorStore } from '../../store/editorStore';
import { PanelTitle } from './InspectorFields';
import { PropertyPanel } from './PropertyPanel';
import { EffectPanel } from './EffectPanel';
import { AudioPanel } from './AudioPanel';
import { SpeedPanel } from './SpeedPanel';
import { MotionPanel } from './MotionPanel';
import { AISceneMatchPanel } from './AISceneMatchPanel';
import { AIDenoisePanel } from './AIDenoisePanel';
import { AIBrollSuggestionPanel } from './AIBrollSuggestionPanel';
import type { ClipInspectorStateParams, ClipInspectorStateReturn } from './useClipInspectorState';

export type ClipInspectorBodyProps = ClipInspectorStateParams & ClipInspectorStateReturn;

export const ClipInspectorBody = React.memo(function ClipInspectorBody(props: ClipInspectorBodyProps) {
  const { clip, media, project, selectedClipLocked } = props;

  return (
    <aside className="flex min-h-0 flex-col bg-panel">
      <PanelTitle />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <PropertyPanel {...props} />
        <SpeedPanel {...props} />
        <AudioPanel {...props} />
        <EffectPanel {...props} />
        <MotionPanel {...props} />

        {/* AI Panels (kept in container - not worth separate panel) */}
        {'mediaId' in clip ? (
          <AISceneMatchPanel
            clip={clip}
            media={media}
            timelineClips={project.timeline.tracks.flatMap((track) => track.clips)}
            selectedClipLocked={selectedClipLocked}
          />
        ) : null}
        {'mediaId' in clip && (clip.type === 'audio' || clip.type === 'video') ? (
          <AIDenoisePanel
            clip={clip}
            trackId={project.timeline.tracks.find((t) => t.clips.some((c) => c.id === clip.id))?.id ?? ''}
            onUpdateTrack={(trackId, patch) => {
              const newTracks = project.timeline.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t));
              useEditorStore.getState().setProject({
                ...project,
                timeline: { ...project.timeline, tracks: newTracks },
              });
              useEditorStore.getState().setSelectedClipIds([clip.id]);
            }}
          />
        ) : null}
        {clip.type === 'subtitle' ? (
          <AIBrollSuggestionPanel
            clip={clip}
            trackId={project.timeline.tracks.find((t) => t.clips.some((c) => c.id === clip.id))?.id ?? ''}
            allClips={project.timeline.tracks.flatMap((t) => t.clips.map((c) => ({ ...c, trackId: t.id })))}
            allMedia={media}
            onInsertSuggestion={(suggestion) => {
              const newTrack = {
                id: 'broll-track-' + Date.now(),
                name: 'B-roll',
                type: 'video' as const,
                clips: [
                  {
                    id: 'broll-clip-' + Date.now(),
                    type: 'video' as const,
                    trackId: 'broll-track-' + Date.now(),
                    start: suggestion.insertTime,
                    duration: 3,
                    mediaId: suggestion.mediaId,
                    name: 'B-roll',
                    trimStart: 0,
                    trimEnd: 0,
                    speed: 1,
                    volume: 1,
                    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
                    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                  },
                ],
              };
              useEditorStore.getState().setProject({
                ...project,
                timeline: {
                  ...project.timeline,
                  tracks: [...project.timeline.tracks, newTrack],
                  brollSuggestions: (project.timeline.brollSuggestions ?? []).map((s) =>
                    s.segmentId === suggestion.segmentId && s.mediaId === suggestion.mediaId
                      ? { ...s, status: 'accepted' as const }
                      : s,
                  ),
                },
              });
              useEditorStore.getState().setSelectedClipIds([clip.id]);
            }}
            onUpdateSuggestions={(suggestions) => {
              useEditorStore.getState().setProject({
                ...project,
                timeline: { ...project.timeline, brollSuggestions: suggestions },
              });
              useEditorStore.getState().setSelectedClipIds([clip.id]);
            }}
          />
        ) : null}
      </div>
    </aside>
  );
});
