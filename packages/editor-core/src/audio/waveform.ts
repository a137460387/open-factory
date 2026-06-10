export interface DecodedWaveformInput {
  channels: Float32Array[];
  sampleRate: number;
  pointsPerSecond: number;
}

export interface DecodedWaveform {
  peaks: number[];
  duration: number;
  channels: number;
  pointsPerSecond: number;
  samplesPerPoint: number;
  isSampled: boolean;
}

export interface PixelPeakInput {
  channels: Float32Array[];
  pixelWidth: number;
}

export function extractDecodedWaveform(input: DecodedWaveformInput): DecodedWaveform {
  const channels = input.channels.filter((channel) => channel.length > 0);
  const sampleRate = Math.max(1, input.sampleRate);
  const pointsPerSecond = Math.max(1, input.pointsPerSecond);
  const maxSamples = Math.max(0, ...channels.map((channel) => channel.length));
  const duration = maxSamples / sampleRate;
  const totalPoints = Math.max(1, Math.ceil(duration * pointsPerSecond));
  const samplesPerPoint = Math.max(1, Math.floor(maxSamples / totalPoints));
  const peaks: number[] = [];

  for (let point = 0; point < totalPoints; point += 1) {
    const start = point * samplesPerPoint;
    const end = point === totalPoints - 1 ? maxSamples : Math.min(maxSamples, start + samplesPerPoint);
    let peak = 0;
    for (const channel of channels) {
      for (let index = start; index < end && index < channel.length; index += 1) {
        peak = Math.max(peak, Math.abs(channel[index]));
      }
    }
    peaks.push(Number(Math.min(1, peak).toFixed(4)));
  }

  return {
    peaks,
    duration,
    channels: channels.length,
    pointsPerSecond,
    samplesPerPoint,
    isSampled: false
  };
}

export function sampleAudioPeaksForPixels(input: PixelPeakInput): number[] {
  const channels = input.channels.filter((channel) => channel.length > 0);
  const pixelWidth = Math.max(1, Math.round(input.pixelWidth));
  if (channels.length === 0) {
    return Array.from({ length: pixelWidth }, () => 0);
  }
  const maxSamples = Math.max(...channels.map((channel) => channel.length));
  const peaks: number[] = [];

  for (let pixel = 0; pixel < pixelWidth; pixel += 1) {
    const start = Math.floor((pixel / pixelWidth) * maxSamples);
    const end = pixel === pixelWidth - 1 ? maxSamples : Math.max(start + 1, Math.floor(((pixel + 1) / pixelWidth) * maxSamples));
    let peak = 0;
    for (const channel of channels) {
      for (let index = start; index < end && index < channel.length; index += 1) {
        peak = Math.max(peak, Math.abs(channel[index]));
      }
    }
    peaks.push(Number(Math.min(1, peak).toFixed(4)));
  }

  return peaks;
}

export function buildWaveformChannelHash(channels: number, sampleRate: number, duration: number): string {
  return `ch=${Math.max(0, Math.round(channels))}|sr=${Math.max(0, Math.round(sampleRate))}|d=${Math.max(0, duration).toFixed(3)}`;
}

export function buildTimelineWaveformCacheKey(mediaPath: string, channelHash: string): string {
  return `${mediaPath.replace(/\\/g, '/')}|${channelHash}`;
}
