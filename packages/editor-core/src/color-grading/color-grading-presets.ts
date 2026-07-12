// packages/editor-core/src/color-grading/color-grading-presets.ts
import type { ColorGradingGraph } from './types';

/** 调色预设 */
export interface ColorGradingPreset {
  id: string;
  name: string;
  author: string;
  description?: string;
  tags: string[];
  graph: ColorGradingGraph;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

/** 预设文件格式 */
export interface ColorGradingPresetFile {
  schemaVersion: 1;
  kind: 'open-factory.color-grading-preset';
  preset: ColorGradingPreset;
}

/** 创建调色预设 */
export function createColorGradingPreset(
  name: string,
  graph: ColorGradingGraph,
  options?: Partial<Omit<ColorGradingPreset, 'id' | 'name' | 'graph' | 'createdAt' | 'updatedAt'>>
): ColorGradingPreset {
  const now = new Date().toISOString();
  return {
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    author: options?.author || 'User',
    description: options?.description,
    tags: options?.tags || [],
    graph,
    thumbnail: options?.thumbnail,
    createdAt: now,
    updatedAt: now,
  };
}

/** 序列化预设为文件 */
export function serializeColorGradingPreset(preset: ColorGradingPreset): string {
  const file: ColorGradingPresetFile = {
    schemaVersion: 1,
    kind: 'open-factory.color-grading-preset',
    preset,
  };
  return JSON.stringify(file, null, 2);
}

/** 从文件反序列化预设 */
export function deserializeColorGradingPreset(json: string): ColorGradingPreset | null {
  try {
    const file = JSON.parse(json);
    if (file.schemaVersion !== 1 || file.kind !== 'open-factory.color-grading-preset') {
      return null;
    }
    return file.preset as ColorGradingPreset;
  } catch {
    return null;
  }
}

/** 验证预设 */
export function validateColorGradingPreset(preset: unknown): preset is ColorGradingPreset {
  if (!preset || typeof preset !== 'object') return false;
  const p = preset as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.author === 'string' &&
    p.graph !== undefined &&
    typeof p.createdAt === 'string'
  );
}

/** 内置预设 */
export const BUILTIN_COLOR_PRESETS: ColorGradingPreset[] = [
  {
    id: 'builtin-cinematic',
    name: '电影感',
    author: 'open-factory',
    description: '经典电影色调，低饱和度，高对比度',
    tags: ['cinematic', 'film', 'classic'],
    graph: {
      nodes: [
        {
          id: 'cinematic-wheel',
          type: 'primary-wheel',
          enabled: true,
          params: {
            lift: { r: -0.05, g: -0.05, b: 0.05, y: 0 },
            liftMaster: 0,
            gamma: { r: 0.02, g: 0, b: -0.02, y: 0 },
            gammaMaster: 0,
            gain: { r: 0.05, g: 0.03, b: -0.03, y: 0 },
            gainMaster: 0,
            offset: { r: 0, g: 0, b: 0, y: 0 },
            offsetMaster: 0,
          },
          inputs: [],
          output: null,
          position: { x: 0, y: 0 },
        },
        {
          id: 'cinematic-slider',
          type: 'primary-slider',
          enabled: true,
          params: {
            temperature: 10,
            tint: -5,
            contrast: 15,
            pivot: 0.5,
            saturation: 80,
            hue: 0,
          },
          inputs: [],
          output: null,
          position: { x: 200, y: 0 },
        },
      ],
      connections: [],
      activeNodeId: null,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-vintage',
    name: '复古',
    author: 'open-factory',
    description: '复古胶片风格，暖色调',
    tags: ['vintage', 'retro', 'warm'],
    graph: {
      nodes: [
        {
          id: 'vintage-wheel',
          type: 'primary-wheel',
          enabled: true,
          params: {
            lift: { r: 0.1, g: 0.05, b: -0.05, y: 0 },
            liftMaster: 0,
            gamma: { r: 0.05, g: 0.02, b: -0.03, y: 0 },
            gammaMaster: 0,
            gain: { r: 0, g: 0, b: 0, y: 0 },
            gainMaster: 0,
            offset: { r: 0, g: 0, b: 0, y: 0 },
            offsetMaster: 0,
          },
          inputs: [],
          output: null,
          position: { x: 0, y: 0 },
        },
        {
          id: 'vintage-slider',
          type: 'primary-slider',
          enabled: true,
          params: {
            temperature: 25,
            tint: 0,
            contrast: 10,
            pivot: 0.5,
            saturation: 70,
            hue: 0,
          },
          inputs: [],
          output: null,
          position: { x: 200, y: 0 },
        },
      ],
      connections: [],
      activeNodeId: null,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];
