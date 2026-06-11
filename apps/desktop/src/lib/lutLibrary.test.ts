import { describe, expect, it } from 'vitest';
import { filterCubeFiles, loadLutLibrary, parseLutFavorites, readLutFavorites, toggleLutFavorite, writeLutFavorites, type LutLibraryStorage } from './lutLibrary';

function makeStorage(files: Map<string, string>, scanned: string[]): LutLibraryStorage {
  return {
    getAppDataDir: () => 'C:/Users/E2E/AppData/Roaming/open-factory',
    scanDirectory: () => scanned,
    readFile: (path) => {
      const value = files.get(path);
      if (value === undefined) {
        throw new Error(`missing ${path}`);
      }
      return value;
    },
    writeFile: (path, contents) => {
      files.set(path, contents);
    }
  };
}

describe('LUT library', () => {
  it('scans only unique .cube files sorted by path', () => {
    expect(filterCubeFiles(['C:/LUTs/z.CUBE', 'C:/LUTs/readme.txt', 'C:/LUTs/a.cube', 'C:/LUTs/a.cube'])).toEqual(['C:/LUTs/a.cube', 'C:/LUTs/z.CUBE']);
  });

  it('loads LUT entries from the user config directory with favorites', async () => {
    const files = new Map([
      ['C:/Users/E2E/AppData/Roaming/open-factory/luts/Warm.cube', cube2()],
      ['C:/Users/E2E/AppData/Roaming/open-factory/lut-favorites.json', JSON.stringify({ favorites: ['C:/Users/E2E/AppData/Roaming/open-factory/luts/Warm.cube'] })]
    ]);
    const storage = makeStorage(files, ['C:/Users/E2E/AppData/Roaming/open-factory/luts/Warm.cube', 'C:/Users/E2E/AppData/Roaming/open-factory/luts/notes.md']);

    const entries = await loadLutLibrary(storage);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      name: 'Warm',
      path: 'C:/Users/E2E/AppData/Roaming/open-factory/luts/Warm.cube',
      favorite: true
    });
  });

  it('parses and normalizes favorite paths defensively', () => {
    expect(parseLutFavorites(JSON.stringify({ favorites: ['C:\\LUTs\\A.cube', 'C:/LUTs/B.txt', 123] }))).toEqual(['C:/LUTs/A.cube']);
    expect(parseLutFavorites('{bad json')).toEqual([]);
  });

  it('writes and toggles favorite paths', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files, []);
    await writeLutFavorites(['C:/LUTs/Warm.cube', 'C:/LUTs/Ignore.txt'], storage);
    expect(await readLutFavorites(storage)).toEqual(['C:/LUTs/Warm.cube']);

    expect(await toggleLutFavorite('C:/LUTs/Cool.cube', storage)).toEqual(['C:/LUTs/Cool.cube', 'C:/LUTs/Warm.cube']);
    expect(await toggleLutFavorite('C:/LUTs/Warm.cube', storage)).toEqual(['C:/LUTs/Cool.cube']);
  });
});

function cube2(): string {
  return [
    'TITLE "Warm"',
    'LUT_3D_SIZE 2',
    '0 0 0',
    '1 0.1 0',
    '0 1 0',
    '1 1 0',
    '0 0 1',
    '1 0 1',
    '0 1 1',
    '1 1 1'
  ].join('\n');
}
