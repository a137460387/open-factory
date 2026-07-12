import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Audio Mixer 页面对象 - 封装混音器的所有交互
 *
 * data-testid 属性来源：
 * - AudioMixer.tsx:   audio-mixer, mixer-channel-{id}, mixer-volume-{id}, mixer-pan-{id},
 *                     mixer-mute-{id}, mixer-solo-{id}, mixer-expand-{id},
 *                     mixer-channel-routing-{id}, mixer-eq-enabled-{id},
 *                     mixer-compressor-enabled-{id}, mixer-eq-gain-{id}-{bandId},
 *                     mixer-eq-frequency-{id}-{bandId}, mixer-eq-q-{id}-{bandId},
 *                     mixer-eq-graph-{id}, mixer-master, mixer-master-volume
 * - ChannelStrip.tsx: channel-strip-{id}, volume-fader-{id}, pan-knob-{id},
 *                     mute-btn-{id}, solo-btn-{id}
 * - MixerConsole.tsx: mixer-console
 * - VUMeter.tsx:      vu-meter
 * - EffectsRack.tsx:  effects-rack, add-effect-btn, add-effect-{type}, effect-slot-{type},
 *                     toggle-effect-{id}, expand-effect-{id}, move-up-effect-{id},
 *                     move-down-effect-{id}, remove-effect-{id}
 * - AutomationEditor.tsx: automation-editor, curve-type-{type}
 */
