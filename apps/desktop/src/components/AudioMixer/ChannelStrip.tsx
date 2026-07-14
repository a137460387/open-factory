import React, { useCallback } from 'react';
import type { MixerChannel } from '@open-factory/editor-core';
import { VUMeter } from './VUMeter';

interface ChannelStripProps {
  channel: MixerChannel;
  onChange: (changes: Partial<MixerChannel>) => void;
  onSoloToggle: () => void;
  onMuteToggle: () => void;
}

export const ChannelStrip: React.FC<ChannelStripProps> = ({ channel, onChange, onSoloToggle, onMuteToggle }) => {
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ volume: Number(e.target.value) });
    },
    [onChange],
  );

  const handlePanChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ pan: Number(e.target.value) });
    },
    [onChange],
  );

  return (
    <div
      className="flex flex-col items-center w-16 bg-gray-800 rounded p-1"
      data-testid={`channel-strip-${channel.trackId}`}
    >
      {/* 通道名 */}
      <span className="text-xs text-gray-300 truncate w-full text-center mb-1">{channel.name}</span>

      {/* VU 表 */}
      <VUMeter level={channel.metering.peakLevel} />

      {/* 音量推子 */}
      <div className="flex-1 flex flex-col items-center w-8 mt-1">
        <input
          type="range"
          min={-60}
          max={12}
          step={0.1}
          value={channel.volume}
          onChange={handleVolumeChange}
          className="h-full appearance-none bg-transparent cursor-pointer"
          style={{ writingMode: 'vertical-lr', direction: 'rtl', width: '32px', height: '100%' }}
          data-testid={`volume-fader-${channel.trackId}`}
        />
        <span className="text-xs text-gray-400 mt-1">{channel.volume.toFixed(1)}</span>
      </div>

      {/* 声像旋钮 */}
      <div className="flex flex-col items-center mt-1">
        <input
          type="range"
          min={-100}
          max={100}
          value={channel.pan}
          onChange={handlePanChange}
          className="w-12"
          data-testid={`pan-knob-${channel.trackId}`}
        />
        <span className="text-xs text-gray-400">
          {channel.pan === 0 ? 'C' : channel.pan < 0 ? `L${Math.abs(channel.pan)}` : `R${channel.pan}`}
        </span>
      </div>

      {/* 静音/独占按钮 */}
      <div className="flex gap-1 mt-1">
        <button
          onClick={onMuteToggle}
          className={`px-1.5 py-0.5 text-xs rounded ${channel.muted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          data-testid={`mute-btn-${channel.trackId}`}
        >
          M
        </button>
        <button
          onClick={onSoloToggle}
          className={`px-1.5 py-0.5 text-xs rounded ${channel.solo ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400'}`}
          data-testid={`solo-btn-${channel.trackId}`}
        >
          S
        </button>
      </div>
    </div>
  );
};
