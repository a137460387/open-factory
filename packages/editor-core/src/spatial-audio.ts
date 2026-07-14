import { round } from './time';

export type SpatialAudioDistance = 'near' | 'medium' | 'far';
export type SpatialAudioRenderMode = 'panner' | 'binaural';
export type SpatialAudioRoomModel = 'none' | 'small-room' | 'hall' | 'outdoor';

export interface ClipSpatialAudio {
  x: number;
  y: number;
  z: number;
  distance: SpatialAudioDistance;
  azimuth: number;
  elevation: number;
  distanceMeters: number;
  renderMode: SpatialAudioRenderMode;
  roomModel: SpatialAudioRoomModel;
}

export const DEFAULT_SPATIAL_AUDIO: ClipSpatialAudio = {
  x: 0,
  y: 0,
  z: 0,
  distance: 'medium',
  azimuth: 0,
  elevation: 0,
  distanceMeters: 1,
  renderMode: 'panner',
  roomModel: 'none',
};

export const SPATIAL_AUDIO_ROOM_MODELS: SpatialAudioRoomModel[] = ['none', 'small-room', 'hall', 'outdoor'];
export const KEMAR_HRTF_FILE_NAME = 'kemar.bin';
export const KEMAR_HRTF_EXPECTED_BYTES = 2 * 1024 * 1024;
export const KEMAR_AZIMUTH_COUNT = 72;
export const KEMAR_ELEVATION_COUNT = 44;
export const KEMAR_AZIMUTH_STEP_DEGREES = 360 / KEMAR_AZIMUTH_COUNT;
export const KEMAR_ELEVATION_MIN_DEGREES = -40;
export const KEMAR_ELEVATION_MAX_DEGREES = 90;
export const KEMAR_ELEVATION_STEP_DEGREES =
  (KEMAR_ELEVATION_MAX_DEGREES - KEMAR_ELEVATION_MIN_DEGREES) / (KEMAR_ELEVATION_COUNT - 1);

export interface KemarHrtfGridSample {
  azimuth: {
    lowerIndex: number;
    upperIndex: number;
    nearestIndex: number;
    weight: number;
  };
  elevation: {
    lowerIndex: number;
    upperIndex: number;
    nearestIndex: number;
    weight: number;
  };
}

export interface SpatialAudioPreviewModeOptions {
  outputChannelCount: number;
  hrtfAvailable: boolean;
}

export function normalizeSpatialAudio(input: Partial<ClipSpatialAudio> | undefined): ClipSpatialAudio {
  return {
    x: normalizeAxis(input?.x),
    y: normalizeAxis(input?.y),
    z: normalizeAxis(input?.z),
    distance: normalizeSpatialAudioDistance(input?.distance),
    azimuth: normalizeAzimuthDegrees(input?.azimuth),
    elevation: normalizeElevationDegrees(input?.elevation),
    distanceMeters: normalizeDistanceMeters(input?.distanceMeters),
    renderMode: normalizeSpatialAudioRenderMode(input?.renderMode),
    roomModel: normalizeSpatialAudioRoomModel(input?.roomModel),
  };
}

export function isDefaultSpatialAudio(input: Partial<ClipSpatialAudio> | undefined): boolean {
  const spatial = normalizeSpatialAudio(input);
  return (
    spatial.x === DEFAULT_SPATIAL_AUDIO.x &&
    spatial.y === DEFAULT_SPATIAL_AUDIO.y &&
    spatial.z === DEFAULT_SPATIAL_AUDIO.z &&
    spatial.distance === DEFAULT_SPATIAL_AUDIO.distance &&
    spatial.azimuth === DEFAULT_SPATIAL_AUDIO.azimuth &&
    spatial.elevation === DEFAULT_SPATIAL_AUDIO.elevation &&
    spatial.distanceMeters === DEFAULT_SPATIAL_AUDIO.distanceMeters &&
    spatial.renderMode === DEFAULT_SPATIAL_AUDIO.renderMode &&
    spatial.roomModel === DEFAULT_SPATIAL_AUDIO.roomModel
  );
}

export function calculateSpatialDistanceGain(input: Partial<ClipSpatialAudio> | undefined): number {
  const spatial = normalizeSpatialAudio(input);
  const distance = Math.min(1, Math.hypot(spatial.x, spatial.y, spatial.z) / Math.sqrt(3));
  const attenuation = spatial.distance === 'near' ? 0.18 : spatial.distance === 'far' ? 0.62 : 0.38;
  return round(Math.max(0.2, 1 - distance * attenuation));
}

export function mapSpatialXToPanGains(x: number): { left: number; right: number } {
  const normalized = normalizeAxis(x);
  return {
    left: round(normalized <= 0 ? 1 : 1 - normalized),
    right: round(normalized >= 0 ? 1 : 1 + normalized),
  };
}

export function resolveSpatialCartesianPosition(input: Partial<ClipSpatialAudio> | undefined): {
  x: number;
  y: number;
  z: number;
} {
  const spatial = normalizeSpatialAudio(input);
  if (spatial.renderMode !== 'binaural') {
    return { x: spatial.x, y: spatial.y, z: spatial.z };
  }
  const azimuth = (spatial.azimuth * Math.PI) / 180;
  const elevation = (spatial.elevation * Math.PI) / 180;
  const radius = Math.min(1, Math.max(0.05, spatial.distanceMeters / 10));
  return {
    x: round(Math.sin(azimuth) * Math.cos(elevation) * radius),
    y: round(Math.cos(azimuth) * Math.cos(elevation) * radius),
    z: round(Math.sin(elevation) * radius),
  };
}

