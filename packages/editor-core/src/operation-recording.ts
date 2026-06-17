import type { Command } from './commands/command';
import type { Project } from './model';

export const OPERATION_RECORDING_FORMAT = 'open-factory-operation-recording';
export const OPERATION_RECORDING_EXTENSION = 'ofrecording.json';

export type OperationReplaySpeed = 1 | 2 | 4;

export interface RecordedOperationCommand {
  id: string;
  index: number;
  commandType: string;
  description: string;
  timestampMs: number;
  relativeTimeMs: number;
  payload?: unknown;
  projectAfter: Project;
}

export interface OperationRecordingFile {
  format: typeof OPERATION_RECORDING_FORMAT;
  version: 1;
  createdAt: string;
  startedAtMs: number;
  initialProject: Project;
  commands: RecordedOperationCommand[];
}

export interface OperationRecordingSlide {
  stepIndex: number;
  title: string;
  description: string;
  clipCount: number;
  trackCount: number;
  timestampMs: number;
}

export function createOperationRecording(initialProject: Project, options: { createdAt?: string; startedAtMs?: number } = {}): OperationRecordingFile {
  const startedAtMs = finiteNumber(options.startedAtMs, Date.now());
  return {
    format: OPERATION_RECORDING_FORMAT,
    version: 1,
    createdAt: normalizeIsoDate(options.createdAt),
    startedAtMs,
    initialProject: cloneJson(initialProject),
    commands: []
  };
}

export function recordOperationCommand(recording: OperationRecordingFile, command: Command, projectAfter: Project, timestampMs = Date.now()): OperationRecordingFile {
  const normalized = normalizeOperationRecording(recording);
  const index = normalized.commands.length;
  const safeTimestamp = Math.max(normalized.startedAtMs, finiteNumber(timestampMs, normalized.startedAtMs));
  const entry: RecordedOperationCommand = {
    id: `operation-${index + 1}`,
    index,
    commandType: getCommandType(command),
    description: command.description || getCommandType(command),
    timestampMs: safeTimestamp,
    relativeTimeMs: Math.max(0, safeTimestamp - normalized.startedAtMs),
    payload: extractCommandPayload(command),
    projectAfter: cloneJson(projectAfter)
  };
  return {
    ...normalized,
    commands: [...normalized.commands, entry]
  };
}

export function serializeOperationRecording(recording: OperationRecordingFile): string {
  return `${JSON.stringify(normalizeOperationRecording(recording), null, 2)}\n`;
}

