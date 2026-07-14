import React, { useCallback } from 'react';
import type { MixerChannel, MixerState } from '@open-factory/editor-core';
import { ChannelStrip } from './ChannelStrip';

interface MixerConsoleProps {
  state: MixerState;
  onChannelChange: (trackId: string, changes: Partial<MixerChannel>) => void;
  onSoloToggle: (trackId: string) => void;
  onMuteToggle: (trackId: string) => void;
}

export const MixerConsole: React.FC<MixerConsoleProps> = ({ state, onChannelChange, onSoloToggle, onMuteToggle }) => {
  return (
    <div className="flex flex-col h-full bg-gray-900" data-testid="mixer-console">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200">混音器</h3>
      </div>

      <div className="flex-1 flex overflow-x-auto p-2 gap-1">
        {/* 通道条 */}
        {state.channels.map((channel) => (
          <ChannelStrip
            key={channel.trackId}
            channel={channel}
            onChange={(changes) => onChannelChange(channel.trackId, changes)}
            onSoloToggle={() => onSoloToggle(channel.trackId)}
            onMuteToggle={() => onMuteToggle(channel.trackId)}
          />
        ))}

        {/* 总线条 */}
        {state.buses.map((bus) => (
          <div key={bus.id} className="flex flex-col items-center w-16 bg-gray-800 rounded p-1">
            <span className="text-xs text-gray-400 truncate w-full text-center">{bus.name}</span>
            <div className="flex-1 w-8 bg-gray-700 rounded-sm mt-1 relative">
              <div
                className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-sm transition-all"
                style={{ height: `${Math.max(0, Math.min(100, ((bus.volume + 60) / 72) * 100))}%` }}
              />
            </div>
          </div>
        ))}

        {/* Master */}
        <div className="flex flex-col items-center w-20 bg-gray-800 rounded p-1 border border-yellow-600">
          <span className="text-xs text-yellow-400 font-medium">Master</span>
          <div className="flex-1 w-10 bg-gray-700 rounded-sm mt-1 relative">
            <div
              className="absolute bottom-0 left-0 right-0 bg-yellow-500 rounded-sm transition-all"
              style={{ height: `${Math.max(0, Math.min(100, ((state.masterBus.volume + 60) / 72) * 100))}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 mt-1">{state.masterBus.volume.toFixed(1)} dB</span>
        </div>
      </div>
    </div>
  );
};
