import { describe, it, expect, beforeEach } from 'vitest';
import { OpenFactoryClient, ProjectAPI, TimelineAPI, EffectsAPI, ExportAPI, PluginsAPI, EventEmitter, ok, err, } from '../src/index.js';
// ============================================================
// EventEmitter & Result helpers
// ============================================================
describe('EventEmitter', () => {
    it('订阅并在 emit 时触发监听器', () => {
        const emitter = new EventEmitter();
        const received = [];
        emitter.on('timeline:changed', (e) => received.push(e.payload));
        emitter.emit('timeline:changed', { action: 'test' });
        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({ action: 'test' });
    });
    it('on 返回的取消函数可移除监听器', () => {
        const emitter = new EventEmitter();
        const received = [];
        const off = emitter.on('project:loaded', (e) => received.push(e.payload));
        emitter.emit('project:loaded', { id: 1 });
        off();
        emitter.emit('project:loaded', { id: 2 });
        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({ id: 1 });
    });
    it('off 可显式移除监听器', () => {
        const emitter = new EventEmitter();
        const fn = () => received.push(1);
        const received = [];
        emitter.on('project:saved', fn);
        emitter.off('project:saved', fn);
        emitter.emit('project:saved', {});
        expect(received).toHaveLength(0);
    });
    it('emit 向多个监听器广播', () => {
        const emitter = new EventEmitter();
        let count = 0;
        emitter.on('effect:applied', () => count++);
        emitter.on('effect:applied', () => count++);
        emitter.emit('effect:applied', {});
        expect(count).toBe(2);
    });
    it('对无监听器的事件 emit 不报错', () => {
        const emitter = new EventEmitter();
        expect(() => emitter.emit('export:error', {})).not.toThrow();
    });
    it('removeAllListeners 清除全部监听器', () => {
        const emitter = new EventEmitter();
        let count = 0;
        emitter.on('project:loaded', () => count++);
        emitter.on('project:loaded', () => count++);
        emitter.removeAllListeners();
        emitter.emit('project:loaded', {});
        expect(count).toBe(0);
    });
    it('emit 的事件对象包含 timestamp', () => {
        const emitter = new EventEmitter();
        let captured = {};
        emitter.on('timeline:changed', (e) => (captured = e));
        emitter.emit('timeline:changed', {});
        expect(captured.timestamp).toBeTypeOf('number');
        expect(captured.timestamp).toBeGreaterThan(0);
    });
});
describe('Result 辅助函数', () => {
    it('ok 创建成功结果', () => {
        const result = ok(42);
        expect(result.ok).toBe(true);
        if (result.ok)
            expect(result.value).toBe(42);
    });
    it('err 创建失败结果', () => {
        const result = err(new Error('失败'));
        expect(result.ok).toBe(false);
        if (!result.ok)
            expect(result.error.message).toBe('失败');
    });
});
// ============================================================
// ProjectAPI
// ============================================================
describe('ProjectAPI', () => {
    let api;
    const validConfig = {
        name: '测试项目',
        width: 1920,
        height: 1080,
        fps: 30,
    };
    beforeEach(() => {
        api = new ProjectAPI();
    });
    it('创建有效项目返回成功并发送 project:loaded 事件', () => {
        const events = [];
        api.on('project:loaded', (e) => events.push(e.payload));
        const result = api.create(validConfig);
        expect(result.ok).toBe(true);
        expect(events).toHaveLength(1);
    });
    it('空名称创建失败', () => {
        const result = api.create({ ...validConfig, name: '  ' });
        expect(result.ok).toBe(false);
    });
    it('零分辨率创建失败', () => {
        const result = api.create({ ...validConfig, width: 0 });
        expect(result.ok).toBe(false);
    });
    it('负数 fps 创建失败', () => {
        const result = api.create({ ...validConfig, fps: -1 });
        expect(result.ok).toBe(false);
    });
    it('getConfig 返回配置副本', () => {
        api.create(validConfig);
        const config = api.getConfig();
        expect(config).toEqual(validConfig);
        expect(config).not.toBe(validConfig);
    });
    it('未创建项目时 getConfig 返回 null', () => {
        expect(api.getConfig()).toBeNull();
    });
    it('update 修改配置并标记 dirty', () => {
        api.create(validConfig);
        const result = api.update({ fps: 60 });
        expect(result.ok).toBe(true);
        expect(api.getConfig()?.fps).toBe(60);
        expect(api.isDirty()).toBe(true);
    });
    it('未创建项目时 update 失败', () => {
        const result = api.update({ name: 'x' });
        expect(result.ok).toBe(false);
    });
    it('save 清除 dirty 标记并发送 project:saved 事件', () => {
        const events = [];
        api.on('project:saved', (e) => events.push(e.payload));
        api.create(validConfig);
        api.update({ fps: 60 });
        const result = api.save();
        expect(result.ok).toBe(true);
        expect(api.isDirty()).toBe(false);
        expect(events).toHaveLength(1);
    });
    it('未创建项目时 save 失败', () => {
        expect(api.save().ok).toBe(false);
    });
});
// ============================================================
// TimelineAPI
// ============================================================
describe('TimelineAPI', () => {
    let api;
    beforeEach(() => {
        api = new TimelineAPI();
    });
    it('addTrack 创建轨道并发送事件', () => {
        const events = [];
        api.on('timeline:changed', (e) => events.push(e.payload));
        const result = api.addTrack('主轨', 'video');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.name).toBe('主轨');
            expect(result.value.type).toBe('video');
            expect(result.value.clips).toEqual([]);
        }
        expect(events).toHaveLength(1);
    });
    it('getTracks 返回所有轨道', () => {
        api.addTrack('A', 'video');
        api.addTrack('B', 'audio');
        expect(api.getTracks()).toHaveLength(2);
    });
    it('getTracks 返回深拷贝', () => {
        api.addTrack('A', 'video');
        const tracks1 = api.getTracks();
        const tracks2 = api.getTracks();
        expect(tracks1).not.toBe(tracks2);
        expect(tracks1[0].clips).not.toBe(tracks2[0].clips);
    });
    it('removeTrack 移除存在的轨道', () => {
        const result = api.addTrack('A', 'video');
        if (!result.ok)
            throw new Error('前置失败');
        const trackId = result.value.id;
        expect(api.removeTrack(trackId).ok).toBe(true);
        expect(api.getTracks()).toHaveLength(0);
    });
    it('removeTrack 对不存在的轨道失败', () => {
        expect(api.removeTrack('不存在').ok).toBe(false);
    });
    it('addClip 向轨道添加片段', () => {
        const trackResult = api.addTrack('A', 'video');
        if (!trackResult.ok)
            throw new Error('前置失败');
        const trackId = trackResult.value.id;
        const result = api.addClip(trackId, 'src-1', 0, 10);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.sourceId).toBe('src-1');
            expect(result.value.startTime).toBe(0);
            expect(result.value.endTime).toBe(10);
        }
        expect(api.getTracks()[0].clips).toHaveLength(1);
    });
    it('addClip 对不存在的轨道失败', () => {
        const result = api.addClip('无', 'src-1', 0, 10);
        expect(result.ok).toBe(false);
    });
    it('addClip 结束时间早于开始时间失败', () => {
        const trackResult = api.addTrack('A', 'video');
        if (!trackResult.ok)
            throw new Error('前置失败');
        expect(api.addClip(trackResult.value.id, 'src', 10, 5).ok).toBe(false);
    });
    it('moveClip 移动片段并保持时长', () => {
        const trackResult = api.addTrack('A', 'video');
        if (!trackResult.ok)
            throw new Error('前置失败');
        const trackId = trackResult.value.id;
        const clipResult = api.addClip(trackId, 'src', 0, 10);
        if (!clipResult.ok)
            throw new Error('前置失败');
        const clipId = clipResult.value.id;
        const result = api.moveClip(trackId, clipId, 100);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.startTime).toBe(100);
            expect(result.value.endTime).toBe(110);
        }
    });
    it('removeClip 移除片段', () => {
        const trackResult = api.addTrack('A', 'video');
        if (!trackResult.ok)
            throw new Error('前置失败');
        const trackId = trackResult.value.id;
        const clipResult = api.addClip(trackId, 'src', 0, 10);
        if (!clipResult.ok)
            throw new Error('前置失败');
        expect(api.removeClip(trackId, clipResult.value.id).ok).toBe(true);
        expect(api.getTracks()[0].clips).toHaveLength(0);
    });
    it('removeClip 对不存在的片段失败', () => {
        const trackResult = api.addTrack('A', 'video');
        if (!trackResult.ok)
            throw new Error('前置失败');
        expect(api.removeClip(trackResult.value.id, '无').ok).toBe(false);
    });
    it('clear 清空所有轨道并发送事件', () => {
        const events = [];
        api.on('timeline:changed', (e) => events.push(e.payload));
        api.addTrack('A', 'video');
        api.addTrack('B', 'audio');
        api.clear();
        expect(api.getTracks()).toHaveLength(0);
        const lastEvent = events[events.length - 1];
        expect(lastEvent).toEqual({ action: 'clear' });
    });
});
// ============================================================
// EffectsAPI
// ============================================================
describe('EffectsAPI', () => {
    let api;
    beforeEach(() => {
        api = new EffectsAPI();
    });
    it('apply 创建效果并发送 effect:applied 事件', () => {
        const events = [];
        api.on('effect:applied', (e) => events.push(e.payload));
        const result = api.apply('模糊', 'blur', { radius: 5 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.name).toBe('模糊');
            expect(result.value.type).toBe('blur');
            expect(result.value.params).toEqual({ radius: 5 });
            expect(result.value.id).toBeTruthy();
        }
        expect(events).toHaveLength(1);
    });
    it('apply 空名称失败', () => {
        expect(api.apply('  ', 'blur', {}).ok).toBe(false);
    });
    it('apply 带 timeRange 时附加 startTime/endTime', () => {
        const result = api.apply('淡入', 'fade', {}, { startTime: 1, endTime: 5 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.startTime).toBe(1);
            expect(result.value.endTime).toBe(5);
        }
    });
    it('remove 移除效果', () => {
        const created = api.apply('模糊', 'blur', {});
        if (!created.ok)
            throw new Error('前置失败');
        expect(api.remove(created.value.id).ok).toBe(true);
        expect(api.getAll()).toHaveLength(0);
    });
    it('remove 对不存在的效果失败', () => {
        expect(api.remove('无').ok).toBe(false);
    });
    it('updateParams 合并参数', () => {
        const created = api.apply('模糊', 'blur', { radius: 5 });
        if (!created.ok)
            throw new Error('前置失败');
        const result = api.updateParams(created.value.id, { strength: 0.8 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.params).toEqual({ radius: 5, strength: 0.8 });
        }
    });
    it('updateParams 对不存在的效果失败', () => {
        expect(api.updateParams('无', {}).ok).toBe(false);
    });
    it('getByType 按类型过滤', () => {
        api.apply('A', 'blur', {});
        api.apply('B', 'sharpen', {});
        api.apply('C', 'blur', {});
        expect(api.getByType('blur')).toHaveLength(2);
        expect(api.getByType('sharpen')).toHaveLength(1);
    });
    it('getAll 返回深拷贝', () => {
        api.apply('A', 'blur', { radius: 5 });
        const a1 = api.getAll();
        const a2 = api.getAll();
        expect(a1).not.toBe(a2);
        expect(a1[0].params).not.toBe(a2[0].params);
    });
    it('clear 清空所有效果', () => {
        api.apply('A', 'blur', {});
        api.apply('B', 'sharpen', {});
        api.clear();
        expect(api.getAll()).toHaveLength(0);
    });
});
// ============================================================
// ExportAPI
// ============================================================
describe('ExportAPI', () => {
    let api;
    const validConfig = {
        format: 'mp4',
        quality: 'high',
        outputPath: '/tmp/out.mp4',
    };
    beforeEach(() => {
        api = new ExportAPI();
    });
    it('start 发送 export:started 事件并标记进行中', () => {
        const events = [];
        api.on('export:started', (e) => events.push(e.payload));
        const result = api.start(validConfig);
        expect(result.ok).toBe(true);
        expect(api.isExporting()).toBe(true);
        expect(events).toHaveLength(1);
    });
    it('start 无 outputPath 失败', () => {
        expect(api.start({ ...validConfig, outputPath: '' }).ok).toBe(false);
    });
    it('start 重复导出失败', () => {
        api.start(validConfig);
        expect(api.start(validConfig).ok).toBe(false);
    });
    it('updateProgress 发送进度事件', () => {
        const events = [];
        api.on('export:progress', (e) => events.push(e.payload));
        api.start(validConfig);
        api.updateProgress({ percent: 50, currentFrame: 500, totalFrames: 1000, eta: 10 });
        expect(api.getProgress()?.percent).toBe(50);
        expect(events).toHaveLength(1);
    });
    it('complete 清除进行状态并发送 completed', () => {
        const events = [];
        api.on('export:completed', (e) => events.push(e.payload));
        api.start(validConfig);
        api.complete();
        expect(api.isExporting()).toBe(false);
        expect(api.getProgress()).toBeNull();
        expect(events).toHaveLength(1);
    });
    it('fail 清除进行状态并发送 error', () => {
        const events = [];
        api.on('export:error', (e) => events.push(e.payload));
        api.start(validConfig);
        const err = new Error('导出失败');
        api.fail(err);
        expect(api.isExporting()).toBe(false);
        expect(events).toHaveLength(1);
    });
    it('未开始导出时 getProgress 返回 null', () => {
        expect(api.getProgress()).toBeNull();
    });
});
// ============================================================
// PluginsAPI
// ============================================================
describe('PluginsAPI', () => {
    let api;
    const validPlugin = {
        id: 'plugin-1',
        name: '测试插件',
        version: '1.0.0',
        description: '一个测试插件',
        author: 'tester',
        enabled: false,
    };
    beforeEach(() => {
        api = new PluginsAPI();
    });
    it('register 注册插件', () => {
        const result = api.register(validPlugin);
        expect(result.ok).toBe(true);
        expect(api.getAll()).toHaveLength(1);
    });
    it('register 重复 id 失败', () => {
        api.register(validPlugin);
        expect(api.register(validPlugin).ok).toBe(false);
    });
    it('unregister 注销插件', () => {
        api.register(validPlugin);
        expect(api.unregister(validPlugin.id).ok).toBe(true);
        expect(api.getAll()).toHaveLength(0);
    });
    it('unregister 不存在的 id 失败', () => {
        expect(api.unregister('无').ok).toBe(false);
    });
    it('enable 启用插件', () => {
        api.register(validPlugin);
        const result = api.enable(validPlugin.id);
        expect(result.ok).toBe(true);
        if (result.ok)
            expect(result.value.enabled).toBe(true);
        expect(api.getEnabled()).toHaveLength(1);
    });
    it('disable 禁用插件', () => {
        api.register({ ...validPlugin, enabled: true });
        const result = api.disable(validPlugin.id);
        expect(result.ok).toBe(true);
        if (result.ok)
            expect(result.value.enabled).toBe(false);
        expect(api.getEnabled()).toHaveLength(0);
    });
    it('getById 返回插件副本', () => {
        api.register(validPlugin);
        const plugin = api.getById(validPlugin.id);
        expect(plugin).toEqual(validPlugin);
        expect(plugin).not.toBe(validPlugin);
    });
    it('getById 不存在返回 null', () => {
        expect(api.getById('无')).toBeNull();
    });
    it('getEnabled 仅返回已启用插件', () => {
        api.register({ ...validPlugin, id: 'a', enabled: true });
        api.register({ ...validPlugin, id: 'b', enabled: false });
        api.register({ ...validPlugin, id: 'c', enabled: true });
        expect(api.getEnabled()).toHaveLength(2);
    });
});
// ============================================================
// OpenFactoryClient（集成）
// ============================================================
describe('OpenFactoryClient', () => {
    it('暴露所有子 API', () => {
        const client = new OpenFactoryClient();
        expect(client.project).toBeInstanceOf(ProjectAPI);
        expect(client.timeline).toBeInstanceOf(TimelineAPI);
        expect(client.effects).toBeInstanceOf(EffectsAPI);
        expect(client.export).toBeInstanceOf(ExportAPI);
        expect(client.plugins).toBeInstanceOf(PluginsAPI);
        client.dispose();
    });
    it('quickSetup 创建项目并添加默认轨道', () => {
        const client = new OpenFactoryClient();
        const result = client.quickSetup('我的视频');
        expect(result.ok).toBe(true);
        expect(client.project.getConfig()?.name).toBe('我的视频');
        expect(client.timeline.getTracks()).toHaveLength(2);
        client.dispose();
    });
    it('quickSetup 支持自定义分辨率和帧率', () => {
        const client = new OpenFactoryClient();
        client.quickSetup('高清', { width: 3840, height: 2160, fps: 60 });
        const config = client.project.getConfig();
        expect(config?.width).toBe(3840);
        expect(config?.height).toBe(2160);
        expect(config?.fps).toBe(60);
        client.dispose();
    });
    it('子 API 事件向上转发到 client', () => {
        const client = new OpenFactoryClient();
        const received = [];
        client.on('project:loaded', (e) => received.push(e.payload));
        client.on('timeline:changed', (e) => received.push(e.payload));
        client.project.create({ name: 'X', width: 100, height: 100, fps: 30 });
        client.timeline.addTrack('T', 'video');
        expect(received).toHaveLength(2);
        client.dispose();
    });
    it('dispose 清理所有监听器', () => {
        const client = new OpenFactoryClient();
        let count = 0;
        client.on('project:loaded', () => count++);
        client.dispose();
        client.project.create({ name: 'X', width: 100, height: 100, fps: 30 });
        expect(count).toBe(0);
    });
});
//# sourceMappingURL=sdk.test.js.map