export function resolveKemarHrtfGridSample(input: { azimuth: number; elevation: number }): KemarHrtfGridSample {
  const azimuth = wrapPositiveDegrees(input.azimuth);
  const rawAzimuthIndex = azimuth / KEMAR_AZIMUTH_STEP_DEGREES;
  const azimuthLowerIndex = Math.floor(rawAzimuthIndex) % KEMAR_AZIMUTH_COUNT;
  const azimuthWeight = round(rawAzimuthIndex - Math.floor(rawAzimuthIndex));
  const azimuthUpperIndex = (azimuthLowerIndex + 1) % KEMAR_AZIMUTH_COUNT;

  const elevation = Math.min(KEMAR_ELEVATION_MAX_DEGREES, Math.max(KEMAR_ELEVATION_MIN_DEGREES, input.elevation));
  const rawElevationIndex = (elevation - KEMAR_ELEVATION_MIN_DEGREES) / KEMAR_ELEVATION_STEP_DEGREES;
  const elevationLowerIndex = Math.min(KEMAR_ELEVATION_COUNT - 1, Math.max(0, Math.floor(rawElevationIndex)));
  const elevationUpperIndex = Math.min(KEMAR_ELEVATION_COUNT - 1, elevationLowerIndex + 1);
  const elevationWeight =
    elevationUpperIndex === elevationLowerIndex ? 0 : round(rawElevationIndex - elevationLowerIndex);

  return {
    azimuth: {
      lowerIndex: azimuthLowerIndex,
      upperIndex: azimuthUpperIndex,
      nearestIndex: azimuthWeight < 0.5 ? azimuthLowerIndex : azimuthUpperIndex,
      weight: azimuthWeight,
    },
    elevation: {
      lowerIndex: elevationLowerIndex,
      upperIndex: elevationUpperIndex,
      nearestIndex: elevationWeight < 0.5 ? elevationLowerIndex : elevationUpperIndex,
      weight: elevationWeight,
    },
  };
}

export function resolveSpatialAudioPreviewMode(
  input: Partial<ClipSpatialAudio> | undefined,
  options: SpatialAudioPreviewModeOptions,
): SpatialAudioRenderMode {
  const spatial = normalizeSpatialAudio(input);
  if (spatial.renderMode !== 'binaural' || !options.hrtfAvailable) {
    return 'panner';
  }
  return options.outputChannelCount <= 2 ? 'panner' : 'binaural';
}

export function shouldCopyKemarHrtfAsset(
  exists: boolean,
  sizeBytes: number | undefined,
  expectedBytes = KEMAR_HRTF_EXPECTED_BYTES,
): boolean {
  return !exists || typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < expectedBytes;
}

export function buildKemarHrtfPath(appDataDir: string): string {
  return `${trimTrailingSlashes(appDataDir)}/hrtf/${KEMAR_HRTF_FILE_NAME}`;
}

export function buildRoomImpulseResponsePath(appDataDir: string, roomModel: SpatialAudioRoomModel): string | null {
  const room = normalizeSpatialAudioRoomModel(roomModel);
  if (room === 'none') {
    return null;
  }
  return `${trimTrailingSlashes(appDataDir)}/hrtf/ir/${room}.wav`;
}

export function buildSofalizerArgs(
  input: Partial<ClipSpatialAudio> | undefined,
  hrtfPath: string | undefined,
): string[] {
  const spatial = normalizeSpatialAudio(input);
  if (spatial.renderMode !== 'binaural' || !hrtfPath?.trim()) {
    return [];
  }
  return [
    `sofa=${hrtfPath.trim()}`,
    `azi=${formatSpatialFilterNumber(spatial.azimuth)}`,
    `ele=${formatSpatialFilterNumber(spatial.elevation)}`,
  ];
}

function normalizeAxis(value: number | undefined): number {
  return round(Math.min(1, Math.max(-1, typeof value === 'number' && Number.isFinite(value) ? value : 0)));
}

function normalizeSpatialAudioDistance(value: unknown): SpatialAudioDistance {
  return value === 'near' || value === 'far' ? value : 'medium';
}

function normalizeSpatialAudioRenderMode(value: unknown): SpatialAudioRenderMode {
  return value === 'binaural' ? 'binaural' : 'panner';
}

function normalizeSpatialAudioRoomModel(value: unknown): SpatialAudioRoomModel {
  return value === 'small-room' || value === 'hall' || value === 'outdoor' ? value : 'none';
}

function normalizeAzimuthDegrees(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return round(wrapped === -180 ? 180 : wrapped);
}

function normalizeElevationDegrees(value: number | undefined): number {
  return round(Math.min(90, Math.max(-90, typeof value === 'number' && Number.isFinite(value) ? value : 0)));
}

function normalizeDistanceMeters(value: number | undefined): number {
  return round(Math.min(100, Math.max(0.1, typeof value === 'number' && Number.isFinite(value) ? value : 1)));
}

function wrapPositiveDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function trimTrailingSlashes(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/\\/g, '/');
}

function formatSpatialFilterNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/g, '').replace(/\.$/g, '');
}
