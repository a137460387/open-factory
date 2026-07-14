import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TauriMocks } from '../lib/tauri-bridge';
import {
  appendExportSpeedSample,
  estimateRemainingSecondsFromHistory,
  getExportSpeedHistoryPath,
  readExportSpeedHistory,
  writeExportSpeedHistory,
} from './export-speed-history';

describe('export speed history', () => {
  const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
  const historyPath = `${appDataDir}/export-speed-history.json`;
  const files = new Map<string, string>();

  beforeEach(() => {
    files.clear();
    vi.stubGlobal('window', {
      __TAURI_MOCKS__: {
        getAppDataDir: () => appDataDir,
        fsExists: (path) => files.has(path),
        readFile: (path) => {
          const value = files.get(path);
          if (value === undefined) {
            throw new Error(`missing ${path}`);
          }
          return value;
        },
        writeFile: (path, contents) => {
          files.set(path, contents);
        },
      } satisfies TauriMocks,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads and writes the AppData speed history file', async () => {
    await expect(getExportSpeedHistoryPath()).resolves.toBe(historyPath);
    await expect(readExportSpeedHistory()).resolves.toEqual({ samples: [] });

    const saved = await writeExportSpeedHistory({
      samples: [
        {
          id: 'task-1',
          projectName: 'Demo',
          outputPath: 'C:/Exports/demo.mp4',
          durationSeconds: 30,
          elapsedMs: 15_000,
          width: 1920,
          height: 1080,
          codec: 'libx264',
          createdAt: '2026-06-17T00:00:00.000Z',
        },
      ],
    });

    expect(JSON.parse(files.get(historyPath) ?? '{}')).toEqual(saved);
    await expect(readExportSpeedHistory()).resolves.toEqual(saved);
  });

  it('appends normalized samples and estimates remaining time from history', async () => {
    await appendExportSpeedSample({
      id: 'recent',
      durationSeconds: 60,
      elapsedMs: 30_000,
      width: 1920,
      height: 1080,
      codec: 'libx264',
      createdAt: '2026-06-17T00:00:00.000Z',
    });
    await appendExportSpeedSample({
      id: 'older',
      durationSeconds: 60,
      elapsedMs: 90_000,
      width: 3840,
      height: 2160,
      codec: 'libx265',
      createdAt: '2026-06-17T00:01:00.000Z',
    });

    const history = await readExportSpeedHistory();
    expect(history.samples.map((sample) => sample.id)).toEqual(['older', 'recent']);
    expect(
      estimateRemainingSecondsFromHistory(history, {
        durationSeconds: 40,
        progress: 0.25,
        width: 1920,
        height: 1080,
        codec: 'libx264',
      }),
    ).toBeGreaterThan(0);
    expect(estimateRemainingSecondsFromHistory({ samples: [] }, { durationSeconds: 40 })).toBeUndefined();
  });
});
