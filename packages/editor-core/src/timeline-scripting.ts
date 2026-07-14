import type { Command } from './commands/command';
import {
  AddClipCommand,
  AddTimelineMarkerCommand,
  DeleteClipCommand,
  UpdateClipCommand,
  type AddTimelineMarkerInput,
  type ClipPatch,
  type TimelineAccessor,
} from './commands/timeline-commands';
import type { Clip, Project, Timeline, TimelineMarker } from './model';
import { getTimelineDuration } from './timeline';

export type TimelineScriptApiFunctionName =
  'getClips' | 'updateClip' | 'addClip' | 'deleteClip' | 'getMarkers' | 'addMarker' | 'exportProject';

export interface TimelineScriptApiSignature {
  name: TimelineScriptApiFunctionName;
  signature: string;
  description: string;
}

export const TIMELINE_SCRIPT_API_SIGNATURES: TimelineScriptApiSignature[] = [
  {
    name: 'getClips',
    signature: 'getClips(): Clip[]',
    description: 'Return a cloned list of clips from the active timeline.',
  },
  {
    name: 'updateClip',
    signature: 'updateClip(id: string, patch: Partial<Clip>): void',
    description: 'Queue a patch for a timeline clip.',
  },
  {
    name: 'addClip',
    signature: 'addClip(opts: Clip): void',
    description: 'Queue a complete clip object to insert into the timeline.',
  },
  {
    name: 'deleteClip',
    signature: 'deleteClip(id: string): void',
    description: 'Queue removal for one timeline clip.',
  },
  {
    name: 'getMarkers',
    signature: 'getMarkers(): TimelineMarker[]',
    description: 'Return a cloned list of active timeline markers.',
  },
  {
    name: 'addMarker',
    signature: 'addMarker(time: number, label?: string): void',
    description: 'Queue a marker insertion on the active timeline.',
  },
  {
    name: 'exportProject',
    signature: 'exportProject(preset: string): void',
    description: 'Queue an export request for the host export panel.',
  },
];

export interface BuiltinTimelineScript {
  id: string;
  code: string;
}

export const BUILTIN_TIMELINE_SCRIPTS: BuiltinTimelineScript[] = [
  {
    id: 'bulk-speed',
    code: [
      'const clips = getClips();',
      'for (const clip of clips) {',
      '  if (clip.type === "video" || clip.type === "audio" || clip.type === "nested-sequence") {',
      '    updateClip(clip.id, { speed: 1.25 });',
      '  }',
      '}',
      'console.log(`updated ${clips.length} clips`);',
    ].join('\n'),
  },
  {
    id: 'sort-by-color-label',
    code: [
      'const order = ["red", "orange", "yellow", "green", "blue", "purple", "gray"];',
      'const clips = getClips().slice().sort((left, right) => {',
      '  const leftIndex = order.indexOf(left.colorLabel ?? "gray");',
      '  const rightIndex = order.indexOf(right.colorLabel ?? "gray");',
      '  return (leftIndex < 0 ? order.length : leftIndex) - (rightIndex < 0 ? order.length : rightIndex) || left.start - right.start;',
      '});',
      'let cursor = 0;',
      'for (const clip of clips) {',
      '  updateClip(clip.id, { start: cursor });',
      '  cursor += clip.duration;',
      '}',
      'console.log(`sorted ${clips.length} clips by color label`);',
    ].join('\n'),
  },
  {
    id: 'minute-markers',
    code: [
      'const clips = getClips();',
      'const duration = clips.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);',
      'for (let time = 60; time < duration; time += 60) {',
      '  addMarker(time, `Minute ${Math.round(time / 60)}`);',
      '}',
      'console.log(`timeline duration ${duration.toFixed(1)}s`);',
    ].join('\n'),
  },
  {
    id: 'export-each-clip',
    code: [
      'for (const clip of getClips()) {',
      '  exportProject(`clip-${clip.id}`);',
      '  console.log(`queued export for ${clip.name}`);',
      '}',
    ].join('\n'),
  },
  {
    id: 'project-stats',
    code: [
      'const clips = getClips();',
      'const markers = getMarkers();',
      'const duration = clips.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);',
      'console.log(`clips=${clips.length}`);',
      'console.log(`markers=${markers.length}`);',
      'console.log(`duration=${duration.toFixed(2)}s`);',
    ].join('\n'),
  },
];

export interface TimelineScriptSnapshot {
  clips: Clip[];
  markers: TimelineMarker[];
  duration: number;
}

export type TimelineScriptOperation =
  | { type: 'updateClip'; clipId: string; patch: ClipPatch }
  | { type: 'addClip'; clip: Clip }
  | { type: 'deleteClip'; clipId: string }
  | { type: 'addMarker'; marker: AddTimelineMarkerInput }
  | { type: 'exportProject'; preset: string };

export interface TimelineScriptExecutionPlan {
  operations: TimelineScriptOperation[];
  logs: string[];
  durationMs: number;
}

