import { describe, it, expect, vi } from 'vitest';
import { CommandManager } from './command-manager';
import {
  PropertyChangeCommand,
  PositionChangeCommand,
  ScaleChangeCommand,
  VolumeChangeCommand,
  OpacityChangeCommand,
  PlaybackRateChangeCommand,
} from './command-merge';
import type { Command } from './command';

// Helper: create a simple test command
function makeCommand(description: string, value?: number): Command & { value: number } {
  let v = value ?? 0;
  return {
    description,
    value: v,
    execute() { v++; },
    undo() { v--; },
  };
}

describe('CommandManager', () => {
  describe('basic undo/redo', () => {
    it('executes a command', () => {
      const manager = new CommandManager();
      const cmd = makeCommand('test');
      manager.execute(cmd);
      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(false);
    });

    it('undoes a command', () => {
      const manager = new CommandManager();
      let val = 0;
      manager.execute({
        description: 'increment',
        execute() { val = 1; },
        undo() { val = 0; },
      });
      expect(val).toBe(1);
      manager.undo();
      expect(val).toBe(0);
    });

    it('redoes a command', () => {
      const manager = new CommandManager();
      let val = 0;
      manager.execute({
        description: 'increment',
        execute() { val = 1; },
        undo() { val = 0; },
      });
      manager.undo();
      expect(val).toBe(0);
      manager.redo();
      expect(val).toBe(1);
    });

    it('does nothing when undo stack is empty', () => {
      const manager = new CommandManager();
      manager.undo(); // should not throw
      expect(manager.canUndo()).toBe(false);
    });

    it('does nothing when redo stack is empty', () => {
      const manager = new CommandManager();
      manager.redo(); // should not throw
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('history metadata', () => {
    it('tracks history entries', () => {
      const manager = new CommandManager();
      manager.execute({ description: 'first', execute() {}, undo() {} });
      manager.execute({ description: 'second', execute() {}, undo() {} });

      const meta = manager.getHistoryMeta();
      expect(meta.total).toBe(2);
      expect(meta.position).toBe(2);
      expect(meta.canUndo).toBe(true);
      expect(meta.canRedo).toBe(false);
    });

    it('updates metadata after undo', () => {
      const manager = new CommandManager();
      manager.execute({ description: 'first', execute() {}, undo() {} });
      manager.execute({ description: 'second', execute() {}, undo() {} });
      manager.undo();

      const meta = manager.getHistoryMeta();
      expect(meta.position).toBe(1);
      expect(meta.canRedo).toBe(true);
    });

    it('emits onChange callback', () => {
      const manager = new CommandManager();
      const changes: string[] = [];
      manager.setOnChange((meta) => {
        changes.push(meta.entries[meta.entries.length - 1]?.description ?? 'empty');
      });

      manager.execute({ description: 'test', execute() {}, undo() {} });
      expect(changes).toContain('test');
    });
  });

  describe('max history', () => {
    it('prunes old entries when max is exceeded', () => {
      const manager = new CommandManager(3);
      for (let i = 0; i < 5; i++) {
        manager.execute({ description: `cmd-${i}`, execute() {}, undo() {} });
      }
      expect(manager.historySize()).toBeLessThanOrEqual(3);
    });
  });

  describe('clear', () => {
    it('clears all history', () => {
      const manager = new CommandManager();
      manager.execute({ description: 'test', execute() {}, undo() {} });
      manager.clear();
      expect(manager.canUndo()).toBe(false);
      expect(manager.historySize()).toBe(0);
    });
  });

  describe('operation merging', () => {
    it('merges commands within time window', () => {
      const manager = new CommandManager(100, { mergeWindowMs: 200 });
      let val = 0;

      const makeMergeable = (newVal: number): Command => {
        const cmd: Command & { newVal: number } = {
          description: `set to ${newVal}`,
          execute() { val = newVal; },
          undo() { val = 0; },
          merge(other: Command) {
            const o = other as Command & { newVal?: number };
            return makeMergeable(o.newVal ?? newVal);
          },
          newVal,
        };
        return cmd;
      };

      manager.execute(makeMergeable(1));
      manager.execute(makeMergeable(2));

      // Should have merged into one entry
      const meta = manager.getHistoryMeta();
      expect(meta.total).toBe(1);
    });

    it('does not merge commands outside time window', async () => {
      const manager = new CommandManager(100, { mergeWindowMs: 50 }); // 50ms window
      let val = 0;

      const makeMergeable = (newVal: number): Command => {
        const cmd: Command & { newVal: number } = {
          description: `set to ${newVal}`,
          execute() { val = newVal; },
          undo() { val = 0; },
          merge(other: Command) {
            const o = other as Command & { newVal?: number };
            return makeMergeable(o.newVal ?? newVal);
          },
          newVal,
        };
        return cmd;
      };

      manager.execute(makeMergeable(1));
      // Wait outside the merge window
      await new Promise(r => setTimeout(r, 60));
      manager.execute(makeMergeable(2));

      const meta = manager.getHistoryMeta();
      expect(meta.total).toBe(2); // no merge because we waited past the window
    });

    it('does not merge when command has no merge method', () => {
      const manager = new CommandManager(100, { mergeWindowMs: 200 });
      manager.execute({ description: 'first', execute() {}, undo() {} });
      manager.execute({ description: 'second', execute() {}, undo() {} });

      const meta = manager.getHistoryMeta();
      expect(meta.total).toBe(2);
    });
  });
});

// ==================== Merge Commands ====================

describe('PropertyChangeCommand', () => {
  it('executes and undoes', () => {
    let val = 'old';
    const cmd = new PropertyChangeCommand(
      'entity-1', 'name', 'old', 'new',
      (_id, v) => { val = v as string; },
    );
    cmd.execute();
    expect(val).toBe('new');
    cmd.undo();
    expect(val).toBe('old');
  });

  it('merges with same entity and property', () => {
    let val = 'old';
    const apply = (_id: string, v: unknown) => { val = v as string; };

    const cmd1 = new PropertyChangeCommand('e1', 'name', 'old', 'mid', apply);
    const cmd2 = new PropertyChangeCommand('e1', 'name', 'mid', 'new', apply);

    const merged = cmd1.merge(cmd2);
    expect(merged).toBeInstanceOf(PropertyChangeCommand);
    merged!.execute();
    expect(val).toBe('new');
    merged!.undo();
    expect(val).toBe('old');
  });

  it('does not merge with different entity', () => {
    const apply = () => {};
    const cmd1 = new PropertyChangeCommand('e1', 'name', 'old', 'new', apply);
    const cmd2 = new PropertyChangeCommand('e2', 'name', 'old', 'new', apply);
    expect(cmd1.merge(cmd2)).toBeNull();
  });

  it('does not merge with different property', () => {
    const apply = () => {};
    const cmd1 = new PropertyChangeCommand('e1', 'name', 'old', 'new', apply);
    const cmd2 = new PropertyChangeCommand('e1', 'value', 'old', 'new', apply);
    expect(cmd1.merge(cmd2)).toBeNull();
  });
});

describe('PositionChangeCommand', () => {
  it('merges consecutive position changes', () => {
    let pos = { start: 0, trackIndex: 0 };
    const apply = (_id: string, p: { start: number; trackIndex: number }) => { pos = { ...p }; };

    const cmd1 = new PositionChangeCommand('clip-1', { start: 0, trackIndex: 0 }, { start: 10, trackIndex: 0 }, apply);
    const cmd2 = new PositionChangeCommand('clip-1', { start: 10, trackIndex: 0 }, { start: 25, trackIndex: 1 }, apply);

    const merged = cmd1.merge(cmd2);
    expect(merged).toBeDefined();

    merged!.execute();
    expect(pos).toEqual({ start: 25, trackIndex: 1 });
    merged!.undo();
    expect(pos).toEqual({ start: 0, trackIndex: 0 });
  });

  it('does not merge different clips', () => {
    const apply = () => {};
    const cmd1 = new PositionChangeCommand('clip-1', { start: 0, trackIndex: 0 }, { start: 10, trackIndex: 0 }, apply);
    const cmd2 = new PositionChangeCommand('clip-2', { start: 0, trackIndex: 0 }, { start: 10, trackIndex: 0 }, apply);
    expect(cmd1.merge(cmd2)).toBeNull();
  });
});

describe('ScaleChangeCommand', () => {
  it('merges scale changes', () => {
    let scale = 1;
    const apply = (_id: string, s: number) => { scale = s; };

    const cmd1 = new ScaleChangeCommand('clip-1', 1, 1.5, apply);
    const cmd2 = new ScaleChangeCommand('clip-1', 1.5, 2.0, apply);

    const merged = cmd1.merge(cmd2);
    merged!.execute();
    expect(scale).toBe(2.0);
    merged!.undo();
    expect(scale).toBe(1);
  });
});

describe('VolumeChangeCommand', () => {
  it('merges volume changes', () => {
    let vol = 1;
    const apply = (_id: string, v: number) => { vol = v; };

    const cmd1 = new VolumeChangeCommand('clip-1', 1, 0.5, apply);
    const cmd2 = new VolumeChangeCommand('clip-1', 0.5, 0.2, apply);

    const merged = cmd1.merge(cmd2);
    merged!.execute();
    expect(vol).toBe(0.2);
    merged!.undo();
    expect(vol).toBe(1);
  });
});

describe('OpacityChangeCommand', () => {
  it('merges opacity changes', () => {
    let opacity = 1;
    const apply = (_id: string, o: number) => { opacity = o; };

    const cmd1 = new OpacityChangeCommand('clip-1', 1, 0.8, apply);
    const cmd2 = new OpacityChangeCommand('clip-1', 0.8, 0.5, apply);

    const merged = cmd1.merge(cmd2);
    merged!.execute();
    expect(opacity).toBe(0.5);
    merged!.undo();
    expect(opacity).toBe(1);
  });
});

describe('PlaybackRateChangeCommand', () => {
  it('merges playback rate changes', () => {
    let rate = 1;
    const apply = (_id: string, r: number) => { rate = r; };

    const cmd1 = new PlaybackRateChangeCommand('clip-1', 1, 1.5, apply);
    const cmd2 = new PlaybackRateChangeCommand('clip-1', 1.5, 2.0, apply);

    const merged = cmd1.merge(cmd2);
    merged!.execute();
    expect(rate).toBe(2.0);
    merged!.undo();
    expect(rate).toBe(1);
  });
});
