import { describe, expect, it } from 'vitest';
import {
  getTimelineScriptPath,
  getTimelineScriptsDir,
  loadTimelineScripts,
  saveTimelineScript,
} from './timeline-scripts';

describe('timeline script file library', () => {
  it('stores scripts under AppData scripts directory', () => {
    const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';

    expect(getTimelineScriptsDir(appDataDir)).toBe('C:/Users/E2E/AppData/Roaming/open-factory/scripts');
    expect(getTimelineScriptPath(appDataDir, 'Batch Speed')).toBe(
      'C:/Users/E2E/AppData/Roaming/open-factory/scripts/Batch Speed.js',
    );
  });

  it('saves, renames, and loads local scripts', async () => {
    const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
    const files = new Map<string, string>();
    const deleted: string[] = [];
    const storage = {
      getAppDataDir: () => appDataDir,
      fsExists: (path: string) => path === `${appDataDir}/scripts` || files.has(path),
      scanDirectory: (path: string) => Array.from(files.keys()).filter((candidate) => candidate.startsWith(`${path}/`)),
      readFile: (path: string) => files.get(path) ?? '',
      writeFile: (path: string, contents: string) => {
        files.set(path, contents);
      },
      removeFile: (path: string) => {
        deleted.push(path);
        files.delete(path);
      },
    };

    const first = await saveTimelineScript('Batch Speed', 'console.log("a");', undefined, storage);
    const renamed = await saveTimelineScript('Batch Speed v2', 'console.log("b");', first.path, storage);
    const scripts = await loadTimelineScripts(storage);

    expect(deleted).toEqual([first.path]);
    expect(renamed.path).toBe(`${appDataDir}/scripts/Batch Speed v2.js`);
    expect(scripts).toEqual([
      { id: renamed.path, name: 'Batch Speed v2', path: renamed.path, code: 'console.log("b");\n' },
    ]);
  });
});