export function createTimelineScriptSnapshot(project: Pick<Project, 'timeline'>): TimelineScriptSnapshot {
  const timeline = project.timeline;
  return {
    clips: cloneJson(timeline.tracks.flatMap((track) => track.clips)),
    markers: cloneJson(timeline.markers ?? []),
    duration: getTimelineDuration(timeline),
  };
}

export function getTimelineScriptApiFunctionNames(): TimelineScriptApiFunctionName[] {
  return TIMELINE_SCRIPT_API_SIGNATURES.map((signature) => signature.name);
}

export function normalizeTimelineScriptOperations(operations: TimelineScriptOperation[]): TimelineScriptOperation[] {
  return operations.map((operation) => normalizeTimelineScriptOperation(operation));
}

export function getTimelineScriptExportRequests(
  operations: TimelineScriptOperation[],
): Array<Extract<TimelineScriptOperation, { type: 'exportProject' }>> {
  return normalizeTimelineScriptOperations(operations).filter(
    (operation): operation is Extract<TimelineScriptOperation, { type: 'exportProject' }> =>
      operation.type === 'exportProject',
  );
}

export class RunScriptCommand implements Command {
  readonly description: string;
  private before?: Timeline;
  private after?: Timeline;
  private appliedCount = 0;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly operations: TimelineScriptOperation[],
    description = 'Run timeline script',
  ) {
    this.description = description;
  }

  get appliedOperationCount(): number {
    return this.appliedCount;
  }

  execute(): void {
    this.before ??= this.accessor.getTimeline();
    if (!this.after) {
      const normalized = normalizeTimelineScriptOperations(this.operations);
      let timeline = this.before;
      let appliedCount = 0;
      const scriptAccessor: TimelineAccessor = {
        getTimeline: () => timeline,
        setTimeline: (nextTimeline) => {
          timeline = nextTimeline;
        },
      };

      for (const operation of normalized) {
        if (operation.type === 'updateClip') {
          new UpdateClipCommand(scriptAccessor, operation.clipId, operation.patch).execute();
          appliedCount += 1;
        } else if (operation.type === 'addClip') {
          new AddClipCommand(scriptAccessor, operation.clip).execute();
          appliedCount += 1;
        } else if (operation.type === 'deleteClip') {
          new DeleteClipCommand(scriptAccessor, operation.clipId).execute();
          appliedCount += 1;
        } else if (operation.type === 'addMarker') {
          new AddTimelineMarkerCommand(scriptAccessor, operation.marker).execute();
          appliedCount += 1;
        }
      }

      this.after = timeline;
      this.appliedCount = appliedCount;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

function normalizeTimelineScriptOperation(operation: TimelineScriptOperation): TimelineScriptOperation {
  if (!operation || typeof operation !== 'object') {
    throw new Error('Invalid timeline script operation');
  }
  if (operation.type === 'updateClip') {
    return {
      type: 'updateClip',
      clipId: normalizeRequiredString(operation.clipId, 'clip id'),
      patch: normalizeRecord(operation.patch, 'clip patch') as ClipPatch,
    };
  }
  if (operation.type === 'addClip') {
    return {
      type: 'addClip',
      clip: normalizeClipLike(operation.clip),
    };
  }
  if (operation.type === 'deleteClip') {
    return {
      type: 'deleteClip',
      clipId: normalizeRequiredString(operation.clipId, 'clip id'),
    };
  }
  if (operation.type === 'addMarker') {
    return {
      type: 'addMarker',
      marker: normalizeMarkerInput(operation.marker),
    };
  }
  if (operation.type === 'exportProject') {
    return {
      type: 'exportProject',
      preset: normalizeRequiredString(operation.preset, 'export preset'),
    };
  }
  throw new Error('Unsupported timeline script operation');
}

function normalizeMarkerInput(marker: AddTimelineMarkerInput): AddTimelineMarkerInput {
  const value = normalizeRecord(marker, 'timeline marker');
  const time = Number(value.time);
  if (!Number.isFinite(time)) {
    throw new Error('Timeline marker time must be finite');
  }
  const output: AddTimelineMarkerInput = { time };
  if (typeof value.id === 'string' && value.id.trim()) {
    output.id = value.id.trim();
  }
  if (typeof value.label === 'string') {
    output.label = value.label;
  }
  if (typeof value.color === 'string') {
    output.color = value.color;
  }
  return output;
}

function normalizeClipLike(clip: Clip): Clip {
  const value = normalizeRecord(clip, 'clip') as Partial<Clip>;
  normalizeRequiredString(value.id, 'clip id');
  normalizeRequiredString(value.trackId, 'track id');
  normalizeRequiredString(value.name, 'clip name');
  normalizeRequiredString(value.type, 'clip type');
  return value as Clip;
}

function normalizeRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return cloneJson(value as Record<string, unknown>);
}

function normalizeRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${label}`);
  }
  return value.trim();
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
