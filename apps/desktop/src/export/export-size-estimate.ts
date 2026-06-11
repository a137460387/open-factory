export interface ExportSizeEstimateInput {
  width: number;
  height: number;
  fps: number;
  duration: number;
  format: string;
  outputMode?: 'video' | 'audio';
  videoBitrate?: string | null;
  audioBitrate?: string | null;
}

export function estimateExportFileSizeBytes(input: ExportSizeEstimateInput): number {
  const duration = Math.max(0.001, input.duration);
  const audioBitsPerSecond = parseBitrate(input.audioBitrate) ?? 128_000;
  if (input.outputMode === 'audio' || input.format === 'm4a') {
    return Math.max(1024, Math.round((audioBitsPerSecond * duration) / 8));
  }

  const format = input.format.toLowerCase();
  if (format === 'gif' || format === 'webp' || format === 'apng') {
    const pixels = Math.max(1, Math.round(input.width) * Math.round(input.height));
    const frames = Math.max(1, Math.ceil(Math.min(120, Math.max(1, input.fps)) * duration));
    const bytesPerPixel =
      format === 'gif'
        ? 0.08
        : format === 'webp'
          ? 0.045
          : 0.12;
    return Math.max(1024, Math.round(pixels * frames * bytesPerPixel));
  }

  const videoBitsPerSecond = parseBitrate(input.videoBitrate) ?? defaultVideoBitsPerSecond(input.width, input.height, input.fps);
  return Math.max(1024, Math.round(((videoBitsPerSecond + audioBitsPerSecond) * duration) / 8));
}

export function formatEstimatedFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function parseBitrate(value: string | null | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?)([kKmM])?$/.exec(value?.trim() ?? '');
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'm') {
    return amount * 1_000_000;
  }
  if (suffix === 'k') {
    return amount * 1_000;
  }
  return amount;
}

function defaultVideoBitsPerSecond(width: number, height: number, fps: number): number {
  const pixelsPerSecond = Math.max(1, width * height * fps);
  return Math.min(35_000_000, Math.max(2_000_000, pixelsPerSecond * 0.16));
}
