import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  parseFfmpegProgress,
  terminateFfmpegChildProcess,
  FFMPEG_ABORT_KILL_DELAY_MS,
} from '../../src/headless/headless-renderer';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('node:child_process', () => ({ spawn: spawnMock }));
vi.mock('node:fs/promises', () => ({
  stat: vi.fn().mockResolvedValue({ size: 100 }),
}));

describe('parseFfmpegProgress', () => {
  test('parses frame, fps, and time from ffmpeg output', () => {
    const line = 'frame=  120 fps= 30 q=28.0 size=    1024kB time=00:00:04.00 bitrate= 2097.2kbits/s speed=2.0x';
    const result = parseFfmpegProgress(line, 10);

    expect(result).not.toBeNull();
    expect(result!.phase).toBe('rendering');
    expect(result!.frame).toBe(120);
    expect(result!.fps).toBe(30);
    expect(result!.percent).toBeCloseTo(40, 0);
  });

  test('handles zero duration gracefully', () => {
    const line = 'frame=  60 fps= 30 q=28.0 size=    512kB time=00:00:02.00 bitrate= 2097.2kbits/s';
    const result = parseFfmpegProgress(line, 0);

    expect(result).not.toBeNull();
    expect(result!.percent).toBe(0);
  });

  test('caps percent at 100', () => {
    const line = 'frame=  300 fps= 30 q=28.0 size=    2048kB time=00:00:10.00 bitrate= 2097.2kbits/s';
    const result = parseFfmpegProgress(line, 5);

    expect(result).not.toBeNull();
    expect(result!.percent).toBeLessThanOrEqual(100);
  });

  test('returns null for non-progress lines', () => {
    expect(parseFfmpegProgress('ffmpeg version 6.0', 10)).toBeNull();
    expect(parseFfmpegProgress('Input #0, mp4', 10)).toBeNull();
    expect(parseFfmpegProgress('', 10)).toBeNull();
  });

  test('parses time correctly for long videos', () => {
    const line = 'frame= 9000 fps= 30 q=28.0 size=   10240kB time=00:05:00.00 bitrate= 2097.2kbits/s';
    const result = parseFfmpegProgress(line, 600);

    expect(result).not.toBeNull();
    expect(result!.percent).toBeCloseTo(50, 0);
  });
});

class FakeProc extends EventEmitter {
  stderr = new EventEmitter();
  stdout = new EventEmitter();
  readonly kills: Array<string | number | undefined> = [];

  kill(signal?: string | number): boolean {
    this.kills.push(signal);
    return true;
  }
}

const BASE_OPTIONS = {
  config: { ffmpegPath: 'ffmpeg' },
  args: ['-i', 'in.mp4'],
  outputPath: '/out.mp4',
  duration: 10,
};

describe('terminateFfmpegChildProcess', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('sends SIGTERM on abort and SIGKILL after the delay when still running', () => {
    const proc = new FakeProc();
    const controller = new AbortController();
    const cleanup = terminateFfmpegChildProcess(proc, controller.signal);

    controller.abort();
    expect(proc.kills).toEqual(['SIGTERM']);

    vi.advanceTimersByTime(FFMPEG_ABORT_KILL_DELAY_MS);
    expect(proc.kills).toEqual(['SIGTERM', 'SIGKILL']);

    cleanup();
  });

  test('does not schedule SIGKILL when the process is already gone', () => {
    const proc = new FakeProc();
    proc.kill = (signal?: string | number) => {
      proc.kills.push(signal);
      return false;
    };
    const controller = new AbortController();
    const cleanup = terminateFfmpegChildProcess(proc, controller.signal);

    controller.abort();
    expect(proc.kills).toEqual(['SIGTERM']);

    vi.advanceTimersByTime(FFMPEG_ABORT_KILL_DELAY_MS);
    expect(proc.kills).toEqual(['SIGTERM']);

    cleanup();
  });

  test('handles an already-aborted signal', () => {
    const proc = new FakeProc();
    const controller = new AbortController();
    controller.abort();
    const cleanup = terminateFfmpegChildProcess(proc, controller.signal);

    expect(proc.kills).toEqual(['SIGTERM']);
    vi.advanceTimersByTime(FFMPEG_ABORT_KILL_DELAY_MS);
    expect(proc.kills).toEqual(['SIGTERM', 'SIGKILL']);

    cleanup();
  });

  test('cleanup stops abort handling and clears the kill timer', () => {
    const proc = new FakeProc();
    const controller = new AbortController();
    const cleanup = terminateFfmpegChildProcess(proc, controller.signal);
    cleanup();

    controller.abort();
    expect(proc.kills).toEqual([]);

    vi.advanceTimersByTime(FFMPEG_ABORT_KILL_DELAY_MS);
    expect(proc.kills).toEqual([]);
  });
});

describe('executeFfmpegRender with AbortSignal', () => {
  beforeEach(() => {
    vi.useRealTimers();
    spawnMock.mockReset();
  });

  test('rejects with aborted result when signal aborts during render', async () => {
    const proc = new FakeProc();
    spawnMock.mockReturnValue(proc);
    const { executeFfmpegRender } = await import('../../src/headless/headless-renderer');

    const controller = new AbortController();
    const promise = executeFfmpegRender(BASE_OPTIONS, controller.signal);
    // executeFfmpegRender awaits dynamic imports before spawn; wait for it
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));

    controller.abort();
    expect(proc.kills).toEqual(['SIGTERM']);

    proc.emit('close', null);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain('aborted');
  });

  test('kills an already-aborted signal immediately without registering a listener', async () => {
    const proc = new FakeProc();
    spawnMock.mockReturnValue(proc);
    const { executeFfmpegRender } = await import('../../src/headless/headless-renderer');

    const controller = new AbortController();
    controller.abort();
    const promise = executeFfmpegRender(BASE_OPTIONS, controller.signal);
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));

    expect(proc.kills).toEqual(['SIGTERM']);

    proc.emit('close', null);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain('aborted');
  });

  test('behaves identically when no signal is provided', async () => {
    const proc = new FakeProc();
    spawnMock.mockReturnValue(proc);
    const { executeFfmpegRender } = await import('../../src/headless/headless-renderer');

    const promise = executeFfmpegRender(BASE_OPTIONS);
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));

    proc.emit('close', 0);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe('/out.mp4');
    expect(proc.kills).toEqual([]);
  });
});
