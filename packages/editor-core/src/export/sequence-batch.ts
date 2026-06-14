import {
  PRIMARY_SEQUENCE_ID,
  getProjectSequences,
  replaceProjectActiveTimeline,
  type Project,
  type Sequence
} from '../model';

export class SequenceDependencyCycleError extends Error {
  readonly cycleIds: string[];

  constructor(cycleIds: string[]) {
    super(`Sequence dependency cycle detected: ${cycleIds.join(' -> ')}`);
    this.name = 'SequenceDependencyCycleError';
    this.cycleIds = cycleIds;
  }
}

export function getSequenceDependencyIds(sequence: Sequence): string[] {
  const ids = sequence.timeline.tracks.flatMap((track) =>
    track.clips.flatMap((clip) => (clip.type === 'nested-sequence' ? [clip.sequenceId] : []))
  );
  return Array.from(new Set(ids));
}

export function sortBatchSequenceIds(project: Project, selectedSequenceIds: string[]): string[] {
  const sequences = getSyncedProjectSequences(project);
  const knownIds = new Set(sequences.map((sequence) => sequence.id));
  const selected = new Set(selectedSequenceIds.filter((id) => knownIds.has(id)));
  const dependencies = new Map(sequences.map((sequence) => [sequence.id, getSequenceDependencyIds(sequence).filter((id) => selected.has(id))]));
  const sorted: string[] = [];
  const visiting: string[] = [];
  const visited = new Set<string>();

  function visit(sequenceId: string): void {
    if (visited.has(sequenceId)) {
      return;
    }
    const cycleStart = visiting.indexOf(sequenceId);
    if (cycleStart >= 0) {
      throw new SequenceDependencyCycleError([...visiting.slice(cycleStart), sequenceId]);
    }
    visiting.push(sequenceId);
    for (const dependencyId of dependencies.get(sequenceId) ?? []) {
      visit(dependencyId);
    }
    visiting.pop();
    visited.add(sequenceId);
    sorted.push(sequenceId);
  }

  for (const sequenceId of selectedSequenceIds) {
    if (selected.has(sequenceId)) {
      visit(sequenceId);
    }
  }
  return sorted;
}

export function expandSequenceBatchOutputPath(template: string, sequence: Pick<Sequence, 'name'>, index: number, now = new Date()): string {
  const fallback = `./{sequence}-{index}.mp4`;
  const base = template.trim() || fallback;
  const replacements: Record<string, string> = {
    sequence: sanitizeSequenceFileName(sequence.name),
    index: String(Math.max(1, Math.floor(index))),
    date: formatSequenceBatchDate(now)
  };
  return base.replace(/\{(sequence|index|date)\}/g, (_match, key: keyof typeof replacements) => replacements[key]);
}

export function buildProjectForSequenceExport(project: Project, sequenceId: string): Project {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const sequences = getProjectSequences(synced);
  const sequence = sequences.find((item) => item.id === sequenceId) ?? sequences.find((item) => item.id === PRIMARY_SEQUENCE_ID);
  if (!sequence) {
    return synced;
  }
  const primarySequence: Sequence = { id: PRIMARY_SEQUENCE_ID, name: sequence.name, timeline: sequence.timeline };
  const nonPrimary = sequences
    .filter((item) => item.id !== PRIMARY_SEQUENCE_ID)
    .map((item) => (item.id === sequence.id ? { ...item, timeline: sequence.timeline } : item));
  return {
    ...synced,
    timeline: sequence.timeline,
    sequences: [primarySequence, ...nonPrimary],
    activeSequenceId: PRIMARY_SEQUENCE_ID
  };
}

export function getSyncedProjectSequences(project: Project): Sequence[] {
  return getProjectSequences(replaceProjectActiveTimeline(project, project.timeline));
}

function sanitizeSequenceFileName(name: string): string {
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  return sanitized || 'sequence';
}

function formatSequenceBatchDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}
