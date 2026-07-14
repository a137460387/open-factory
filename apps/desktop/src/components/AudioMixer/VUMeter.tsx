import React from 'react';

interface VUMeterProps {
  level: number; // dB
  clipThreshold?: number;
}

export const VUMeter: React.FC<VUMeterProps> = ({ level, clipThreshold = -3 }) => {
  // 将 dB 转换为百分比 (-60dB = 0%, 0dB = 100%)
  const percent = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));
  const isClipping = level > clipThreshold;

  return (
    <div className="w-6 h-24 bg-gray-900 rounded-sm relative overflow-hidden" data-testid="vu-meter">
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-75 ${
          isClipping ? 'bg-red-500' : percent > 80 ? 'bg-yellow-500' : 'bg-green-500'
        }`}
        style={{ height: `${percent}%` }}
      />
      {/* 刻度线 */}
      {[0, 25, 50, 75, 100].map((mark) => (
        <div key={mark} className="absolute left-0 right-0 border-t border-gray-600" style={{ bottom: `${mark}%` }} />
      ))}
    </div>
  );
};
