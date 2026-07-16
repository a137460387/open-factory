import { describe, it, expect, beforeEach } from 'vitest';
import { useMixerStore } from './mixerStore';

describe('mixerStore', () => {
  beforeEach(() => {
    useMixerStore.getState().reset();
  });

  describe('初始状态', () => {
    it('mixerState 有默认值', () => {
      const state = useMixerStore.getState();
      expect(state.mixerState.channels).toEqual([]);
      expect(state.mixerState.buses).toEqual([]);
      expect(state.mixerState.masterBus.name).toBe('Master');
      expect(state.mixerState.masterBus.type).toBe('master');
    });

    it('selectedChannelId 初始为 null', () => {
      expect(useMixerStore.getState().selectedChannelId).toBeNull();
    });

    it('expandedChannelIds 初始为空集合', () => {
      expect(useMixerStore.getState().expandedChannelIds.size).toBe(0);
    });

    it('activeTab 初始为 mix', () => {
      expect(useMixerStore.getState().activeTab).toBe('mix');
    });

    it('noiseReductionParams 初始为空对象', () => {
      expect(useMixerStore.getState().noiseReductionParams).toEqual({});
    });

    it('spectrumAnalyzerActive 初始为 false', () => {
      expect(useMixerStore.getState().spectrumAnalyzerActive).toBe(false);
    });

    it('automationRecordMode 初始为 read', () => {
      expect(useMixerStore.getState().automationRecordMode).toBe('read');
    });
  });

  describe('initChannels', () => {
    it('从轨道列表初始化通道', () => {
      const tracks = [
        { id: 't1', name: 'Track 1', type: 'audio' },
        { id: 't2', name: 'Track 2', type: 'video' },
        { id: 't3', name: 'Subtitle', type: 'subtitle' },
      ];
      useMixerStore.getState().initChannels(tracks);
      const channels = useMixerStore.getState().mixerState.channels;
      expect(channels.length).toBe(2); // 只有 audio 和 video
      expect(channels[0].trackId).toBe('t1');
      expect(channels[0].name).toBe('Track 1');
      expect(channels[1].trackId).toBe('t2');
    });

    it('空轨道列表清空通道', () => {
      useMixerStore.getState().initChannels([{ id: 't1', name: 'T', type: 'audio' }]);
      useMixerStore.getState().initChannels([]);
      expect(useMixerStore.getState().mixerState.channels.length).toBe(0);
    });
  });

  describe('通道音量控制', () => {
    beforeEach(() => {
      useMixerStore.getState().initChannels([
        { id: 't1', name: 'Track 1', type: 'audio' },
      ]);
    });

    it('setChannelVolume 设置通道音量', () => {
      useMixerStore.getState().setChannelVolume('t1', -6);
      expect(useMixerStore.getState().mixerState.channels[0].volume).toBe(-6);
    });

    it('setChannelVolume 钳制到有效范围', () => {
      useMixerStore.getState().setChannelVolume('t1', -100);
      expect(useMixerStore.getState().mixerState.channels[0].volume).toBe(-60);

      useMixerStore.getState().setChannelVolume('t1', 20);
      expect(useMixerStore.getState().mixerState.channels[0].volume).toBe(12);
    });

    it('setChannelVolume 不影响其他通道', () => {
      useMixerStore.getState().initChannels([
        { id: 't1', name: 'T1', type: 'audio' },
        { id: 't2', name: 'T2', type: 'audio' },
      ]);
      useMixerStore.getState().setChannelVolume('t1', -12);
      expect(useMixerStore.getState().mixerState.channels[1].volume).toBe(0);
    });
  });

  describe('通道声像控制', () => {
    beforeEach(() => {
      useMixerStore.getState().initChannels([
        { id: 't1', name: 'Track 1', type: 'audio' },
      ]);
    });

    it('setChannelPan 设置声像', () => {
      useMixerStore.getState().setChannelPan('t1', -50);
      expect(useMixerStore.getState().mixerState.channels[0].pan).toBe(-50);
    });

    it('setChannelPan 钳制到 -100 ~ 100', () => {
      useMixerStore.getState().setChannelPan('t1', -200);
      expect(useMixerStore.getState().mixerState.channels[0].pan).toBe(-100);

      useMixerStore.getState().setChannelPan('t1', 200);
      expect(useMixerStore.getState().mixerState.channels[0].pan).toBe(100);
    });
  });

  describe('静音/独奏', () => {
    beforeEach(() => {
      useMixerStore.getState().initChannels([
        { id: 't1', name: 'Track 1', type: 'audio' },
      ]);
    });

    it('toggleChannelMute 切换静音状态', () => {
      expect(useMixerStore.getState().mixerState.channels[0].muted).toBe(false);
      useMixerStore.getState().toggleChannelMute('t1');
      expect(useMixerStore.getState().mixerState.channels[0].muted).toBe(true);
      useMixerStore.getState().toggleChannelMute('t1');
      expect(useMixerStore.getState().mixerState.channels[0].muted).toBe(false);
    });

    it('toggleChannelSolo 切换独奏状态', () => {
      expect(useMixerStore.getState().mixerState.channels[0].solo).toBe(false);
      useMixerStore.getState().toggleChannelSolo('t1');
      expect(useMixerStore.getState().mixerState.channels[0].solo).toBe(true);
      useMixerStore.getState().toggleChannelSolo('t1');
      expect(useMixerStore.getState().mixerState.channels[0].solo).toBe(false);
    });
  });

  describe('效果链管理', () => {
    beforeEach(() => {
      useMixerStore.getState().initChannels([
        { id: 't1', name: 'Track 1', type: 'audio' },
      ]);
    });

    it('addEffectToChannel 添加效果', () => {
      useMixerStore.getState().addEffectToChannel('t1', 'compressor');
      const effects = useMixerStore.getState().mixerState.channels[0].effectsChain;
      expect(effects.length).toBe(1);
      expect(effects[0].effectType).toBe('compressor');
    });

    it('removeEffectFromChannel 移除效果', () => {
      useMixerStore.getState().addEffectToChannel('t1', 'compressor');
      const effectId = useMixerStore.getState().mixerState.channels[0].effectsChain[0].id;
      useMixerStore.getState().removeEffectFromChannel('t1', effectId);
      expect(useMixerStore.getState().mixerState.channels[0].effectsChain.length).toBe(0);
    });

    it('updateChannelEffects 更新效果链', () => {
      useMixerStore.getState().addEffectToChannel('t1', 'compressor');
      const effects = useMixerStore.getState().mixerState.channels[0].effectsChain;
      useMixerStore.getState().updateChannelEffects('t1', [
        { ...effects[0], enabled: false },
      ]);
      expect(useMixerStore.getState().mixerState.channels[0].effectsChain[0].enabled).toBe(false);
    });
  });

  describe('Master 控制', () => {
    it('setMasterVolume 设置主音量', () => {
      useMixerStore.getState().setMasterVolume(-6);
      expect(useMixerStore.getState().mixerState.masterBus.volume).toBe(-6);
    });

    it('setMasterPan 设置主声像', () => {
      useMixerStore.getState().setMasterPan(30);
      expect(useMixerStore.getState().mixerState.masterBus.pan).toBe(30);
    });

    it('toggleMasterMute 切换主静音', () => {
      expect(useMixerStore.getState().mixerState.masterBus.muted).toBe(false);
      useMixerStore.getState().toggleMasterMute();
      expect(useMixerStore.getState().mixerState.masterBus.muted).toBe(true);
    });
  });

  describe('总线管理', () => {
    it('addBus 添加总线', () => {
      useMixerStore.getState().addBus('Sub 1', 'submix');
      expect(useMixerStore.getState().mixerState.buses.length).toBe(1);
      expect(useMixerStore.getState().mixerState.buses[0].name).toBe('Sub 1');
      expect(useMixerStore.getState().mixerState.buses[0].type).toBe('submix');
    });

    it('removeBus 删除总线', () => {
      useMixerStore.getState().addBus('Sub 1', 'submix');
      const busId = useMixerStore.getState().mixerState.buses[0].id;
      useMixerStore.getState().removeBus(busId);
      expect(useMixerStore.getState().mixerState.buses.length).toBe(0);
    });

    it('removeBus 清除通道的总线分配', () => {
      useMixerStore.getState().initChannels([{ id: 't1', name: 'T', type: 'audio' }]);
      useMixerStore.getState().addBus('Sub 1', 'submix');
      const busId = useMixerStore.getState().mixerState.buses[0].id;

      // 手动添加总线分配
      useMixerStore.setState((state) => ({
        mixerState: {
          ...state.mixerState,
          channels: state.mixerState.channels.map((ch) =>
            ch.trackId === 't1'
              ? { ...ch, busAssignments: [{ busId, level: 0.8, enabled: true }] }
              : ch,
          ),
        },
      }));

      useMixerStore.getState().removeBus(busId);
      expect(useMixerStore.getState().mixerState.channels[0].busAssignments.length).toBe(0);
    });

    it('updateBus 更新总线参数', () => {
      useMixerStore.getState().addBus('Sub 1', 'submix');
      const busId = useMixerStore.getState().mixerState.buses[0].id;
      useMixerStore.getState().updateBus(busId, { volume: -6, muted: true });
      expect(useMixerStore.getState().mixerState.buses[0].volume).toBe(-6);
      expect(useMixerStore.getState().mixerState.buses[0].muted).toBe(true);
    });
  });

  describe('UI 状态', () => {
    it('selectChannel 设置选中通道', () => {
      useMixerStore.getState().selectChannel('t1');
      expect(useMixerStore.getState().selectedChannelId).toBe('t1');
    });

    it('selectChannel null 取消选中', () => {
      useMixerStore.getState().selectChannel('t1');
      useMixerStore.getState().selectChannel(null);
      expect(useMixerStore.getState().selectedChannelId).toBeNull();
    });

    it('toggleChannelExpanded 切换展开状态', () => {
      useMixerStore.getState().toggleChannelExpanded('t1');
      expect(useMixerStore.getState().expandedChannelIds.has('t1')).toBe(true);
      useMixerStore.getState().toggleChannelExpanded('t1');
      expect(useMixerStore.getState().expandedChannelIds.has('t1')).toBe(false);
    });

    it('setActiveTab 设置活跃标签', () => {
      useMixerStore.getState().setActiveTab('effects');
      expect(useMixerStore.getState().activeTab).toBe('effects');
    });

    it('toggleSpectrumAnalyzer 切换频谱分析器', () => {
      expect(useMixerStore.getState().spectrumAnalyzerActive).toBe(false);
      useMixerStore.getState().toggleSpectrumAnalyzer();
      expect(useMixerStore.getState().spectrumAnalyzerActive).toBe(true);
      useMixerStore.getState().toggleSpectrumAnalyzer();
      expect(useMixerStore.getState().spectrumAnalyzerActive).toBe(false);
    });

    it('setAutomationRecordMode 设置自动化录制模式', () => {
      useMixerStore.getState().setAutomationRecordMode('write');
      expect(useMixerStore.getState().automationRecordMode).toBe('write');
    });
  });

  describe('降噪参数', () => {
    it('setNoiseReductionParams 设置降噪参数', () => {
      useMixerStore.getState().setNoiseReductionParams('t1', {
        noiseFloor: -30,
        nrType: 1,
        autoNoiseSampling: false,
        noiseSampleStart: 0,
        noiseSampleEnd: 0,
      });
      const params = useMixerStore.getState().noiseReductionParams['t1'];
      expect(params.noiseFloor).toBe(-30);
      expect(params.nrType).toBe(1);
    });

    it('setNoiseReductionPreviewTrackId 设置预览通道', () => {
      useMixerStore.getState().setNoiseReductionPreviewTrackId('t1');
      expect(useMixerStore.getState().noiseReductionPreviewTrackId).toBe('t1');
    });

    it('setNoiseReductionPreviewTrackId null 清除预览', () => {
      useMixerStore.getState().setNoiseReductionPreviewTrackId('t1');
      useMixerStore.getState().setNoiseReductionPreviewTrackId(null);
      expect(useMixerStore.getState().noiseReductionPreviewTrackId).toBeNull();
    });
  });

  describe('reset', () => {
    it('重置所有状态到初始值', () => {
      useMixerStore.getState().initChannels([{ id: 't1', name: 'T', type: 'audio' }]);
      useMixerStore.getState().setChannelVolume('t1', -12);
      useMixerStore.getState().selectChannel('t1');
      useMixerStore.getState().setActiveTab('effects');

      useMixerStore.getState().reset();

      const state = useMixerStore.getState();
      expect(state.mixerState.channels.length).toBe(0);
      expect(state.selectedChannelId).toBeNull();
      expect(state.activeTab).toBe('mix');
    });
  });
});
