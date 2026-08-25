// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/gap-handlers.ts（170 行 3.53% → ≥80%）
// 策略：工厂直调 createGapHandlers(params, helpers)，mock commandManager 断言命令对象，
// v4.74.0 专项：锁定轨道守卫由 CloseGapCommand 抛错路径覆盖、1e-6 容差由编辑器核心纯函数保证，此处验证 hooks 层正确传递参数。
import {describe, expect, it, vi, beforeEach} from 'vitest';

// vi.hoisted：vi.mock 工厂被提升到文件顶部执行，普通 const 届时未初始化
const {executeMock, generateGapFillMediaMock, showToastMock} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  generateGapFillMediaMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock('../../../../../store/commandManager', () => ({
  commandManager: {execute: (command: unknown) => executeMock(command)},
  projectAccessor: {getProject: vi.fn(), setProject: vi.fn()},
  timelineAccessor: {getTimeline: vi.fn(), setTimeline: vi.fn()},
  setEditorStoreGetter: vi.fn(),
  addOnExecuteListener: vi.fn(),
}));

vi.mock('../../../../../lib/tauri-bridge', () => ({
  generateGapFillMedia: (...args: unknown[]) => generateGapFillMediaMock(...args),
}));

vi.mock('../../../../../lib/toast', () => ({
  showToast: (toast: unknown) => showToastMock(toast),
}));

import {createGapHandlers} from '../gap-handlers';
import {makeAsset, makeClip, makeParams, makeProject, makeTrack} from './test-fixtures';
import {CloseGapCommand, FillGapCommand} from '@open-factory/editor-core';

function gapMenuFixture() {
  return {trackId: 'track-video-1', time: 5, x: 100, y: 100};
}

