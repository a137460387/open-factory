import { getAppDataDir, readFile, scanDirectory, writeFile } from './tauri-bridge';

export interface LutLibraryItem {
  id: string;
  name: string;
  path: string;
  favorite: boolean;
  previewDataUrl: string;
}

export interface LutLibraryStorage {
  getAppDataDir(): Promise<string> | string;
  scanDirectory(path: string, depth?: number): Promise<string[]> | string[];
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

const LUT_FAVORITES_FILE = 'lut-favorites.json';

const DEFAULT_STORAGE: LutLibraryStorage = {
  getAppDataDir,
  scanDirectory,
  readFile,
  writeFile,
};

export async function loadLutLibrary(storage: LutLibraryStorage = DEFAULT_STORAGE): Promise<LutLibraryItem[]> {
  const root = normalizePath(await storage.getAppDataDir());
  const paths = filterCubeFiles(await storage.scanDirectory(root, 4));
  const favorites = await readLutFavorites(storage);
  const favoriteSet = new Set(favorites);
  return Promise.all(
    paths.map(async (path) => {
      const contents = await storage.readFile(path);
      return {
        id: stableLutId(path),
        name: lutDisplayName(path),
        path,
        favorite: favoriteSet.has(path),
        previewDataUrl: renderCubePreviewDataUrl(contents),
      };
    }),
  );
}

export function filterCubeFiles(paths: string[]): string[] {
  return Array.from(new Set(paths.map(normalizePath).filter((path) => path.toLowerCase().endsWith('.cube')))).sort(
    (left, right) => left.localeCompare(right),
  );
}

export async function readLutFavorites(storage: LutLibraryStorage = DEFAULT_STORAGE): Promise<string[]> {
  const root = normalizePath(await storage.getAppDataDir());
  try {
    return parseLutFavorites(await storage.readFile(joinConfigPath(root, LUT_FAVORITES_FILE)));
  } catch {
    return [];
  }
}

export async function writeLutFavorites(
  paths: string[],
  storage: LutLibraryStorage = DEFAULT_STORAGE,
): Promise<string[]> {
  const root = normalizePath(await storage.getAppDataDir());
  const unique = filterCubeFiles(paths);
  await storage.writeFile(joinConfigPath(root, LUT_FAVORITES_FILE), JSON.stringify({ favorites: unique }, null, 2));
  return unique;
}

export async function toggleLutFavorite(path: string, storage: LutLibraryStorage = DEFAULT_STORAGE): Promise<string[]> {
  const normalized = normalizePath(path);
  const current = await readLutFavorites(storage);
  const next = current.includes(normalized) ? current.filter((item) => item !== normalized) : [...current, normalized];
  return writeLutFavorites(next, storage);
}

export function parseLutFavorites(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as { favorites?: unknown };
    if (!Array.isArray(parsed.favorites)) {
      return [];
    }
    return filterCubeFiles(parsed.favorites.filter((item): item is string => typeof item === 'string'));
  } catch {
    return [];
  }
}

function renderCubePreviewDataUrl(contents: string, width = 96, height = 54): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const lut = parseCubeLut(contents);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return '';
  }
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const source: Rgb = {
        r: width <= 1 ? 0 : x / (width - 1),
        g: height <= 1 ? 0 : y / (height - 1),
        b: 0.5,
      };
      const output = lut ? applyCubeLut(source, lut) : source;
      image.data[offset] = Math.round(output.r * 255);
      image.data[offset + 1] = Math.round(output.g * 255);
      image.data[offset + 2] = Math.round(output.b * 255);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  context.getImageData(0, 0, 1, 1);
  return canvas.toDataURL('image/png');
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface CubeLut {
  size: number;
  values: Rgb[];
}

function parseCubeLut(contents: string): CubeLut | undefined {
  let size = 0;
  const values: Rgb[] = [];
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('TITLE') || line.startsWith('DOMAIN_')) {
      continue;
    }
    const sizeMatch = line.match(/^LUT_3D_SIZE\s+(\d+)$/i);
    if (sizeMatch) {
      size = Number(sizeMatch[1]);
      continue;
    }
    if (/^LUT_1D_SIZE\s+/i.test(line)) {
      continue;
    }
    const channels = line.split(/\s+/).map(Number);
    if (channels.length >= 3 && channels.every(Number.isFinite)) {
      values.push({ r: clamp01(channels[0]), g: clamp01(channels[1]), b: clamp01(channels[2]) });
    }
  }
  if (size < 2 || values.length < size * size * size) {
    return undefined;
  }
  return { size, values };
}

function applyCubeLut(input: Rgb, lut: CubeLut): Rgb {
  const r = Math.round(clamp01(input.r) * (lut.size - 1));
  const g = Math.round(clamp01(input.g) * (lut.size - 1));
  const b = Math.round(clamp01(input.b) * (lut.size - 1));
  return lut.values[r + g * lut.size + b * lut.size * lut.size] ?? input;
}

function lutDisplayName(path: string): string {
  const normalized = normalizePath(path);
  const file = normalized.split('/').pop() ?? normalized;
  return file.replace(/\.cube$/i, '');
}

function stableLutId(path: string): string {
  return `lut-${normalizePath(path)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}`;
}

function joinConfigPath(root: string, fileName: string): string {
  return `${root.replace(/\/+$/g, '')}/${fileName}`;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
