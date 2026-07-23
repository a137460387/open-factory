export const formatSignedNumber = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;

export function formatTrackType(type: string): string {
  if (type === 'video') return '视频';
  if (type === 'audio') return '音频';
  if (type === 'text') return '文字';
  if (type === 'subtitle') return '字幕';
  return type;
}
