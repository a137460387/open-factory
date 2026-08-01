/**
 * HSL Qualifier Component
 */

import React, {useCallback} from 'react';
import {ColorSlider} from './ColorSlider';
import type {HSLQualifierProps, HSLQualifierParams} from './types';

export const HSLQualifier: React.FC<HSLQualifierProps> = ({ params, onChange }) => {
  const handleChange = useCallback(
    (key: keyof HSLQualifierParams, value: number) => {
      onChange({ ...params, [key]: value });
    },
    [params, onChange],
  );

  return (
    <div className="hsl-qualifier">
      <h4>色相限定</h4>
      <ColorSlider
        label="色相中心"
        value={params.hueCenter}
        onChange={(v) => handleChange('hueCenter', v)}
        min={0}
        max={360}
        unit="°"
      />
      <ColorSlider
        label="色相宽度"
        value={params.hueWidth}
        onChange={(v) => handleChange('hueWidth', v)}
        min={0}
        max={180}
        unit="°"
      />
      <ColorSlider
        label="色相柔和度"
        value={params.hueSoftness}
        onChange={(v) => handleChange('hueSoftness', v)}
        min={0}
        max={1}
      />

      <h4>饱和度限定</h4>
      <ColorSlider
        label="最小饱和度"
        value={params.satMin}
        onChange={(v) => handleChange('satMin', v)}
        min={0}
        max={1}
      />
      <ColorSlider
        label="最大饱和度"
        value={params.satMax}
        onChange={(v) => handleChange('satMax', v)}
        min={0}
        max={1}
      />

      <h4>亮度限定</h4>
      <ColorSlider label="最小亮度" value={params.lumMin} onChange={(v) => handleChange('lumMin', v)} min={0} max={1} />
      <ColorSlider label="最大亮度" value={params.lumMax} onChange={(v) => handleChange('lumMax', v)} min={0} max={1} />

      <h4>调整</h4>
      <ColorSlider
        label="色相偏移"
        value={params.hueShift}
        onChange={(v) => handleChange('hueShift', v)}
        min={-180}
        max={180}
        unit="°"
      />
      <ColorSlider label="饱和度" value={params.saturation} onChange={(v) => handleChange('saturation', v)} />
      <ColorSlider label="亮度" value={params.brightness} onChange={(v) => handleChange('brightness', v)} />
    </div>
  );
};