export function parseOperationRecording(raw: string): OperationRecordingFile | undefined {
  try {
    return normalizeOperationRecording(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function normalizeOperationRecording(input: unknown): OperationRecordingFile {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid operation recording');
  }
  const record = input as Partial<OperationRecordingFile>;
  if (record.format !== OPERATION_RECORDING_FORMAT || record.version !== 1 || !isProjectLike(record.initialProject)) {
    throw new Error('Invalid operation recording');
  }
  const startedAtMs = finiteNumber(record.startedAtMs, 0);
  const commands = Array.isArray(record.commands)
    ? record.commands.flatMap((command, index): RecordedOperationCommand[] => {
        if (!command || typeof command !== 'object') {
          return [];
        }
        const item = command as Partial<RecordedOperationCommand>;
        if (!isProjectLike(item.projectAfter)) {
          return [];
        }
        const timestampMs = finiteNumber(item.timestampMs, startedAtMs);
        return [
          {
            id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `operation-${index + 1}`,
            index,
            commandType: sanitizeLabel(item.commandType, 'Command'),
            description: sanitizeLabel(item.description, sanitizeLabel(item.commandType, 'Command')),
            timestampMs,
            relativeTimeMs: Math.max(0, finiteNumber(item.relativeTimeMs, timestampMs - startedAtMs)),
            payload: cloneSerializable(item.payload),
            projectAfter: cloneJson(item.projectAfter)
          }
        ];
      })
    : [];
  return {
    format: OPERATION_RECORDING_FORMAT,
    version: 1,
    createdAt: normalizeIsoDate(record.createdAt),
    startedAtMs,
    initialProject: cloneJson(record.initialProject),
    commands
  };
}

export function getOperationReplayDelayMs(previous: RecordedOperationCommand | undefined, next: RecordedOperationCommand, speed: OperationReplaySpeed): number {
  if (!previous) {
    return 0;
  }
  const safeSpeed = normalizeOperationReplaySpeed(speed);
  return Math.max(0, Math.round((next.timestampMs - previous.timestampMs) / safeSpeed));
}

export function buildOperationReplaySchedule(recording: OperationRecordingFile, speed: OperationReplaySpeed): Array<{ index: number; delayMs: number }> {
  const normalized = normalizeOperationRecording(recording);
  return normalized.commands.map((command, index) => ({
    index,
    delayMs: getOperationReplayDelayMs(index > 0 ? normalized.commands[index - 1] : undefined, command, speed)
  }));
}

export function getOperationProjectAtStep(recording: OperationRecordingFile, stepIndex: number): Project {
  const normalized = normalizeOperationRecording(recording);
  const index = Math.floor(stepIndex);
  if (index < 0) {
    return cloneJson(normalized.initialProject);
  }
  return cloneJson(normalized.commands[Math.min(index, normalized.commands.length - 1)]?.projectAfter ?? normalized.initialProject);
}

export function replayOperationRecording(recording: OperationRecordingFile, applyProject: (project: Project, command: RecordedOperationCommand, index: number) => void, upToIndex = Number.POSITIVE_INFINITY): void {
  const normalized = normalizeOperationRecording(recording);
  const maxIndex = Math.min(normalized.commands.length - 1, Math.floor(upToIndex));
  for (const command of normalized.commands) {
    if (command.index > maxIndex) {
      break;
    }
    applyProject(cloneJson(command.projectAfter), command, command.index);
  }
}

export function buildOperationRecordingSlides(recording: OperationRecordingFile, everyNSteps = 1): OperationRecordingSlide[] {
  const normalized = normalizeOperationRecording(recording);
  const step = Math.max(1, Math.floor(everyNSteps));
  return normalized.commands
    .filter((command) => command.index % step === 0 || command.index === normalized.commands.length - 1)
    .map((command) => ({
      stepIndex: command.index,
      title: `Step ${command.index + 1}`,
      description: command.description,
      clipCount: command.projectAfter.timeline.tracks.reduce((count, track) => count + track.clips.length, 0),
      trackCount: command.projectAfter.timeline.tracks.length,
      timestampMs: command.timestampMs
    }));
}

export function generateOperationRecordingSlidesHtml(recording: OperationRecordingFile, everyNSteps = 1): string {
  const slides = buildOperationRecordingSlides(recording, everyNSteps);
  const body = slides
    .map(
      (slide) => `<section class="slide">
  <p class="kicker">${escapeHtml(slide.title)}</p>
  <h2>${escapeHtml(slide.description)}</h2>
  <div class="meta">Clip ${slide.clipCount} / Track ${slide.trackCount} / ${Math.round(slide.timestampMs)} ms</div>
</section>`
    )
    .join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Open Factory 操作回放</title>
  <style>
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #111827; color: #f8fafc; }
    .slide { min-height: 100vh; box-sizing: border-box; display: grid; align-content: center; gap: 18px; padding: 72px; border-bottom: 1px solid #334155; }
    .kicker { margin: 0; color: #38bdf8; font-size: 14px; font-weight: 700; text-transform: uppercase; }
    h2 { margin: 0; max-width: 980px; font-size: 44px; line-height: 1.12; }
    .meta { color: #cbd5e1; font-size: 16px; }
  </style>
</head>
<body>
${body || '<section class="slide"><h2>没有可展示的操作步骤</h2></section>'}
</body>
</html>
`;
}

export function normalizeOperationReplaySpeed(value: unknown): OperationReplaySpeed {
  return value === 2 || value === 4 ? value : 1;
}

function getCommandType(command: Command): string {
  return command.constructor?.name || 'Command';
}

function extractCommandPayload(command: Command): unknown {
  const output: Record<string, unknown> = {};
  const record = command as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'accessor' || key === 'before' || key === 'after' || key === 'description' || key === 'nextProject') {
      continue;
    }
    const cloned = cloneSerializable(value);
    if (cloned !== undefined) {
      output[key] = cloned;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function cloneSerializable(value: unknown): unknown {
  if (value === undefined || typeof value === 'function') {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return undefined;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isProjectLike(value: unknown): value is Project {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as Project).media) && (value as Project).timeline?.tracks);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : fallback;
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
