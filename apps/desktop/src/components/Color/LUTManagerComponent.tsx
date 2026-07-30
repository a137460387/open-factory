/**
 * LUT Manager Component
 */

import React from 'react';
import {ColorSlider} from './ColorSlider';
import type {LUTManagerProps} from './types';

export const LUTManagerComponent: React.FC<LUTManagerProps> = ({
  luts,
  selectedLUTId,
  onSelect,
  intensity,
  onIntensityChange,
}) => {
  return (
    <div className="lut-manager">
      <h4>LUT管理</h4>

      <div style={{ marginBottom: 12 }}>
        <label>选择LUT</label>
        <select
          value={selectedLUTId || ''}
          onChange={(e) => onSelect(e.target.value || undefined)}
          style={{
            width: '100%',
            padding: 8,
            background: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 4,
          }}
        >
          <option value="">无</option>
          {luts.map((lut) => (
            <option key={lut.id} value={lut.id}>
              {lut.name} ({lut.type === '3d' ? '3D' : '1D'}, {lut.size}x{lut.size}x{lut.size})
            </option>
          ))}
        </select>
      </div>

      {selectedLUTId && <ColorSlider label="LUT强度" value={intensity} onChange={onIntensityChange} min={0} max={1} />}

      {/* LUT preview */}
      {selectedLUTId && (
        <div style={{ marginTop: 12 }}>
          <label>LUT预览</label>
          <div
            style={{
              width: '100%',
              height: 50,
              background: 'linear-gradient(to right, #000, #fff)',
              borderRadius: 4,
              marginTop: 4,
            }}
          />
        </div>
      )}
    </div>
  );
};