describe('createGapHandlers', () => {
  beforeEach(() => {
    executeMock.mockReset();
    generateGapFillMediaMock.mockReset();
    showToastMock.mockReset();
  });

  describe('openGapMenu', () => {
    it('打开间隙菜单并关闭其它互斥菜单', () => {
      const params = makeParams();
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      handlers.openGapMenu({trackId: 'track-video-1', time: 3, x: 50, y: 50});
      const request = params.setters.setGapMenu.mock.calls[0][0];
      expect(request.trackId).toBe('track-video-1');
      expect(request.time).toBe(3);
      // 互斥菜单全部关闭
      expect(params.setters.setTransitionMenu).toHaveBeenCalledWith(undefined);
      expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
      expect(params.setters.setVolumeEnvelopeMenu).toHaveBeenCalledWith(undefined);
      expect(params.setters.setRulerMenu).toHaveBeenCalledWith(undefined);
    });

    it('菜单坐标被限制在视口内（jsdom 默认 1024x768）', () => {
      const params = makeParams();
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      handlers.openGapMenu({trackId: 't', time: 0, x: 5000, y: 5000});
      const request = params.setters.setGapMenu.mock.calls[0][0];
      expect(request.x).toBeLessThanOrEqual(window.innerWidth - 220);
      expect(request.y).toBeLessThanOrEqual(window.innerHeight - 260);
    });
  });

  describe('closeGap', () => {
    it('gapMenu 缺失时直接返回不执行命令', () => {
      const params = makeParams();
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      handlers.closeGap();
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('执行 CloseGapCommand 并携带 trackId/time/clipGroups，成功后关闭菜单', () => {
      const group = {id: 'group-1', name: 'G', color: 'blue', clipIds: ['clip-a', 'clip-b']} as never;
      const params = makeParams({gapMenu: gapMenuFixture(), clipGroups: [group]});
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      handlers.closeGap();
      expect(executeMock).toHaveBeenCalledTimes(1);
      const command = executeMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(CloseGapCommand);
      expect(params.setters.setGapMenu).toHaveBeenCalledWith(undefined);
    });

    it('命令抛错（如锁定轨道被守卫拒绝）时 toast 警告且不关闭菜单', () => {
      executeMock.mockImplementation(() => {
        throw new Error('locked track');
      });
      const params = makeParams({gapMenu: gapMenuFixture()});
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      handlers.closeGap();
      expect(showToastMock).toHaveBeenCalledTimes(1);
      expect(showToastMock.mock.calls[0][0].kind).toBe('warning');
      expect(showToastMock.mock.calls[0][0].message).toBe('locked track');
      expect(params.setters.setGapMenu).not.toHaveBeenCalled();
    });
  });

  describe('fillGap', () => {
    it('repeat 策略直接执行 FillGapCommand 并关闭菜单', async () => {
      const params = makeParams({gapMenu: gapMenuFixture()});
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      await handlers.fillGap('repeat');
      expect(executeMock).toHaveBeenCalledTimes(1);
      const command = executeMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(FillGapCommand);
      expect(params.setters.setGapMenu).toHaveBeenCalledWith(undefined);
    });

    it('crossfade 策略同样走命令路径', async () => {
      const params = makeParams({gapMenu: gapMenuFixture()});
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      await handlers.fillGap('crossfade');
      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(FillGapCommand);
    });

    it('black 策略生成纯色媒体后经 addMedia 入库并执行 FillGapCommand', async () => {
      generateGapFillMediaMock.mockResolvedValue({path: 'D:/cache/black.png', name: '', width: 1920, height: 1080});
      // clip-a(0-5) 与 clip-b(8-12) 之间留 5-8 的真实间隙
      const clipA = makeClip({id: 'clip-a', start: 0, duration: 5});
      const clipB = makeClip({id: 'clip-b', start: 8, duration: 4});
      const project = makeProject({tracks: [makeTrack({clips: [clipA, clipB]})]});
      const params = makeParams({gapMenu: gapMenuFixture(), project});
      const handlers = createGapHandlers(params, {
        findClip: (id) => (id === 'clip-a' ? clipA : id === 'clip-b' ? clipB : makeClip({id})),
        getClipMediaAsset: () => undefined,
      });
      await handlers.fillGap('black');
      expect(generateGapFillMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({kind: 'solid-color', color: '#000000', width: 1920, height: 1080}),
      );
      expect(params.setters.addMedia).toHaveBeenCalledTimes(1);
      const added = params.setters.addMedia.mock.calls[0][0][0];
      expect(added.type).toBe('image');
      expect(added.name).toContain('.png');
      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(params.setters.setGapMenu).toHaveBeenCalledWith(undefined);
    });

    it('freeze-frame 策略取前一 clip 媒体生成静帧', async () => {
      generateGapFillMediaMock.mockImplementation(({kind}: {kind: string}) =>
        kind === 'freeze-frame'
          ? Promise.resolve({path: 'D:/cache/frame.png', name: 'frame.png', width: 1920, height: 1080})
          : Promise.resolve({path: 'D:/cache/black.png', name: 'black.png', width: 1920, height: 1080}),
      );
      const clipA = makeClip({id: 'clip-a', start: 0, duration: 5, mediaId: 'media-a', trimStart: 1});
      const clipB = makeClip({id: 'clip-b', start: 8, duration: 4});
      const project = makeProject({
        tracks: [makeTrack({clips: [clipA, clipB]})],
        media: [makeAsset({id: 'media-a'})],
      });
      const params = makeParams({gapMenu: gapMenuFixture(), project});
      const handlers = createGapHandlers(params, {
        findClip: (id: string) => (id === 'clip-a' ? clipA : id === 'clip-b' ? clipB : makeClip({id})),
        getClipMediaAsset: () => makeAsset({id: 'media-a'}),
      });
      await handlers.fillGap('freeze-frame');
      // 冻帧路径优先：freeze-frame 调用（sourcePath 为前一 clip 的媒体）
      expect(generateGapFillMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({kind: 'freeze-frame', sourcePath: 'D:/media/media-a.mp4'}),
      );
      expect(params.setters.addMedia).toHaveBeenCalledTimes(1);
    });

    it('freeze-frame 前一 clip 为音频时回退 black 路径', async () => {
      generateGapFillMediaMock.mockResolvedValue({path: 'D:/cache/black.png', name: 'black.png', width: 4, height: 4});
      const clipA = makeClip({id: 'clip-a', start: 0, duration: 5, mediaId: 'media-audio'});
      const clipB = makeClip({id: 'clip-b', start: 8, duration: 4});
      const project = makeProject({
        tracks: [makeTrack({clips: [clipA, clipB]})],
        media: [makeAsset({id: 'media-audio', type: 'audio'})],
      });
      const params = makeParams({gapMenu: gapMenuFixture(), project});
      const handlers = createGapHandlers(params, {
        findClip: (id: string) => (id === 'clip-a' ? clipA : id === 'clip-b' ? clipB : makeClip({id})),
        getClipMediaAsset: () => makeAsset({id: 'media-audio', type: 'audio'}),
      });
      await handlers.fillGap('freeze-frame');
      // 音频资产不可冻帧 → 回退 solid-color
      expect(generateGapFillMediaMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'solid-color'}));
    });

    it('找不到可填充间隙时 toast 警告', async () => {
      generateGapFillMediaMock.mockResolvedValue({path: 'p', name: 'n', width: 1, height: 1});
      executeMock.mockImplementation(() => {
        throw new Error('no gap');
      });
      const params = makeParams({gapMenu: gapMenuFixture()});
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      await handlers.fillGap('white');
      expect(showToastMock).toHaveBeenCalledTimes(1);
      expect(showToastMock.mock.calls[0][0].kind).toBe('warning');
    });

    it('white 策略使用 #ffffff 颜色参数', async () => {
      generateGapFillMediaMock.mockResolvedValue({path: 'p', name: 'white.png', width: 8, height: 8});
      const params = makeParams({gapMenu: gapMenuFixture()});
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      await handlers.fillGap('white');
      expect(generateGapFillMediaMock).toHaveBeenCalledWith(expect.objectContaining({color: '#ffffff'}));
    });
  });

  describe('buildGapFillAsset', () => {
    it('result.name 为空时使用 fallbackName', () => {
      const params = makeParams();
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      const asset = handlers.buildGapFillAsset({path: 'p', name: '', width: 0, height: 0}, 'black');
      expect(asset.name).toBe('black.png');
      expect(asset.type).toBe('image');
      expect(asset.width).toBe(1920); // 回退 project.settings.width
      expect(asset.height).toBe(1080);
    });

    it('result.name 非空时优先使用', () => {
      const params = makeParams();
      const handlers = createGapHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
      });
      const asset = handlers.buildGapFillAsset({path: 'p', name: 'custom.png', width: 640, height: 480}, 'black');
      expect(asset.name).toBe('custom.png');
      expect(asset.width).toBe(640);
    });
  });
});
