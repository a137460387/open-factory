import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  parseMultipleCommands,
  buildSpeechGrammarHints,
  commandNeedsTarget,
} from '../src/natural-language-commands';

describe('parseCommand (Chinese)', () => {
  it('parses cut command', () => {
    const cmd = parseCommand('剪切这个片段', { language: 'zh' });
    expect(cmd.type).toBe('cut');
    expect(cmd.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('parses delete command', () => {
    const cmd = parseCommand('删除选中的片段', { language: 'zh' });
    expect(cmd.type).toBe('delete');
  });

  it('parses speed command with multiplier', () => {
    const cmd = parseCommand('加速2倍', { language: 'zh' });
    expect(cmd.type).toBe('speed');
    expect(cmd.params.speed).toBe(2);
  });

  it('parses speed up without number', () => {
    const cmd = parseCommand('加速', { language: 'zh' });
    expect(cmd.type).toBe('speed');
    expect(cmd.params.speed).toBe(2);
  });

  it('parses go-to with timecode', () => {
    const cmd = parseCommand('跳到1:30', { language: 'zh' });
    expect(cmd.type).toBe('go-to');
    expect(cmd.params.time).toBe(90);
  });

  it('parses play command', () => {
    const cmd = parseCommand('开始播放', { language: 'zh' });
    expect(cmd.type).toBe('play');
  });

  it('parses pause command', () => {
    const cmd = parseCommand('暂停', { language: 'zh' });
    expect(cmd.type).toBe('pause');
  });

  it('parses undo command', () => {
    const cmd = parseCommand('撤销', { language: 'zh' });
    expect(cmd.type).toBe('undo');
  });

  it('parses export command', () => {
    const cmd = parseCommand('导出视频', { language: 'zh' });
    expect(cmd.type).toBe('export');
  });

  it('parses mute command', () => {
    const cmd = parseCommand('静音', { language: 'zh' });
    expect(cmd.type).toBe('mute');
  });

  it('parses volume command with percentage', () => {
    const cmd = parseCommand('音量50%', { language: 'zh' });
    expect(cmd.type).toBe('volume');
    expect(cmd.params.volume).toBe(50);
  });

  it('parses add effect command', () => {
    const cmd = parseCommand('加个效果模糊', { language: 'zh' });
    expect(cmd.type).toBe('add-effect');
  });

  it('parses zoom in command', () => {
    const cmd = parseCommand('放大时间线', { language: 'zh' });
    expect(cmd.type).toBe('zoom-in');
  });

  it('returns unknown for unrecognized input', () => {
    const cmd = parseCommand('asdfghjkl', { language: 'zh' });
    expect(cmd.type).toBe('unknown');
    expect(cmd.confidence).toBe(0);
  });

  it('returns unknown for empty input', () => {
    const cmd = parseCommand('', { language: 'zh' });
    expect(cmd.type).toBe('unknown');
  });

  it('parses split command', () => {
    const cmd = parseCommand('从这里分割', { language: 'zh' });
    expect(cmd.type).toBe('split');
  });

  it('parses skip forward', () => {
    const cmd = parseCommand('前进5秒', { language: 'zh' });
    expect(cmd.type).toBe('skip-forward');
    expect(cmd.params.seconds).toBe(5);
  });

  it('parses transition command', () => {
    const cmd = parseCommand('加转场淡入淡出', { language: 'zh' });
    expect(cmd.type).toBe('add-transition');
  });
});

describe('parseCommand (English)', () => {
  it('parses cut command', () => {
    const cmd = parseCommand('cut this clip', { language: 'en' });
    expect(cmd.type).toBe('cut');
  });

  it('parses delete command', () => {
    const cmd = parseCommand('delete selected', { language: 'en' });
    expect(cmd.type).toBe('delete');
  });

  it('parses play command', () => {
    const cmd = parseCommand('play', { language: 'en' });
    expect(cmd.type).toBe('play');
  });

  it('parses export command', () => {
    const cmd = parseCommand('export the video', { language: 'en' });
    expect(cmd.type).toBe('export');
  });

  it('parses zoom in', () => {
    const cmd = parseCommand('zoom in', { language: 'en' });
    expect(cmd.type).toBe('zoom-in');
  });

  it('parses undo', () => {
    const cmd = parseCommand('undo', { language: 'en' });
    expect(cmd.type).toBe('undo');
  });

  it('parses mute', () => {
    const cmd = parseCommand('mute', { language: 'en' });
    expect(cmd.type).toBe('mute');
  });
});

describe('parseMultipleCommands', () => {
  it('splits by Chinese delimiters', () => {
    const cmds = parseMultipleCommands('播放然后暂停', { language: 'zh' });
    expect(cmds.length).toBe(2);
    expect(cmds[0].type).toBe('play');
    expect(cmds[1].type).toBe('pause');
  });

  it('splits by 再', () => {
    const cmds = parseMultipleCommands('删除这个再撤销', { language: 'zh' });
    expect(cmds.length).toBe(2);
    expect(cmds[0].type).toBe('delete');
    expect(cmds[1].type).toBe('undo');
  });

  it('returns single command for no delimiters', () => {
    const cmds = parseMultipleCommands('播放', { language: 'zh' });
    expect(cmds.length).toBe(1);
  });
});

describe('buildSpeechGrammarHints', () => {
  it('returns Chinese hints', () => {
    const hints = buildSpeechGrammarHints('zh');
    expect(hints).toContain('剪切');
    expect(hints).toContain('播放');
    expect(hints.length).toBeGreaterThan(10);
  });

  it('returns English hints', () => {
    const hints = buildSpeechGrammarHints('en');
    expect(hints).toContain('cut');
    expect(hints).toContain('play');
  });
});

describe('commandNeedsTarget', () => {
  it('returns true for clip operations', () => {
    expect(commandNeedsTarget('cut')).toBe(true);
    expect(commandNeedsTarget('delete')).toBe(true);
    expect(commandNeedsTarget('split')).toBe(true);
    expect(commandNeedsTarget('speed')).toBe(true);
  });

  it('returns false for playback operations', () => {
    expect(commandNeedsTarget('play')).toBe(false);
    expect(commandNeedsTarget('pause')).toBe(false);
    expect(commandNeedsTarget('undo')).toBe(false);
    expect(commandNeedsTarget('redo')).toBe(false);
    expect(commandNeedsTarget('export')).toBe(false);
  });
});
