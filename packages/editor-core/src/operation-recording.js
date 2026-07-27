export const OPERATION_RECORDING_FORMAT = 'open-factory-operation-recording';
export const OPERATION_RECORDING_EXTENSION = 'ofrecording.json';
export function createOperationRecording(initialProject, options = {}) {
    const startedAtMs = finiteNumber(options.startedAtMs, Date.now());
    return {
        format: OPERATION_RECORDING_FORMAT,
        version: 1,
        createdAt: normalizeIsoDate(options.createdAt),
        startedAtMs,
        initialProject: cloneJson(initialProject),
        commands: [],
    };
}
export function recordOperationCommand(recording, command, projectAfter, timestampMs = Date.now()) {
    const normalized = normalizeOperationRecording(recording);
    const index = normalized.commands.length;
    const safeTimestamp = Math.max(normalized.startedAtMs, finiteNumber(timestampMs, normalized.startedAtMs));
    const entry = {
        id: `operation-${index + 1}`,
        index,
        commandType: getCommandType(command),
        description: command.description || getCommandType(command),
        timestampMs: safeTimestamp,
        relativeTimeMs: Math.max(0, safeTimestamp - normalized.startedAtMs),
        payload: extractCommandPayload(command),
        projectAfter: cloneJson(projectAfter),
    };
    return {
        ...normalized,
        commands: [...normalized.commands, entry],
    };
}
export function serializeOperationRecording(recording) {
    return `${JSON.stringify(normalizeOperationRecording(recording), null, 2)}\n`;
}
export function parseOperationRecording(raw) {
    try {
        return normalizeOperationRecording(JSON.parse(raw));
    }
    catch {
        return undefined;
    }
}
export function normalizeOperationRecording(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Invalid operation recording');
    }
    const record = input;
    if (record.format !== OPERATION_RECORDING_FORMAT || record.version !== 1 || !isProjectLike(record.initialProject)) {
        throw new Error('Invalid operation recording');
    }
    const startedAtMs = finiteNumber(record.startedAtMs, 0);
    const commands = Array.isArray(record.commands)
        ? record.commands.flatMap((command, index) => {
            if (!command || typeof command !== 'object') {
                return [];
            }
            const item = command;
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
                    projectAfter: cloneJson(item.projectAfter),
                },
            ];
        })
        : [];
    return {
        format: OPERATION_RECORDING_FORMAT,
        version: 1,
        createdAt: normalizeIsoDate(record.createdAt),
        startedAtMs,
        initialProject: cloneJson(record.initialProject),
        commands,
    };
}
export function getOperationReplayDelayMs(previous, next, speed) {
    if (!previous) {
        return 0;
    }
    const safeSpeed = normalizeOperationReplaySpeed(speed);
    return Math.max(0, Math.round((next.timestampMs - previous.timestampMs) / safeSpeed));
}
export function buildOperationReplaySchedule(recording, speed) {
    const normalized = normalizeOperationRecording(recording);
    return normalized.commands.map((command, index) => ({
        index,
        delayMs: getOperationReplayDelayMs(index > 0 ? normalized.commands[index - 1] : undefined, command, speed),
    }));
}
export function getOperationProjectAtStep(recording, stepIndex) {
    const normalized = normalizeOperationRecording(recording);
    const index = Math.floor(stepIndex);
    if (index < 0) {
        return cloneJson(normalized.initialProject);
    }
    return cloneJson(normalized.commands[Math.min(index, normalized.commands.length - 1)]?.projectAfter ?? normalized.initialProject);
}
export function replayOperationRecording(recording, applyProject, upToIndex = Number.POSITIVE_INFINITY) {
    const normalized = normalizeOperationRecording(recording);
    const maxIndex = Math.min(normalized.commands.length - 1, Math.floor(upToIndex));
    for (const command of normalized.commands) {
        if (command.index > maxIndex) {
            break;
        }
        applyProject(cloneJson(command.projectAfter), command, command.index);
    }
}
export function buildOperationRecordingSlides(recording, everyNSteps = 1) {
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
        timestampMs: command.timestampMs,
    }));
}
export function generateOperationRecordingSlidesHtml(recording, everyNSteps = 1) {
    const slides = buildOperationRecordingSlides(recording, everyNSteps);
    const body = slides
        .map((slide) => `<section class="slide">
  <p class="kicker">${escapeHtml(slide.title)}</p>
  <h2>${escapeHtml(slide.description)}</h2>
  <div class="meta">Clip ${slide.clipCount} / Track ${slide.trackCount} / ${Math.round(slide.timestampMs)} ms</div>
</section>`)
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
export function normalizeOperationReplaySpeed(value) {
    return value === 2 || value === 4 ? value : 1;
}
function getCommandType(command) {
    return command.constructor?.name || 'Command';
}
function extractCommandPayload(command) {
    const output = {};
    const record = command;
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
function cloneSerializable(value) {
    if (value === undefined || typeof value === 'function') {
        return undefined;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return undefined;
    }
}
function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function isProjectLike(value) {
    return Boolean(value &&
        typeof value === 'object' &&
        Array.isArray(value.media) &&
        value.timeline?.tracks);
}
function finiteNumber(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function sanitizeLabel(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : fallback;
}
function normalizeIsoDate(value) {
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
        return new Date(value).toISOString();
    }
    return new Date().toISOString();
}
function escapeHtml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
//# sourceMappingURL=operation-recording.js.map