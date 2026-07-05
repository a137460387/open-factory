export type FileSniffCategory = 'video' | 'audio' | 'image';
export type FileSniffStatus = 'match' | 'unknown' | 'mismatch';

export interface FileSniffRule {
  category: FileSniffCategory;
  extensions: string[];
  label: string;
  match: (header: Uint8Array) => boolean;
}

export interface FileSniffResult {
  status: FileSniffStatus;
  detectedLabel?: string;
  extension: string;
  expectedCategory?: FileSniffCategory;
  detectedCategory?: FileSniffCategory;
}

const SNIFF_RULES: FileSniffRule[] = [
  {
    category: 'video',
    extensions: ['.mp4', '.m4v', '.m4a', '.mov', '.qt'],
    label: 'MP4/MOV',
    match: (h) => h.length >= 8 && h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70
  },
  {
    category: 'video',
    extensions: ['.mkv', '.webm'],
    label: 'MKV/WebM',
    match: (h) => h.length >= 4 && h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3
  },
  {
    category: 'video',
    extensions: ['.avi'],
    label: 'AVI',
    match: (h) => h.length >= 12 && h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 && h[8] === 0x41 && h[9] === 0x56 && h[10] === 0x49 && h[11] === 0x20
  },
  {
    category: 'video',
    extensions: ['.ts', '.mts', '.m2ts'],
    label: 'MPEG-TS',
    match: (h) => h.length >= 1 && h[0] === 0x47
  },
  {
    category: 'audio',
    extensions: ['.wav', '.wave'],
    label: 'WAV',
    match: (h) => h.length >= 12 && h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 && h[8] === 0x57 && h[9] === 0x41 && h[10] === 0x56 && h[11] === 0x45
  },
  {
    category: 'audio',
    extensions: ['.mp3'],
    label: 'MP3',
    match: (h) => (h.length >= 3 && h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) || (h.length >= 2 && h[0] === 0xff && (h[1] & 0xe0) === 0xe0)
  },
  {
    category: 'audio',
    extensions: ['.flac'],
    label: 'FLAC',
    match: (h) => h.length >= 4 && h[0] === 0x66 && h[1] === 0x4c && h[2] === 0x61 && h[3] === 0x43
  },
  {
    category: 'audio',
    extensions: ['.ogg', '.oga', '.opus'],
    label: 'OGG',
    match: (h) => h.length >= 4 && h[0] === 0x4f && h[1] === 0x67 && h[2] === 0x67 && h[3] === 0x53
  },
  {
    category: 'audio',
    extensions: ['.aac'],
    label: 'AAC/ADTS',
    match: (h) => h.length >= 2 && h[0] === 0xff && (h[1] & 0xf6) === 0xf0
  },
  {
    category: 'image',
    extensions: ['.png'],
    label: 'PNG',
    match: (h) => h.length >= 8 && h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47 && h[4] === 0x0d && h[5] === 0x0a && h[6] === 0x1a && h[7] === 0x0a
  },
  {
    category: 'image',
    extensions: ['.jpg', '.jpeg'],
    label: 'JPEG',
    match: (h) => h.length >= 3 && h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff
  },
  {
    category: 'image',
    extensions: ['.gif'],
    label: 'GIF',
    match: (h) => h.length >= 6 && h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38
  },
  {
    category: 'image',
    extensions: ['.webp'],
    label: 'WebP',
    match: (h) => h.length >= 12 && h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 && h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50
  }
];

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) {
    return '';
  }
  return filename.slice(dot).toLowerCase();
}

export function classifyFileExtension(extension: string): FileSniffCategory | undefined {
  const videoExts = ['.mp4', '.m4v', '.mov', '.qt', '.mkv', '.webm', '.avi', '.ts', '.mts', '.m2ts', '.wmv', '.flv', '.3gp'];
  const audioExts = ['.wav', '.wave', '.mp3', '.flac', '.ogg', '.oga', '.opus', '.aac', '.m4a', '.wma'];
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg'];
  if (videoExts.includes(extension)) {
    return 'video';
  }
  if (audioExts.includes(extension)) {
    return 'audio';
  }
  if (imageExts.includes(extension)) {
    return 'image';
  }
  return undefined;
}

export function sniffFileHeader(header: Uint8Array, filename: string): FileSniffResult {
  const extension = getFileExtension(filename);
  const expectedCategory = classifyFileExtension(extension);
  if (!header || header.length === 0) {
    return { status: 'unknown', extension, expectedCategory };
  }

  for (const rule of SNIFF_RULES) {
    if (rule.match(header)) {
      const extensionMatch = rule.extensions.includes(extension);
      if (extensionMatch) {
        return { status: 'match', detectedLabel: rule.label, extension, expectedCategory, detectedCategory: rule.category };
      }
      if (expectedCategory && rule.category === expectedCategory) {
        return { status: 'match', detectedLabel: rule.label, extension, expectedCategory, detectedCategory: rule.category };
      }
      return { status: 'mismatch', detectedLabel: rule.label, extension, expectedCategory, detectedCategory: rule.category };
    }
  }

  return { status: 'unknown', extension, expectedCategory };
}
