import type { FileStat } from '../lib/tauri-bridge';

export type LocalAiModelId = 'whisper' | 'demucs' | 'yunet';
type LocalAiModelStatus = 'installed' | 'missing' | 'invalid';

export interface LocalAiModelDefinition {
  id: LocalAiModelId;
  version: string;
  minBytes: number;
  maxBytes: number;
  extensions: string[];
  downloadUrl: string;
}

export interface LocalAiModelConfig {
  path?: string;
  version?: string;
  lastUsedAt?: string;
}

export type LocalAiModelsSettings = Partial<Record<LocalAiModelId, LocalAiModelConfig>>;

export interface LocalAiModelResolvedStatus {
  id: LocalAiModelId;
  status: LocalAiModelStatus;
  path?: string;
  size?: number;
  reason?: 'not-configured' | 'missing' | 'size';
}

export const LOCAL_AI_MODEL_DEFINITIONS: Record<LocalAiModelId, LocalAiModelDefinition> = {
  whisper: {
    id: 'whisper',
    version: 'whisper.cpp',
    minBytes: 1024,
    maxBytes: 10 * 1024 * 1024 * 1024,
    extensions: ['bin', 'gguf'],
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/tree/main'
  },
  demucs: {
    id: 'demucs',
    version: 'demucs',
    minBytes: 1024,
    maxBytes: 10 * 1024 * 1024 * 1024,
    extensions: ['exe', 'py', 'pt', 'th', 'ckpt'],
    downloadUrl: 'https://github.com/facebookresearch/demucs'
  },
  yunet: {
    id: 'yunet',
    version: 'YuNet ONNX',
    minBytes: 1024,
    maxBytes: 100 * 1024 * 1024,
    extensions: ['onnx', 'pb', 'xml', 'bin'],
    downloadUrl: 'https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet'
  }
};

export const LOCAL_AI_MODEL_IDS: LocalAiModelId[] = ['whisper', 'demucs', 'yunet'];

export function normalizeLocalAiModelsSettings(value: unknown): LocalAiModelsSettings {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const input = value as Partial<Record<LocalAiModelId, Partial<LocalAiModelConfig>>>;
  const normalized: LocalAiModelsSettings = {};
  for (const id of LOCAL_AI_MODEL_IDS) {
    const entry = input[id];
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const config: LocalAiModelConfig = {};
    if (typeof entry.path === 'string' && entry.path.trim()) {
      config.path = entry.path.trim();
    }
    if (typeof entry.version === 'string' && entry.version.trim()) {
      config.version = entry.version.trim();
    }
    if (typeof entry.lastUsedAt === 'string' && entry.lastUsedAt.trim()) {
      config.lastUsedAt = entry.lastUsedAt.trim();
    }
    if (config.path || config.version || config.lastUsedAt) {
      normalized[id] = config;
    }
  }
  return normalized;
}

export function hasLocalAiModelsSettings(settings: LocalAiModelsSettings): boolean {
  return LOCAL_AI_MODEL_IDS.some((id) => Boolean(settings[id]?.path || settings[id]?.version || settings[id]?.lastUsedAt));
}

export function isLocalModelFileSizeValid(id: LocalAiModelId, size: number): boolean {
  const definition = LOCAL_AI_MODEL_DEFINITIONS[id];
  return Number.isFinite(size) && size >= definition.minBytes && size <= definition.maxBytes;
}

export async function resolveLocalModelStatus(
  id: LocalAiModelId,
  config: LocalAiModelConfig | undefined,
  dependencies: {
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<FileStat>;
  }
): Promise<LocalAiModelResolvedStatus> {
  const path = config?.path?.trim();
  if (!path) {
    return { id, status: 'missing', reason: 'not-configured' };
  }
  if (!(await dependencies.exists(path))) {
    return { id, status: 'missing', path, reason: 'missing' };
  }
  const stat = await dependencies.stat(path);
  if (!isLocalModelFileSizeValid(id, stat.size)) {
    return { id, status: 'invalid', path, size: stat.size, reason: 'size' };
  }
  return { id, status: 'installed', path, size: stat.size };
}
