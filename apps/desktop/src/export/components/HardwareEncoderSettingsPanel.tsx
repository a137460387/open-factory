import type { Dispatch, SetStateAction } from 'react';
import type { HardwareEncoderInfo, HardwareEncoderSettings, HardwareRateControlMode } from '@open-factory/editor-core';
import type { ExportPresetSettings } from '../export-presets';
import { updateHardwareEncoderId, updateHardwareEncoderPreset, updateHardwareRateControlMode, updateHardwareCq, updateHardwareVideoBitrate, updateHardwareMaxBitrate, updateHardwareGopSize, updateHardwareBFrames } from '../lib/exportSettingsHelpers';

const RC_OPTIONS: Array<{ value: HardwareRateControlMode; label: string }> = [
  { value: 'cqp', label: 'CQP' },
  { value: 'vbr', label: 'VBR' },
  { value: 'cbr', label: 'CBR' },
];

export function HardwareEncoderSettingsPanel({ encoders, settings, setDraftSettings, disabled }: {
  encoders: HardwareEncoderInfo[];
  settings?: HardwareEncoderSettings | null;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  disabled?: boolean;
}) {
  const selectedId = settings?.encoderId ?? encoders[0]?.id;
  const selected = encoders.find(e => e.id === selectedId) ?? encoders[0];
  const rc = settings?.rateControlMode ?? 'cqp';
  const presets = selected?.presets ?? [];

  return (
    <div className="grid gap-2 rounded-md border border-line bg-slate-50 p-3" data-testid="hw-encoder-settings">
      <label className="space-y-1 text-xs font-medium text-slate-600">
        <span>Encoder</span>
        <select className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" value={selectedId} disabled={disabled} onChange={e => updateHardwareEncoderId(setDraftSettings, e.target.value)} data-testid="hw-encoder-select">
          {encoders.map(enc => <option key={enc.id} value={enc.id}>{enc.name}</option>)}
        </select>
      </label>
      {presets.length > 0 && (
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Preset</span>
          <select className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" value={settings?.preset ?? presets[0]?.value ?? ''} disabled={disabled} onChange={e => updateHardwareEncoderPreset(setDraftSettings, e.target.value)} data-testid="hw-encoder-preset-select">
            {presets.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
      )}
      <label className="space-y-1 text-xs font-medium text-slate-600">
        <span>Rate Control</span>
        <select className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" value={rc} disabled={disabled} onChange={e => updateHardwareRateControlMode(setDraftSettings, e.target.value)} data-testid="hw-rate-control-select">
          {RC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {rc === 'cqp' && (
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>CQ: {settings?.cq ?? selected?.defaultCq ?? 23}</span>
          <input className="w-full accent-brand" type="range" min={1} max={51} value={settings?.cq ?? selected?.defaultCq ?? 23} disabled={disabled} onChange={e => updateHardwareCq(setDraftSettings, e.target.value)} data-testid="hw-cq-slider" />
        </label>
      )}
      {(rc === 'vbr' || rc === 'cbr') && (
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Bitrate</span>
          <input className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" type="text" placeholder="8M" value={settings?.videoBitrate ?? ''} disabled={disabled} onChange={e => updateHardwareVideoBitrate(setDraftSettings, e.target.value)} data-testid="hw-bitrate-input" />
        </label>
      )}
      {rc === 'vbr' && (
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Max Bitrate</span>
          <input className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" type="text" placeholder="12M" value={settings?.maxBitrate ?? ''} disabled={disabled} onChange={e => updateHardwareMaxBitrate(setDraftSettings, e.target.value)} data-testid="hw-max-bitrate-input" />
        </label>
      )}
      <label className="space-y-1 text-xs font-medium text-slate-600">
        <span>GOP Size</span>
        <input className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" type="number" min={0} placeholder="0=auto" value={settings?.gopSize ?? ''} disabled={disabled} onChange={e => updateHardwareGopSize(setDraftSettings, e.target.value)} data-testid="hw-gop-size-input" />
      </label>
      {selected?.supportsBFrames && (
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>B-Frames</span>
          <input className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" type="number" min={-1} max={16} placeholder="-1=auto" value={settings?.bFrames ?? ''} disabled={disabled} onChange={e => updateHardwareBFrames(setDraftSettings, e.target.value)} data-testid="hw-bframes-input" />
        </label>
      )}
    </div>
  );
}
