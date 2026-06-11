import { describe, expect, it } from 'vitest';
import { parseCustomKeybindings, readCustomKeybindings, writeCustomKeybindings, type KeybindingStorage } from './keybindings';

function makeStorage(files: Map<string, string>): KeybindingStorage {
  return {
    getAppDataDir: () => 'C:/Users/E2E/AppData/Roaming/open-factory',
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

describe('shortcut keybindings storage', () => {
  it('parses known actions and normalizes accelerators', () => {
    expect(
      parseCustomKeybindings(
        JSON.stringify({
          bindings: {
            'toggle-playback': ['p', 'P'],
            unknown: ['X'],
            redo: 'cmd+shift+z'
          }
        })
      )
    ).toEqual({
      'toggle-playback': ['P'],
      redo: ['Ctrl+Shift+Z']
    });
  });

  it('returns empty bindings for invalid JSON or missing files', async () => {
    expect(parseCustomKeybindings('{bad')).toEqual({});
    expect(await readCustomKeybindings(makeStorage(new Map()))).toEqual({});
  });

  it('writes sanitized bindings into the app config directory', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);

    await writeCustomKeybindings({ 'toggle-playback': ['p'], 'clear-selection': [] }, storage);

    const raw = files.get('C:/Users/E2E/AppData/Roaming/open-factory/keybindings.json');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).bindings).toEqual({ 'toggle-playback': ['P'] });
  });
});