export class AudioMixerPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Root locators ───────────────────────────────────────────────────

  /** 主混音器容器（AudioMixer.tsx） */
  get mixer(): Locator {
    return this.getByTestId('audio-mixer');
  }

  /** 混音器控制台容器（MixerConsole.tsx，若独立使用） */
  get mixerConsole(): Locator {
    return this.getByTestId('mixer-console');
  }

  /** Master 总线条 */
  get masterStrip(): Locator {
    return this.getByTestId('mixer-master');
  }

  /** Master 音量推子 */
  get masterVolume(): Locator {
    return this.getByTestId('mixer-master-volume');
  }

  // ── Channel Strip locators ─────────────────────────────────────────

  /** 获取指定通道条容器 locator */
  channelStrip(trackId: string): Locator {
    return this.getByTestId(`mixer-channel-${trackId}`);
  }

  /** 获取指定通道的音量推子 locator */
  volumeFader(trackId: string): Locator {
    return this.getByTestId(`mixer-volume-${trackId}`);
  }

  /** 获取指定通道的声像旋钮 locator */
  panKnob(trackId: string): Locator {
    return this.getByTestId(`mixer-pan-${trackId}`);
  }

  /** 获取指定通道的静音按钮 locator */
  muteButton(trackId: string): Locator {
    return this.getByTestId(`mixer-mute-${trackId}`);
  }

  /** 获取指定通道的独占按钮 locator */
  soloButton(trackId: string): Locator {
    return this.getByTestId(`mixer-solo-${trackId}`);
  }

  /** 获取指定通道的展开/折叠按钮 locator */
  expandButton(trackId: string): Locator {
    return this.getByTestId(`mixer-expand-${trackId}`);
  }

  /** 获取指定通道的路由徽章 locator */
  channelRouting(trackId: string): Locator {
    return this.getByTestId(`mixer-channel-routing-${trackId}`);
  }

  // ── Channel Strip actions ──────────────────────────────────────────

  /** 设置指定通道的音量 */
  async setVolume(trackId: string, value: number): Promise<void> {
    await this.volumeFader(trackId).fill(String(value));
  }

  /** 设置指定通道的声像 */
  async setPan(trackId: string, value: number): Promise<void> {
    await this.panKnob(trackId).fill(String(value));
  }

  /** 切换指定通道的静音状态 */
  async toggleMute(trackId: string): Promise<void> {
    await this.muteButton(trackId).click();
  }

  /** 切换指定通道的独占状态 */
  async toggleSolo(trackId: string): Promise<void> {
    await this.soloButton(trackId).click();
  }

  /** 展开/折叠指定通道 */
  async toggleExpand(trackId: string): Promise<void> {
    await this.expandButton(trackId).click();
  }

  // ── EQ & Compressor ────────────────────────────────────────────────

  /** 获取指定通道的 EQ 启用复选框 locator */
  eqEnabled(trackId: string): Locator {
    return this.getByTestId(`mixer-eq-enabled-${trackId}`);
  }

  /** 切换指定通道的 EQ 启用状态 */
  async toggleEQ(trackId: string): Promise<void> {
    await this.eqEnabled(trackId).click();
  }

  /** 获取指定通道的压缩器启用复选框 locator */
  compressorEnabled(trackId: string): Locator {
    return this.getByTestId(`mixer-compressor-enabled-${trackId}`);
  }

  /** 切换指定通道的压缩器启用状态 */
  async toggleCompressor(trackId: string): Promise<void> {
    await this.compressorEnabled(trackId).click();
  }

  /** 获取指定通道指定频段的增益滑块 locator */
  eqBandGain(trackId: string, bandId: string): Locator {
    return this.getByTestId(`mixer-eq-gain-${trackId}-${bandId}`);
  }

  /** 获取指定通道指定频段的频率滑块 locator */
  eqBandFrequency(trackId: string, bandId: string): Locator {
    return this.getByTestId(`mixer-eq-frequency-${trackId}-${bandId}`);
  }

  /** 获取指定通道指定频段的 Q 值滑块 locator */
  eqBandQ(trackId: string, bandId: string): Locator {
    return this.getByTestId(`mixer-eq-q-${trackId}-${bandId}`);
  }

  /** 获取指定通道的 EQ 曲线图 locator */
  eqGraph(trackId: string): Locator {
    return this.getByTestId(`mixer-eq-graph-${trackId}`);
  }

  // ── Audio Ducking ──────────────────────────────────────────────────

  /** 获取音频闪避按钮 locator */
  get duckingButton(): Locator {
    return this.getByTestId('audio-ducking-button');
  }

  /** 获取音频闪避面板 locator */
  get duckingPanel(): Locator {
    return this.getByTestId('audio-ducking-panel');
  }

  /** 获取闪避主导轨道选择器 locator */
  get duckingLeadSelect(): Locator {
    return this.getByTestId('audio-ducking-lead-select');
  }

  /** 获取闪避背景轨道选择器 locator */
  get duckingBackgroundSelect(): Locator {
    return this.getByTestId('audio-ducking-background-select');
  }

  /** 获取闪避分析按钮 locator */
  get duckingAnalyzeButton(): Locator {
    return this.getByTestId('audio-ducking-analyze-button');
  }

  /** 获取闪避取消按钮 locator */
  get duckingCancelButton(): Locator {
    return this.getByTestId('audio-ducking-cancel-button');
  }

  /** 获取闪避应用按钮 locator */
  get duckingApplyButton(): Locator {
    return this.getByTestId('audio-ducking-apply-button');
  }

  /** 获取闪避预览摘要文本 locator */
  get duckingPreviewSummary(): Locator {
    return this.getByTestId('audio-ducking-preview-summary');
  }

  /** 获取闪避错误信息 locator */
  get duckingError(): Locator {
    return this.getByTestId('audio-ducking-error');
  }

  /** 点击音频闪避按钮 */
  async openDucking(): Promise<void> {
    await this.duckingButton.click();
  }

  /** 设置闪避主导轨道 */
  async setDuckingLeadTrack(trackId: string): Promise<void> {
    await this.duckingLeadSelect.selectOption(trackId);
  }

  /** 设置闪避背景轨道 */
  async setDuckingBackgroundTrack(trackId: string): Promise<void> {
    await this.duckingBackgroundSelect.selectOption(trackId);
  }

  /** 点击闪避分析按钮 */
  async analyzeDucking(): Promise<void> {
    await this.duckingAnalyzeButton.click();
  }

  /** 点击闪避应用按钮 */
  async applyDucking(): Promise<void> {
    await this.duckingApplyButton.click();
  }

  /** 点击闪避取消按钮 */
  async cancelDucking(): Promise<void> {
    await this.duckingCancelButton.click();
  }

  // ── Channel Analysis ───────────────────────────────────────────────

  /** 获取通道分析面板 locator */
  get channelAnalysisPanel(): Locator {
    return this.getByTestId('audio-channel-analysis-panel');
  }

  /** 获取通道分析轨道选择器 locator */
  get channelAnalysisTrackSelect(): Locator {
    return this.getByTestId('audio-channel-analysis-track-select');
  }

  /** 获取通道分析录制按钮 locator */
  get channelAnalysisRecordButton(): Locator {
    return this.getByTestId('audio-channel-analysis-record-button');
  }

  /** 获取通道分析导出按钮 locator */
  get channelAnalysisExportButton(): Locator {
    return this.getByTestId('audio-channel-analysis-export-button');
  }

  /** 获取通道分析相关性值 locator */
  get channelAnalysisCorrelation(): Locator {
    return this.getByTestId('audio-channel-analysis-correlation');
  }

  /** 获取通道分析错误信息 locator */
  get channelAnalysisError(): Locator {
    return this.getByTestId('audio-channel-analysis-error');
  }

  /** 获取通道分析历史记录计数 locator */
  get channelAnalysisHistoryCount(): Locator {
    return this.getByTestId('audio-channel-analysis-history-count');
  }

  /** 获取通道分析历史滑块 locator */
  get channelAnalysisHistorySlider(): Locator {
    return this.getByTestId('audio-channel-analysis-history-slider');
  }

  /** 获取通道分析频率峰值列表 locator */
  get channelAnalysisPeaks(): Locator {
    return this.getByTestId('audio-channel-analysis-peaks');
  }

  /** 获取指定索引的频率峰值 locator */
  channelAnalysisPeak(index: number): Locator {
    return this.getByTestId(`audio-channel-analysis-peak-${index}`);
  }

  /** 获取通道分析频率曲线 SVG locator */
  get channelAnalysisCurve(): Locator {
    return this.getByTestId('audio-channel-analysis-curve');
  }

  /** 获取通道分析相位图 SVG locator */
  get channelAnalysisPhase(): Locator {
    return this.getByTestId('audio-channel-analysis-phase');
  }

  /** 选择通道分析轨道 */
  async selectAnalysisTrack(trackId: string): Promise<void> {
    await this.channelAnalysisTrackSelect.selectOption(trackId);
  }

  /** 点击录制按钮 */
  async toggleAnalysisRecording(): Promise<void> {
    await this.channelAnalysisRecordButton.click();
  }

  /** 点击导出按钮 */
  async exportAnalysis(): Promise<void> {
    await this.channelAnalysisExportButton.click();
  }

  // ── Effects Rack ───────────────────────────────────────────────────

  /** 获取效果器机架 locator */
  get effectsRack(): Locator {
    return this.getByTestId('effects-rack');
  }

  /** 获取添加效果器按钮 locator */
  get addEffectButton(): Locator {
    return this.getByTestId('add-effect-btn');
  }

  /** 获取指定类型的效果器添加按钮 locator */
  addEffectByType(type: string): Locator {
    return this.getByTestId(`add-effect-${type}`);
  }

  /** 获取指定效果器插槽 locator */
  effectSlot(effectType: string): Locator {
    return this.getByTestId(`effect-slot-${effectType}`);
  }

  /** 切换指定效果器的启用状态 */
  async toggleEffect(effectId: string): Promise<void> {
    await this.safeClick(`toggle-effect-${effectId}`);
  }

  /** 展开/折叠指定效果器 */
  async expandEffect(effectId: string): Promise<void> {
    await this.safeClick(`expand-effect-${effectId}`);
  }

  /** 上移指定效果器 */
  async moveEffectUp(effectId: string): Promise<void> {
    await this.safeClick(`move-up-effect-${effectId}`);
  }

  /** 下移指定效果器 */
  async moveEffectDown(effectId: string): Promise<void> {
    await this.safeClick(`move-down-effect-${effectId}`);
  }

  /** 移除指定效果器 */
  async removeEffect(effectId: string): Promise<void> {
    await this.safeClick(`remove-effect-${effectId}`);
  }

  /** 点击添加效果器按钮展开菜单，然后选择指定类型 */
  async addEffect(type: string): Promise<void> {
    await this.addEffectButton.click();
    await this.addEffectByType(type).click();
  }

  // ── Automation Editor ──────────────────────────────────────────────

  /** 获取自动化编辑器 locator */
  get automationEditor(): Locator {
    return this.getByTestId('automation-editor');
  }

  /** 获取指定曲线类型按钮 locator */
  curveType(type: string): Locator {
    return this.getByTestId(`curve-type-${type}`);
  }

  /** 选择指定曲线类型 */
  async selectCurveType(type: string): Promise<void> {
    await this.curveType(type).click();
  }
}
