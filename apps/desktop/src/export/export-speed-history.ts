import { clamp } from '@open-factory/editor-core/utils/math';
import { fsExists, getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';

const HISTORY_FILE_NAME = 'export-speed-history.json';
const MAX_SPEED_SAMPLES = 100;

export interface ExportSpeedSample {
  id?: string;
  projectName?: string;
  outputPath?: string;
  durationSeconds: number;
  elapsedMs: number;
  width?: number;
  height?: number;
  codec?: string;
  createdAt: string;
}

export interface ExportSpeedHistory {
  samples: ExportSpeedSample[];
  updatedAt?: string;
}

export interface ExportRemainingEstimateInput {
  durationSeconds: number;
  progress?: number;
  width?: number;
  height?: number;
  codec?: string;
}

export async function readExportSpeedHistory(): Promise<ExportSpeedHistory> {
  const path = await getExportSpeedHistoryPath();
  if (!(await fsExists(path).catch(() => false))) {
    return { samples: [] };
  }
  try {
    return normalizeExportSpeedHistory(JSON.parse(await readFile(path)) as Partial<ExportSpeedHistory>);
  } catch {
    return { samples: [] };
  }
}

export async function writeExportSpeedHistory(history: ExportSpeedHistory): Promise<ExportSpeedHistory> {
  const normalized = normalizeExportSpeedHistory(history);
  await writeFile(await getExportSpeedHistoryPath(), JSON.stringify(normalized, null, 2));
  return normalized;
}

export async function appendExportSpeedSample(
  sample: Omit<ExportSpeedSample, 'createdAt'> & { createdAt?: string },
): Promise<ExportSpeedHistory> {
  const history = await readExportSpeedHistory();
  const normalizedSample = normalizeExportSpeedSample({
    ...sample,
    createdAt: sample.createdAt ?? new Date().toISOString(),
  });
  if (!normalizedSample) {
    return history;
  }
  return writeExportSpeedHistory({
    samples: [normalizedSample, ...history.samples].slice(0, MAX_SPEED_SAMPLES),
    updatedAt: normalizedSample.createdAt,
  });
}

export function estimateRemainingSecondsFromHistory(
  history: ExportSpeedHistory,
  input: ExportRemainingEstimateInput,
): number | undefined {
  const normalized = normalizeExportSpeedHistory(history);
  const progress = clamp(input.progress ?? 0, 0, 0.999);
  const durationSeconds = positiveNumber(input.durationSeconds);
  if (!durationSeconds) {
    return undefined;
  }
  const candidates = normalized.samples
    .filter((sample) => !input.codec || !sample.codec || sample.codec === input.codec)
    .map((sample) => ({ sample, weight: speedSampleWeight(sample, input) }))
    .filter(({ weight }) => weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 8);
  if (candidates.length === 0) {
    return undefined;
  }
  const weightedSecondsPerSecond = candidates.reduce(
    (total, item) => total + (item.sample.elapsedMs / 1000 / item.sample.durationSeconds) * item.weight,
    0,
  );
  const weightTotal = candidates.reduce((total, item) => total + item.weight, 0);
  const secondsPerSecond = weightedSecondsPerSecond / weightTotal;
  return Math.max(0, Math.round(durationSeconds * (1 - progress) * secondsPerSecond));
}

export async function getExportSpeedHistoryPath(): Promise<string> {
  const appDataDir = await getAppDataDir();
  return `${appDataDir.replace(/\/+$/, '')}/${HISTORY_FILE_NAME}`;
}

function normalizeExportSpeedHistory(history: Partial<ExportSpeedHistory> | undefined): ExportSpeedHistory {
  if (!history || typeof history !== 'object' || !Array.isArray(history.samples)) {
    return { samples: [] };
  }
  const samples = history.samples.flatMap((sample) => {
    const normalized = normalizeExportSpeedSample(sample);
    return normalized ? [normalized] : [];
  });
  return {
    samples: samples.slice(0, MAX_SPEED_SAMPLES),
    ...(typeof history.updatedAt === 'string' && history.updatedAt.trim()
      ? { updatedAt: history.updatedAt.trim() }
      : {}),
  };
}

function normalizeExportSpeedSample(sample: Partial<ExportSpeedSample> | undefined): ExportSpeedSample | undefined {
  if (!sample || typeof sample !== 'object') {
    return undefined;
  }
  const durationSeconds = positiveNumber(sample.durationSeconds);
  const elapsedMs = positiveNumber(sample.elapsedMs);
  if (!durationSeconds || !elapsedMs) {
    return undefined;
  }
  return {
    ...(typeof sample.id === 'string' && sample.id.trim() ? { id: sample.id.trim() } : {}),
    ...(typeof sample.projectName === 'string' && sample.projectName.trim()
      ? { projectName: sample.projectName.trim() }
      : {}),
    ...(typeof sample.outputPath === 'string' && sample.outputPath.trim()
      ? { outputPath: sample.outputPath.trim() }
      : {}),
    durationSeconds,
    elapsedMs,
    ...(positiveNumber(sample.width) ? { width: Math.round(positiveNumber(sample.width)!) } : {}),
    ...(positiveNumber(sample.height) ? { height: Math.round(positiveNumber(sample.height)!) } : {}),
    ...(typeof sample.codec === 'string' && sample.codec.trim() ? { codec: sample.codec.trim() } : {}),
    createdAt:
      typeof sample.createdAt === 'string' && sample.createdAt.trim()
        ? sample.createdAt.trim()
        : new Date().toISOString(),
  };
}

function speedSampleWeight(sample: ExportSpeedSample, input: ExportRemainingEstimateInput): number {
  let weight = 1;
  if (sample.width && sample.height && input.width && input.height) {
    const samplePixels = sample.width * sample.height;
    const inputPixels = input.width * input.height;
    weight *= 1 / (1 + Math.abs(samplePixels - inputPixels) / Math.max(samplePixels, inputPixels));
  }
  if (sample.codec && input.codec) {
    weight *= sample.codec === input.codec ? 1.5 : 0.35;
  }
  return weight;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}
