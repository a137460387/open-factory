// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelStrip } from './ChannelStrip';
import type { MixerChannel } from '@open-factory/editor-core';

function makeMockMixerChannel(overrides: Partial<MixerChannel> = {}): MixerChannel {
  return {
    trackId: 'track-1',
    name: '测试通道',
    volume: 0,
    pan: 0,
    muted: false,
    solo: false,
    busAssignments: [],
    inputBus: null,
    effectsChain: [],
    automation: {},
    metering: { peakLevel: -20, rmsLevel: -30, clipCount: 0 },
    ...overrides,
  };
}

/** 使用 container.querySelector 获取第一个匹配元素 */
function getFirstByTestId(container: HTMLElement, testId: string): HTMLElement {
  const el = container.querySelector(`[data-testid="${testId}"]`);
  if (!el) throw new Error(`Element with data-testid="${testId}" not found`);
  return el as HTMLElement;
}

describe('ChannelStrip UI 交互', () => {
  it('渲染通道名称', () => {
    const channel = makeMockMixerChannel({ name: '人声轨道' });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );
    expect(container.textContent).toContain('人声轨道');
  });

  it('渲染 VU 表', () => {
    const channel = makeMockMixerChannel();
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );
    const vuMeters = container.querySelectorAll('[data-testid="vu-meter"]');
    expect(vuMeters.length).toBeGreaterThanOrEqual(1);
  });

  it('渲染音量推子', () => {
    const channel = makeMockMixerChannel();
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );
    const fader = getFirstByTestId(container, 'volume-fader-track-1');
    expect(fader).toBeTruthy();
    expect(fader.tagName).toBe('INPUT');
  });

  it('渲染声像旋钮', () => {
    const channel = makeMockMixerChannel();
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );
    const panKnob = getFirstByTestId(container, 'pan-knob-track-1');
    expect(panKnob).toBeTruthy();
    expect(panKnob.tagName).toBe('INPUT');
  });

  it('点击静音按钮触发 onMuteToggle', async () => {
    const channel = makeMockMixerChannel({ muted: false });
    const onMuteToggle = vi.fn();
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={onMuteToggle} />,
    );

    const muteButton = getFirstByTestId(container, 'mute-btn-track-1');
    await userEvent.click(muteButton);
    expect(onMuteToggle).toHaveBeenCalledTimes(1);
  });

  it('点击独奏按钮触发 onSoloToggle', async () => {
    const channel = makeMockMixerChannel({ solo: false });
    const onSoloToggle = vi.fn();
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={onSoloToggle} onMuteToggle={() => {}} />,
    );

    const soloButton = getFirstByTestId(container, 'solo-btn-track-1');
    await userEvent.click(soloButton);
    expect(onSoloToggle).toHaveBeenCalledTimes(1);
  });

  it('静音按钮激活时显示红色样式', () => {
    const channel = makeMockMixerChannel({ muted: true });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );

    const muteButton = getFirstByTestId(container, 'mute-btn-track-1');
    expect(muteButton.className).toContain('bg-red-600');
  });

  it('静音按钮未激活时显示灰色样式', () => {
    const channel = makeMockMixerChannel({ muted: false });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );

    const muteButton = getFirstByTestId(container, 'mute-btn-track-1');
    expect(muteButton.className).toContain('bg-gray-700');
  });

  it('独奏按钮激活时显示黄色样式', () => {
    const channel = makeMockMixerChannel({ solo: true });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );

    const soloButton = getFirstByTestId(container, 'solo-btn-track-1');
    expect(soloButton.className).toContain('bg-yellow-500');
  });

  it('独奏按钮未激活时显示灰色样式', () => {
    const channel = makeMockMixerChannel({ solo: false });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );

    const soloButton = getFirstByTestId(container, 'solo-btn-track-1');
    expect(soloButton.className).toContain('bg-gray-700');
  });

  it('音量推子变更触发 onChange', () => {
    const channel = makeMockMixerChannel({ volume: 0 });
    const onChange = vi.fn();
    const { container } = render(
      <ChannelStrip channel={channel} onChange={onChange} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );

    const volumeFader = getFirstByTestId(container, 'volume-fader-track-1') as HTMLInputElement;
    fireEvent.change(volumeFader, { target: { value: '-6' } });
    expect(onChange).toHaveBeenCalledWith({ volume: -6 });
  });

  it('声像旋钮变更触发 onChange', () => {
    const channel = makeMockMixerChannel({ pan: 0 });
    const onChange = vi.fn();
    const { container } = render(
      <ChannelStrip channel={channel} onChange={onChange} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );

    const panKnob = getFirstByTestId(container, 'pan-knob-track-1') as HTMLInputElement;
    fireEvent.change(panKnob, { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith({ pan: 50 });
  });

  it('声像显示 L 标记（负值）', () => {
    const channel = makeMockMixerChannel({ pan: -50 });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );
    expect(container.textContent).toContain('L50');
  });

  it('声像显示 C 标记（居中）', () => {
    const channel = makeMockMixerChannel({ pan: 0 });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );
    // "C" 可能匹配多个文本，使用精确匹配
    const spans = container.querySelectorAll('span');
    const panLabel = Array.from(spans).find((s) => s.textContent === 'C');
    expect(panLabel).toBeTruthy();
  });

  it('声像显示 R 标记（正值）', () => {
    const channel = makeMockMixerChannel({ pan: 30 });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );
    expect(container.textContent).toContain('R30');
  });

  it('data-testid 正确关联到 trackId', () => {
    const channel = makeMockMixerChannel({ trackId: 'my-track-42' });
    const { container } = render(
      <ChannelStrip channel={channel} onChange={() => {}} onSoloToggle={() => {}} onMuteToggle={() => {}} />,
    );
    expect(getFirstByTestId(container, 'channel-strip-my-track-42')).toBeTruthy();
    expect(getFirstByTestId(container, 'volume-fader-my-track-42')).toBeTruthy();
    expect(getFirstByTestId(container, 'pan-knob-my-track-42')).toBeTruthy();
    expect(getFirstByTestId(container, 'mute-btn-my-track-42')).toBeTruthy();
    expect(getFirstByTestId(container, 'solo-btn-my-track-42')).toBeTruthy();
  });
});
