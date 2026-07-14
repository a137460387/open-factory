export type MediaCategory = 'video' | 'audio' | 'image';
export type ConversionDirection =
  'video-to-video' | 'video-to-audio' | 'video-to-image-sequence' | 'audio-to-audio' | 'image-to-image';

export interface CodecInfo {
  name: string;
  type: 'encoder' | 'decoder';
  mediaCategory: MediaCategory;
  formats: string[];
}

export interface ConversionPath {
  sourceFormat: string;
  targetFormat: string;
  direction: ConversionDirection;
  intermediateFormat?: string;
  supported: boolean;
  hint?: string;
}

export interface ConversionPreset {
  id: string;
  name: string;
  description: string;
  sourceCategory: MediaCategory[];
  targetFormat: string;
  /** FFmpeg output arguments appended after -i */
  outputArgs: string[];
}

export interface FormatConversionTask {
  id: string;
  sourcePath: string;
  sourceFormat: string;
  targetFormat: string;
  presetId?: string;
  intermediateFormat?: string;
  outputPath: string;
  outputArgs: string[];
  status: 'pending' | 'running' | 'success' | 'error';
  progress: number;
  error?: string;
}

export const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tga', 'exr'];
export const VIDEO_FORMATS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'ts'];
export const AUDIO_FORMATS = ['mp3', 'aac', 'wav', 'flac', 'ogg', 'm4a', 'wma', 'opus'];
export const IMAGE_SEQUENCE_FORMATS = ['png', 'jpg', 'jpeg', 'bmp', 'tiff'];

/** Intermediate formats needed when direct conversion is unsupported. */
const INTERMEDIATE_MAP: Record<string, Record<string, string>> = {
  exr: { mp4: 'png', mkv: 'png', webm: 'png', avi: 'png', mov: 'png' },
  tga: { mp4: 'png', mkv: 'png', webm: 'png' },
};

export function detectMediaCategory(format: string): MediaCategory | undefined {
  const f = format.toLowerCase();
  if (VIDEO_FORMATS.includes(f)) return 'video';
  if (AUDIO_FORMATS.includes(f)) return 'audio';
  if (IMAGE_FORMATS.includes(f)) return 'image';
  return undefined;
}

export function resolveConversionDirection(
  sourceCategory: MediaCategory,
  targetFormat: string,
): ConversionDirection | undefined {
  const targetCategory = detectMediaCategory(targetFormat);
  if (sourceCategory === 'video' && targetCategory === 'video') return 'video-to-video';
  if (sourceCategory === 'video' && targetCategory === 'audio') return 'video-to-audio';
  if (sourceCategory === 'video' && IMAGE_SEQUENCE_FORMATS.includes(targetFormat)) return 'video-to-image-sequence';
  if (sourceCategory === 'audio' && targetCategory === 'audio') return 'audio-to-audio';
  if (sourceCategory === 'image' && targetCategory === 'image') return 'image-to-image';
  return undefined;
}

export function resolveIntermediateFormat(sourceFormat: string, targetFormat: string): string | undefined {
  const src = sourceFormat.toLowerCase();
  const tgt = targetFormat.toLowerCase();
  return INTERMEDIATE_MAP[src]?.[tgt];
}

/** Build the full conversion path, inserting intermediate format if needed. */
export function buildConversionPath(
  sourceFormat: string,
  targetFormat: string,
  availableCodecs?: CodecInfo[],
): ConversionPath {
  const srcCat = detectMediaCategory(sourceFormat);
  if (!srcCat) {
    return {
      sourceFormat,
      targetFormat,
      direction: 'video-to-video',
      supported: false,
      hint: `不支持的源格式: ${sourceFormat}`,
    };
  }
  // Check intermediate format first – some formats need a bridge (e.g. EXR → PNG → MP4)
  const intermediate = resolveIntermediateFormat(sourceFormat, targetFormat);
  if (intermediate) {
    const targetCat = detectMediaCategory(targetFormat) ?? 'video';
    const direction: ConversionDirection =
      targetCat === 'video'
        ? 'image-to-image' // image → intermediate image → then video encode handled externally
        : 'image-to-image';
    return {
      sourceFormat,
      targetFormat,
      direction,
      intermediateFormat: intermediate,
      supported: true,
      hint: `${sourceFormat.toUpperCase()} 转 ${targetFormat.toUpperCase()} 需要中间格式，将自动经过 ${intermediate.toUpperCase()} 序列`,
    };
  }
  const direction = resolveConversionDirection(srcCat, targetFormat);
  if (!direction) {
    return {
      sourceFormat,
      targetFormat,
      direction: 'video-to-video',
      supported: false,
      hint: `${sourceFormat} 无法直接转换为 ${targetFormat}`,
    };
  }
  // Check codec availability if provided
  if (availableCodecs && availableCodecs.length > 0) {
    const hasEncoder = availableCodecs.some((c) => c.type === 'encoder' && c.formats.includes(targetFormat));
    if (!hasEncoder) {
      return { sourceFormat, targetFormat, direction, supported: false, hint: `缺少 ${targetFormat} 编码器` };
    }
  }
  return { sourceFormat, targetFormat, direction, supported: true };
}

