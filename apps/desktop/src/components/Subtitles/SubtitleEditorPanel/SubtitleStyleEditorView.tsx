import { useState, useEffect, useCallback } from 'react';
import type { SubtitleStyle } from '@open-factory/editor-core';
import { BUILTIN_SUBTITLE_STYLE_TEMPLATES } from '@open-factory/editor-core';
import type { SubtitleStyleEditorViewProps } from './types';

export function SubtitleStyleEditorView({
  selectedCount,
  commonStyle,
  onStyleUpdate,
  onApplyTemplate,
}: SubtitleStyleEditorViewProps) {
  const [localStyle, setLocalStyle] = useState<Partial<SubtitleStyle>>({});

  // Sync common style
  useEffect(() => {
    if (commonStyle) {
      setLocalStyle(commonStyle);
    }
  }, [commonStyle]);

  const handleStyleChange = useCallback(
    (key: keyof SubtitleStyle, value: unknown) => {
      const newStyle = { ...localStyle, [key]: value };
      setLocalStyle(newStyle);
      onStyleUpdate({ [key]: value });
    },
    [localStyle, onStyleUpdate],
  );

  if (selectedCount === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-[var(--color-text-muted)]">
        请先选择字幕片段
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {/* Templates */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">样式模板</h3>
        <div className="grid grid-cols-2 gap-2">
          {BUILTIN_SUBTITLE_STYLE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onApplyTemplate(template.id)}
              className="rounded border border-line p-2 text-left text-xs hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5"
              data-testid={`style-template-${template.id}`}
            >
              <div className="font-medium">{template.name}</div>
              <div
                className="mt-1 h-6 rounded text-center text-white"
                style={{
                  backgroundColor: template.style.backgroundColor,
                  color: template.style.color,
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                示例
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Style */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">自定义样式</h3>
        <div className="space-y-2">
          {/* Font Family */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">字体</label>
            <select
              value={localStyle.fontFamily || 'Arial, sans-serif'}
              onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
              className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
            >
              <option value="Arial, sans-serif">Arial</option>
              <option value="Helvetica, Arial, sans-serif">Helvetica</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Times New Roman, serif">Times New Roman</option>
              <option value="Microsoft YaHei, sans-serif">微软雅黑</option>
              <option value="SimHei, sans-serif">黑体</option>
              <option value="SimSun, serif">宋体</option>
            </select>
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">大小</label>
            <input
              type="range"
              min="12"
              max="120"
              value={localStyle.fontSize || 42}
              onChange={(e) => handleStyleChange('fontSize', Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-8 text-xs text-right">{localStyle.fontSize || 42}</span>
          </div>

          {/* Colors */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">文字色</label>
            <input
              type="color"
              value={localStyle.color || '#ffffff'}
              onChange={(e) => handleStyleChange('color', e.target.value)}
              className="h-6 w-8 rounded border border-line"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">背景色</label>
            <input
              type="color"
              value={localStyle.backgroundColor || '#000000'}
              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              className="h-6 w-8 rounded border border-line"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={localStyle.backgroundOpacity ?? 0.55}
              onChange={(e) => handleStyleChange('backgroundOpacity', Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">描边色</label>
            <input
              type="color"
              value={localStyle.outlineColor || '#000000'}
              onChange={(e) => handleStyleChange('outlineColor', e.target.value)}
              className="h-6 w-8 rounded border border-line"
            />
            <input
              type="range"
              min="0"
              max="12"
              value={localStyle.outlineWidth || 0}
              onChange={(e) => handleStyleChange('outlineWidth', Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">阴影</label>
            <input
              type="color"
              value={localStyle.shadowColor || '#000000'}
              onChange={(e) => handleStyleChange('shadowColor', e.target.value)}
              className="h-6 w-8 rounded border border-line"
            />
            <input
              type="range"
              min="0"
              max="24"
              value={localStyle.shadowOffset || 0}
              onChange={(e) => handleStyleChange('shadowOffset', Number(e.target.value))}
              className="flex-1"
            />
          </div>

          {/* Y Offset */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">垂直位置</label>
            <input
              type="range"
              min="0"
              max="200"
              value={localStyle.yOffset || 72}
              onChange={(e) => handleStyleChange('yOffset', Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-8 text-xs text-right">{localStyle.yOffset || 72}</span>
          </div>

          {/* Bold & Italic */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={localStyle.bold || false}
                onChange={(e) => handleStyleChange('bold', e.target.checked)}
                className="rounded border-line"
              />
              粗体
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={localStyle.italic || false}
                onChange={(e) => handleStyleChange('italic', e.target.checked)}
                className="rounded border-line"
              />
              斜体
            </label>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">预览</h3>
        <div className="relative h-20 rounded border border-line bg-gray-900" style={{ overflow: 'hidden' }}>
          <div
            className="absolute inset-x-0 text-center"
            style={{
              bottom: `${Math.min(80, (localStyle.yOffset || 72) / 2)}px`,
              color: localStyle.color || '#ffffff',
              fontFamily: localStyle.fontFamily || 'Arial, sans-serif',
              fontSize: `${Math.min(24, (localStyle.fontSize || 42) / 2)}px`,
              fontWeight: localStyle.bold ? 'bold' : 'normal',
              fontStyle: localStyle.italic ? 'italic' : 'normal',
              textShadow: localStyle.shadowOffset
                ? `${localStyle.shadowOffset}px ${localStyle.shadowOffset}px ${localStyle.shadowColor || '#000000'}`
                : 'none',
              WebkitTextStroke: localStyle.outlineWidth
                ? `${localStyle.outlineWidth}px ${localStyle.outlineColor || '#000000'}`
                : 'none',
            }}
          >
            示例字幕文本
          </div>
        </div>
      </div>
    </div>
  );
}
