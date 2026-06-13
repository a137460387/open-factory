import { createId, type Clip, type ClipGroup, type ClipGroupColor, type ColorCorrection } from './model';
import { round } from './time';

export const CLIP_GROUP_COLORS: readonly ClipGroupColor[] = ['blue', 'green', 'purple', 'amber', 'rose', 'cyan'] as const;

export const CLIP_GROUP_COLOR_HEX: Record<ClipGroupColor, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  purple: '#7c3aed',
  amber: '#d97706',
  rose: '#e11d48',
  cyan: '#0891b2'
};

export const DEFAULT_CLIP_GROUP_COLOR: ClipGroupColor = 'blue';
export const DEFAULT_CLIP_GROUP_NAME = 'Group';

export interface ClipGroupInput {
  id?: string;
  name?: string;
  clipIds: string[];
  color?: ClipGroupColor | string;
}

export interface ClipGroupBatchPatch {
  volume?: number;
  speed?: number;
  colorCorrection?: Partial<ColorCorrection>;
}

type NormalizableClipGroup = Partial<Omit<ClipGroup, 'color'>> & { color?: ClipGroupColor | string };

export function normalizeClipGroups(groups: readonly NormalizableClipGroup[] | undefined, availableClipIds?: Iterable<string>): ClipGroup[] {
  const available = availableClipIds ? new Set(availableClipIds) : undefined;
  const usedClipIds = new Set<string>();
  const output: ClipGroup[] = [];
  for (const group of groups ?? []) {
    const normalized = normalizeClipGroup(group, available, usedClipIds);
    if (normalized) {
      output.push(normalized);
      for (const clipId of normalized.clipIds) {
        usedClipIds.add(clipId);
      }
    }
  }
  return output;
}

export function createClipGroup(input: ClipGroupInput, availableClipIds?: Iterable<string>): ClipGroup {
  const normalized = normalizeClipGroup(input, availableClipIds ? new Set(availableClipIds) : undefined);
  if (!normalized) {
    throw new Error('Clip group requires at least two clips');
  }
  return normalized;
}

export function findClipGroupForClip(groups: readonly ClipGroup[] | undefined, clipId: string): ClipGroup | undefined {
  return (groups ?? []).find((group) => group.clipIds.includes(clipId));
}

export function findCompleteClipGroup(groups: readonly ClipGroup[] | undefined, clipIds: readonly string[]): ClipGroup | undefined {
  const selected = new Set(clipIds);
  return (groups ?? []).find((group) => group.clipIds.length === selected.size && group.clipIds.every((clipId) => selected.has(clipId)));
}

export function calculateClipGroupMoveStarts(
  clips: readonly Pick<Clip, 'id' | 'start'>[],
  clipIds: readonly string[],
  draggedClipId: string,
  newDraggedStart: number
): Record<string, number> {
  const clipById = new Map(clips.map((clip) => [clip.id, clip]));
  const uniqueIds = Array.from(new Set(clipIds)).filter((clipId) => clipById.has(clipId));
  if (uniqueIds.length === 0) {
    return {};
  }
  const dragged = clipById.get(draggedClipId);
  if (!dragged || !uniqueIds.includes(draggedClipId)) {
    throw new Error(`Clip ${draggedClipId} is not part of the group`);
  }
  const minStart = Math.min(...uniqueIds.map((clipId) => clipById.get(clipId)?.start ?? 0));
  const requestedDelta = newDraggedStart - dragged.start;
  const delta = round(Math.max(requestedDelta, -minStart));
  return Object.fromEntries(uniqueIds.map((clipId) => [clipId, round(Math.max(0, (clipById.get(clipId)?.start ?? 0) + delta))]));
}

export function removeClipIdsFromGroups(groups: readonly ClipGroup[] | undefined, clipIds: Iterable<string>): ClipGroup[] {
  const removed = new Set(clipIds);
  return normalizeClipGroups(
    (groups ?? []).map((group) => ({
      ...group,
      clipIds: group.clipIds.filter((clipId) => !removed.has(clipId))
    }))
  );
}

function normalizeClipGroup(
  group: NormalizableClipGroup,
  availableClipIds?: Set<string>,
  usedClipIds: Set<string> = new Set()
): ClipGroup | undefined {
  const clipIds = Array.from(new Set((group.clipIds ?? []).filter((clipId): clipId is string => typeof clipId === 'string' && clipId.trim().length > 0)))
    .filter((clipId) => !availableClipIds || availableClipIds.has(clipId))
    .filter((clipId) => !usedClipIds.has(clipId));
  if (clipIds.length < 2) {
    return undefined;
  }
  const name = typeof group.name === 'string' && group.name.trim() ? group.name.trim().slice(0, 80) : DEFAULT_CLIP_GROUP_NAME;
  const color = isClipGroupColor(group.color) ? group.color : DEFAULT_CLIP_GROUP_COLOR;
  return {
    id: typeof group.id === 'string' && group.id.trim() ? group.id : createId('group'),
    name,
    clipIds,
    color
  };
}

function isClipGroupColor(value: unknown): value is ClipGroupColor {
  return typeof value === 'string' && CLIP_GROUP_COLORS.includes(value as ClipGroupColor);
}