/** Build conversion matrix from available codecs. */
export function generateConversionMatrix(codecs: CodecInfo[]): Map<string, ConversionPath[]> {
  const allFormats = new Set<string>();
  for (const codec of codecs) {
    for (const fmt of codec.formats) {
      allFormats.add(fmt);
    }
  }
  const matrix = new Map<string, ConversionPath[]>();
  for (const src of allFormats) {
    const paths: ConversionPath[] = [];
    for (const tgt of allFormats) {
      if (src === tgt) continue;
      paths.push(buildConversionPath(src, tgt, codecs));
    }
    matrix.set(src, paths);
  }
  return matrix;
}

export const BUILTIN_CONVERSION_PRESETS: ConversionPreset[] = [
  {
    id: 'extract-audio-mp3',
    name: '提取音频为MP3',
    description: '从视频文件中提取音轨并保存为MP3格式',
    sourceCategory: ['video'],
    targetFormat: 'mp3',
    outputArgs: ['-vn', '-acodec', 'libmp3lame', '-q:a', '2'],
  },
  {
    id: 'video-to-gif',
    name: '视频转GIF',
    description: '将视频转换为GIF动画',
    sourceCategory: ['video'],
    targetFormat: 'gif',
    outputArgs: ['-vf', 'fps=10,scale=480:-1:flags=lanczos', '-loop', '0'],
  },
  {
    id: 'batch-to-webp',
    name: '批量转WebP',
    description: '将图片批量转换为WebP格式',
    sourceCategory: ['image'],
    targetFormat: 'webp',
    outputArgs: ['-quality', '85'],
  },
  {
    id: 'video-to-mp4-h264',
    name: '视频转MP4(H.264)',
    description: '通用MP4格式转换',
    sourceCategory: ['video'],
    targetFormat: 'mp4',
    outputArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac'],
  },
  {
    id: 'audio-to-wav',
    name: '音频转WAV',
    description: '将音频转换为无损WAV格式',
    sourceCategory: ['audio'],
    targetFormat: 'wav',
    outputArgs: ['-acodec', 'pcm_s16le'],
  },
  {
    id: 'image-to-png',
    name: '图片转PNG',
    description: '将图片转换为PNG格式',
    sourceCategory: ['image'],
    targetFormat: 'png',
    outputArgs: [],
  },
];

/** Build a batch of conversion tasks from source files and a chosen preset. */
export function buildBatchConversionTasks(
  sourceFiles: Array<{ path: string; format: string }>,
  preset: ConversionPreset,
  outputDir: string,
  idPrefix?: string,
): FormatConversionTask[] {
  const prefix = idPrefix ?? 'conv';
  let idx = 0;
  return sourceFiles.flatMap((file) => {
    const srcCat = detectMediaCategory(file.format);
    if (!srcCat || !preset.sourceCategory.includes(srcCat)) {
      return [];
    }
    const path = buildConversionPath(file.format, preset.targetFormat);
    idx += 1;
    const baseName = file.path.replace(/\.[^.]+$/, '');
    return [
      {
        id: `${prefix}-${idx}`,
        sourcePath: file.path,
        sourceFormat: file.format,
        targetFormat: preset.targetFormat,
        presetId: preset.id,
        intermediateFormat: path.intermediateFormat,
        outputPath: `${outputDir}/${baseName}.${preset.targetFormat}`,
        outputArgs: [...preset.outputArgs],
        status: 'pending' as const,
        progress: 0,
      },
    ];
  });
}

export function normalizeConversionPreset(input: Partial<ConversionPreset> | undefined): ConversionPreset | undefined {
  if (!input || typeof input !== 'object') return undefined;
  if (typeof input.id !== 'string' || !input.id.trim()) return undefined;
  if (typeof input.name !== 'string' || !input.name.trim()) return undefined;
  if (typeof input.targetFormat !== 'string' || !input.targetFormat.trim()) return undefined;
  return {
    id: input.id.trim(),
    name: input.name.trim(),
    description: typeof input.description === 'string' ? input.description.trim() : '',
    sourceCategory: Array.isArray(input.sourceCategory)
      ? input.sourceCategory.filter((c) => c === 'video' || c === 'audio' || c === 'image')
      : [],
    targetFormat: input.targetFormat.trim().toLowerCase(),
    outputArgs: Array.isArray(input.outputArgs) ? input.outputArgs.map(String) : [],
  };
}
