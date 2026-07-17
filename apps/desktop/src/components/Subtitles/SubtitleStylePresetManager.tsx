import { useState, useCallback, useEffect, useMemo } from 'react';
import type { SubtitleStyle } from '@open-factory/editor-core';
import {
  createStylePreset,
  updateStylePreset,
  filterPresets,
  sortPresets,
  loadPresetsFromStorage,
  savePresetsToStorage,
  exportPresetsToJson,
  importPresetsFromJson,
  exportPresetToFile,
  importPresetFromFile,
  areStylesEqual,
  diffStyles,
  type SubtitleStylePreset,
} from '@open-factory/editor-core';
import {
  BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  normalizeSubtitleStyleTemplateStyle,
} from '@open-factory/editor-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtitleStylePresetManagerProps {
  currentStyle?: SubtitleStyle;
  onApplyPreset: (style: SubtitleStyle) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubtitleStylePresetManager({
  currentStyle,
  onApplyPreset,
  onClose,
}: SubtitleStylePresetManagerProps) {
  const [presets, setPresets] = useState<SubtitleStylePreset[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveTags, setSaveTags] = useState('');

  // 加载预设
  useEffect(() => {
    const collection = loadPresetsFromStorage();
    setPresets(collection.presets);
  }, []);

  // 保存预设
  const savePresets = useCallback((newPresets: SubtitleStylePreset[]) => {
    setPresets(newPresets);
    savePresetsToStorage(newPresets);
  }, []);

  // 过滤和排序后的预设
  const filteredPresets = useMemo(() => {
    const filtered = filterPresets(presets, {
      searchText,
      favoritesOnly: showFavoritesOnly,
    });
    return sortPresets(filtered, sortBy, sortOrder);
  }, [presets, searchText, showFavoritesOnly, sortBy, sortOrder]);

  // 保存当前样式为新预设
  const handleSaveAsPreset = useCallback(() => {
    if (!currentStyle) return;
    setShowSaveDialog(true);
    setSaveName('');
    setSaveTags('');
  }, [currentStyle]);

  // 确认保存
  const handleConfirmSave = useCallback(() => {
    if (!currentStyle || !saveName.trim()) return;

    const tags = saveTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const newPreset = createStylePreset(saveName.trim(), currentStyle, tags);
    const newPresets = [newPreset, ...presets];
    savePresets(newPresets);
    setShowSaveDialog(false);
    setSaveName('');
    setSaveTags('');
  }, [currentStyle, saveName, saveTags, presets, savePresets]);

  // 更新预设名称
  const handleUpdateName = useCallback(
    (presetId: string) => {
      if (!editName.trim()) return;

      const newPresets = presets.map((preset) =>
        preset.id === presetId
          ? updateStylePreset(preset, { name: editName.trim() })
          : preset,
      );
      savePresets(newPresets);
      setEditingPresetId(null);
      setEditName('');
    },
    [editName, presets, savePresets],
  );

  // 切换收藏
  const handleToggleFavorite = useCallback(
    (presetId: string) => {
      const newPresets = presets.map((preset) =>
        preset.id === presetId
          ? updateStylePreset(preset, { favorite: !preset.favorite })
          : preset,
      );
      savePresets(newPresets);
    },
    [presets, savePresets],
  );

  // 删除预设
  const handleDeletePreset = useCallback(
    (presetId: string) => {
      const newPresets = presets.filter((preset) => preset.id !== presetId);
      savePresets(newPresets);
    },
    [presets, savePresets],
  );

  // 导出所有预设
  const handleExportAll = useCallback(() => {
    const json = exportPresetsToJson(presets);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitle-style-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  // 导出单个预设
  const handleExportSingle = useCallback(
    (preset: SubtitleStylePreset, format: 'json' | 'ofp' = 'json') => {
      const { filename, content } = exportPresetToFile(preset, format);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  // 导入预设
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ofp';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          let importedPresets: SubtitleStylePreset[];

          // 尝试作为集合导入
          try {
            importedPresets = importPresetsFromJson(content);
          } catch {
            // 尝试作为单个预设导入
            const singlePreset = importPresetFromFile(content);
            importedPresets = [singlePreset];
          }

          // 合并到现有预设
          const newPresets = [...importedPresets, ...presets];
          savePresets(newPresets);
        } catch (error) {
          console.error('Failed to import presets:', error);
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [presets, savePresets]);

  // 应用预设
  const handleApplyPreset = useCallback(
    (preset: SubtitleStylePreset) => {
      onApplyPreset(preset.style);
    },
    [onApplyPreset],
  );

  // 应用内置模板
  const handleApplyBuiltin = useCallback(
    (templateId: string) => {
      const template = BUILTIN_SUBTITLE_STYLE_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        onApplyPreset(template.style);
      }
    },
    [onApplyPreset],
  );

  // 重置为默认
  const handleResetToDefault = useCallback(() => {
    onApplyPreset(normalizeSubtitleStyleTemplateStyle({}));
  }, [onApplyPreset]);

  return (
    <div
      className="flex flex-col bg-[var(--color-bg-primary)] shadow-lg rounded-lg border border-line"
      style={{ width: '360px', maxHeight: '600px' }}
      data-testid="subtitle-style-preset-manager"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h3 className="text-sm font-semibold text-ink">样式预设管理</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="rounded border border-line px-2 py-1 text-xs hover:bg-panel"
            data-testid="preset-import"
          >
            导入
          </button>
          <button
            onClick={handleExportAll}
            disabled={presets.length === 0}
            className="rounded border border-line px-2 py-1 text-xs hover:bg-panel disabled:opacity-50"
            data-testid="preset-export-all"
          >
            导出全部
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
            data-testid="preset-manager-close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索预设..."
            className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
            data-testid="preset-search"
          />
          <button
            onClick={handleSaveAsPreset}
            disabled={!currentStyle}
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
            data-testid="preset-save-new"
          >
            保存当前
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={showFavoritesOnly}
                onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                className="rounded border-line"
              />
              仅收藏
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'createdAt' | 'updatedAt')}
              className="rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
            >
              <option value="name">按名称</option>
              <option value="createdAt">按创建时间</option>
              <option value="updatedAt">按更新时间</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="rounded border border-line px-2 py-1 text-xs hover:bg-panel"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <button
            onClick={handleResetToDefault}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            重置默认
          </button>
        </div>
      </div>

      {/* Builtin Templates */}
      <div className="px-3 pb-2">
        <h4 className="mb-2 text-xs font-medium text-ink">内置模板</h4>
        <div className="grid grid-cols-2 gap-2">
          {BUILTIN_SUBTITLE_STYLE_TEMPLATES.slice(0, 4).map((template) => (
            <button
              key={template.id}
              onClick={() => handleApplyBuiltin(template.id)}
              className="rounded border border-line p-2 text-left text-xs hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5"
              data-testid={`builtin-template-${template.id}`}
            >
              <div className="font-medium">{template.name}</div>
              <div
                className="mt-1 h-5 rounded text-center text-white"
                style={{
                  backgroundColor: template.style.backgroundColor,
                  color: template.style.color,
                  fontSize: '9px',
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

      {/* User Presets */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-t border-line">
          <h4 className="text-xs font-medium text-ink">
            用户预设 ({filteredPresets.length})
          </h4>
        </div>

        {filteredPresets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
            {presets.length === 0
              ? '暂无保存的预设，点击"保存当前"开始'
              : '未找到匹配的预设'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {filteredPresets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-panel"
                data-testid={`user-preset-${preset.id}`}
              >
                {/* Favorite */}
                <button
                  onClick={() => handleToggleFavorite(preset.id)}
                  className="text-lg"
                  title={preset.favorite ? '取消收藏' : '收藏'}
                >
                  {preset.favorite ? '★' : '☆'}
                </button>

                {/* Preview */}
                <div
                  className="h-8 w-16 rounded border border-line flex-shrink-0"
                  style={{
                    backgroundColor: preset.style.backgroundColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      color: preset.style.color,
                      fontSize: '10px',
                      fontWeight: preset.style.bold ? 'bold' : 'normal',
                    }}
                  >
                    示例
                  </span>
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  {editingPresetId === preset.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleUpdateName(preset.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateName(preset.id);
                        if (e.key === 'Escape') setEditingPresetId(null);
                      }}
                      autoFocus
                      className="w-full rounded border border-[var(--color-accent)] bg-[var(--color-bg-primary)] px-1 py-0.5 text-xs"
                    />
                  ) : (
                    <div
                      className="truncate cursor-pointer"
                      onClick={() => {
                        setEditingPresetId(preset.id);
                        setEditName(preset.name);
                      }}
                      title="点击编辑名称"
                    >
                      {preset.name}
                    </div>
                  )}
                  {preset.tags && preset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {preset.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-panel px-1 text-[10px] text-[var(--color-text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleApplyPreset(preset)}
                    className="rounded bg-[var(--color-accent)] px-2 py-1 text-xs text-white hover:bg-[var(--color-accent)]/90"
                    data-testid={`apply-preset-${preset.id}`}
                  >
                    应用
                  </button>
                  <button
                    onClick={() => handleExportSingle(preset)}
                    className="rounded border border-line px-2 py-1 text-xs hover:bg-panel"
                    title="导出"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="rounded border border-line px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg bg-[var(--color-bg-primary)] p-4 shadow-xl">
            <h4 className="mb-3 text-sm font-semibold text-ink">保存样式预设</h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                  预设名称
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="输入预设名称..."
                  className="w-full rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                  标签（用逗号分隔）
                </label>
                <input
                  type="text"
                  value={saveTags}
                  onChange={(e) => setSaveTags(e.target.value)}
                  placeholder="例如：电影,字幕,白色"
                  className="w-full rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={!saveName.trim()}
                  className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
