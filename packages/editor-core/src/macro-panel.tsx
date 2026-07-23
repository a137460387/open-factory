/**
 * Macro Management Panel - UI component for managing macros
 *
 * Provides a React component for browsing, editing, deleting,
 * and organizing macros. Supports import/export functionality.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type {
  MacroDefinition,
  MacroCategory,
  MacroExecutionProgress,
} from './macro-types';
import { MacroStorage, getMacroStorage } from './macro-storage';
import { MacroPlaybackEngine, createMacroPlaybackEngine } from './macro-playback';

// ─── Types ─────────────────────────────────────────────────────────────────

interface MacroPanelProps {
  onExecute?: (macro: MacroDefinition) => void;
  onClose?: () => void;
}

interface MacroCardProps {
  macro: MacroDefinition;
  onExecute: (macro: MacroDefinition) => void;
  onEdit: (macro: MacroDefinition) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
}

interface MacroEditorProps {
  macro: MacroDefinition;
  onSave: (macro: MacroDefinition) => void;
  onCancel: () => void;
}

// ─── Macro Card Component ──────────────────────────────────────────────────

const MacroCard: React.FC<MacroCardProps> = ({
  macro,
  onExecute,
  onEdit,
  onDelete,
  onExport,
}) => {
  const operationCount = macro.operations.length;
  const durationSeconds = (macro.duration / 1000).toFixed(1);

  return (
    <div className="macro-card">
      <div className="macro-card-header">
        <h3 className="macro-card-title">{macro.name}</h3>
        <div className="macro-card-actions">
          <button
            className="macro-btn macro-btn-primary"
            onClick={() => onExecute(macro)}
            title="Execute macro"
          >
            ▶
          </button>
          <button
            className="macro-btn macro-btn-secondary"
            onClick={() => onEdit(macro)}
            title="Edit macro"
          >
            ✎
          </button>
          <button
            className="macro-btn macro-btn-secondary"
            onClick={() => onExport(macro.id)}
            title="Export macro"
          >
            ↗
          </button>
          <button
            className="macro-btn macro-btn-danger"
            onClick={() => onDelete(macro.id)}
            title="Delete macro"
          >
            ✕
          </button>
        </div>
      </div>

      <p className="macro-card-description">{macro.description}</p>

      <div className="macro-card-meta">
        <span className="macro-meta-item">
          <span className="macro-meta-label">Operations:</span>
          <span className="macro-meta-value">{operationCount}</span>
        </span>
        <span className="macro-meta-item">
          <span className="macro-meta-label">Duration:</span>
          <span className="macro-meta-value">{durationSeconds}s</span>
        </span>
        <span className="macro-meta-item">
          <span className="macro-meta-label">Executions:</span>
          <span className="macro-meta-value">{macro.executionCount}</span>
        </span>
      </div>

      {macro.tags.length > 0 && (
        <div className="macro-card-tags">
          {macro.tags.map(tag => (
            <span key={tag} className="macro-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {macro.parameters.length > 0 && (
        <div className="macro-card-params">
          <span className="macro-params-label">Parameters:</span>
          <span className="macro-params-count">{macro.parameters.length}</span>
        </div>
      )}
    </div>
  );
};

// ─── Macro Editor Component ────────────────────────────────────────────────

const MacroEditor: React.FC<MacroEditorProps> = ({ macro, onSave, onCancel }) => {
  const [name, setName] = useState(macro.name);
  const [description, setDescription] = useState(macro.description);
  const [tags, setTags] = useState(macro.tags.join(', '));

  const handleSave = useCallback(() => {
    onSave({
      ...macro,
      name,
      description,
      tags: tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
    });
  }, [macro, name, description, tags, onSave]);

  return (
    <div className="macro-editor">
      <h3 className="macro-editor-title">Edit Macro</h3>

      <div className="macro-editor-field">
        <label className="macro-label">Name</label>
        <input
          type="text"
          className="macro-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Macro name"
        />
      </div>

      <div className="macro-editor-field">
        <label className="macro-label">Description</label>
        <textarea
          className="macro-textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe what this macro does"
          rows={3}
        />
      </div>

      <div className="macro-editor-field">
        <label className="macro-label">Tags</label>
        <input
          type="text"
          className="macro-input"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="color, grading, cinematic (comma-separated)"
        />
      </div>

      <div className="macro-editor-field">
        <label className="macro-label">Operations ({macro.operations.length})</label>
        <div className="macro-operations-list">
          {macro.operations.slice(0, 10).map((op, i) => (
            <div key={op.id} className="macro-operation-item">
              <span className="macro-op-index">{i + 1}</span>
              <span className="macro-op-type">{op.type}</span>
              <span className="macro-op-target">{op.targetId}</span>
            </div>
          ))}
          {macro.operations.length > 10 && (
            <div className="macro-operation-item macro-op-more">
              ... and {macro.operations.length - 10} more operations
            </div>
          )}
        </div>
      </div>

      <div className="macro-editor-actions">
        <button className="macro-btn macro-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="macro-btn macro-btn-primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

// ─── Progress Display Component ────────────────────────────────────────────

interface ProgressDisplayProps {
  progress: MacroExecutionProgress;
  onCancel: () => void;
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({ progress, onCancel }) => {
  const percentage =
    progress.totalOperations > 0
      ? Math.round((progress.currentOperationIndex / progress.totalOperations) * 100)
      : 0;

  const estimatedSeconds = progress.estimatedTimeRemaining
    ? Math.ceil(progress.estimatedTimeRemaining / 1000)
    : null;

  return (
    <div className="macro-progress">
      <div className="macro-progress-header">
        <span className="macro-progress-title">
          {progress.status === 'running' ? 'Executing Macro...' : progress.status}
        </span>
        <button className="macro-btn macro-btn-danger" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="macro-progress-bar-container">
        <div className="macro-progress-bar" style={{ width: `${percentage}%` }} />
      </div>

      <div className="macro-progress-info">
        <span>
          Step {progress.currentOperationIndex + 1} of {progress.totalOperations}
        </span>
        <span>{percentage}%</span>
        {estimatedSeconds !== null && <span>~{estimatedSeconds}s remaining</span>}
      </div>

      {progress.currentOperationType && (
        <div className="macro-progress-operation">
          Current: {progress.currentOperationType}
        </div>
      )}

      {progress.error && <div className="macro-progress-error">Error: {progress.error}</div>}
    </div>
  );
};

// ─── Main Macro Panel Component ────────────────────────────────────────────

export const MacroPanel: React.FC<MacroPanelProps> = ({ onExecute, onClose }) => {
  const [storage] = useState(() => getMacroStorage());
  const [macros, setMacros] = useState(() => storage.getAllMacros());
  const [selectedMacro, setSelectedMacro] = useState<MacroDefinition | null>(null);
  const [editingMacro, setEditingMacro] = useState<MacroDefinition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [progress, setProgress] = useState<MacroExecutionProgress | null>(null);
  const [engine] = useState(() => createMacroPlaybackEngine());

  const categories = useMemo(() => storage.getCategories(), [storage]);

  const filteredMacros = useMemo(() => {
    let result = searchQuery ? storage.searchMacros(searchQuery) : macros;

    if (selectedCategory) {
      const categoryMacros = storage.getMacrosByCategory(selectedCategory);
      const categoryIds = new Set(categoryMacros.map(m => m.id));
      result = result.filter(m => categoryIds.has(m.id));
    }

    return result;
  }, [macros, searchQuery, selectedCategory, storage]);

  const handleExecute = useCallback(
    (macro: MacroDefinition) => {
      if (onExecute) {
        onExecute(macro);
      } else {
        // Default execution with progress tracking
        engine.onProgress(setProgress);
        engine.execute(macro).then(() => {
          storage.incrementExecutionCount(macro.id);
          setMacros(storage.getAllMacros());
          setProgress(null);
        });
      }
    },
    [engine, onExecute, storage],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm('Are you sure you want to delete this macro?')) {
        storage.deleteMacro(id);
        setMacros(storage.getAllMacros());
        if (selectedMacro?.id === id) {
          setSelectedMacro(null);
        }
      }
    },
    [storage, selectedMacro],
  );

  const handleExport = useCallback(
    (id: string) => {
      const json = storage.exportMacro(id);
      if (json) {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `macro-${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [storage],
  );

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          const json = ev.target?.result as string;
          const imported = storage.importMacro(json);
          if (imported) {
            setMacros(storage.getAllMacros());
            alert('Macro imported successfully!');
          } else {
            alert('Failed to import macro. Invalid format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [storage]);

  const handleSaveEdit = useCallback(
    (macro: MacroDefinition) => {
      storage.updateMacroMetadata(macro.id, {
        name: macro.name,
        description: macro.description,
        tags: macro.tags,
      });
      setMacros(storage.getAllMacros());
      setEditingMacro(null);
    },
    [storage],
  );

  return (
    <div className="macro-panel">
      <div className="macro-panel-header">
        <h2 className="macro-panel-title">Macro Manager</h2>
        <div className="macro-panel-header-actions">
          <button className="macro-btn macro-btn-secondary" onClick={handleImport}>
            Import
          </button>
          {onClose && (
            <button className="macro-btn macro-btn-secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      {progress && (
        <ProgressDisplay progress={progress} onCancel={() => engine.abort()} />
      )}

      {editingMacro ? (
        <MacroEditor
          macro={editingMacro}
          onSave={handleSaveEdit}
          onCancel={() => setEditingMacro(null)}
        />
      ) : (
        <>
          <div className="macro-panel-toolbar">
            <input
              type="text"
              className="macro-search-input"
              placeholder="Search macros..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />

            <div className="macro-categories">
              <button
                className={`macro-category-btn ${selectedCategory === null ? 'active' : ''}`}
                onClick={() => setSelectedCategory(null)}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`macro-category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="macro-panel-content">
            {filteredMacros.length === 0 ? (
              <div className="macro-empty-state">
                <p>No macros found</p>
                <p className="macro-empty-hint">
                  {searchQuery
                    ? 'Try a different search query'
                    : 'Record a macro to get started'}
                </p>
              </div>
            ) : (
              <div className="macro-grid">
                {filteredMacros.map(macro => (
                  <MacroCard
                    key={macro.id}
                    macro={macro}
                    onExecute={handleExecute}
                    onEdit={setEditingMacro}
                    onDelete={handleDelete}
                    onExport={handleExport}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

export const macroPanelStyles = `
  .macro-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1a1a1a;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .macro-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #333;
  }

  .macro-panel-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .macro-panel-header-actions {
    display: flex;
    gap: 8px;
  }

  .macro-panel-toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid #333;
  }

  .macro-search-input {
    width: 100%;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .macro-search-input:focus {
    outline: none;
    border-color: #666;
  }

  .macro-categories {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .macro-category-btn {
    padding: 6px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 16px;
    color: #999;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .macro-category-btn:hover {
    background: #333;
    color: #e0e0e0;
  }

  .macro-category-btn.active {
    background: #0066ff;
    border-color: #0066ff;
    color: white;
  }

  .macro-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .macro-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .macro-card {
    background: #2a2a2a;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 16px;
    transition: border-color 0.2s;
  }

  .macro-card:hover {
    border-color: #555;
  }

  .macro-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .macro-card-title {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    color: #fff;
  }

  .macro-card-actions {
    display: flex;
    gap: 4px;
  }

  .macro-card-description {
    margin: 0 0 12px;
    font-size: 13px;
    color: #999;
    line-height: 1.4;
  }

  .macro-card-meta {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
  }

  .macro-meta-item {
    display: flex;
    gap: 4px;
    font-size: 12px;
  }

  .macro-meta-label {
    color: #666;
  }

  .macro-meta-value {
    color: #e0e0e0;
  }

  .macro-card-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .macro-tag {
    padding: 2px 8px;
    background: #333;
    border-radius: 12px;
    font-size: 11px;
    color: #999;
  }

  .macro-card-params {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
    font-size: 12px;
  }

  .macro-params-label {
    color: #666;
  }

  .macro-params-count {
    padding: 2px 8px;
    background: #0066ff;
    border-radius: 12px;
    font-size: 11px;
    color: white;
  }

  .macro-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .macro-btn-primary {
    background: #0066ff;
    color: white;
  }

  .macro-btn-primary:hover {
    background: #0052cc;
  }

  .macro-btn-secondary {
    background: #333;
    color: #e0e0e0;
  }

  .macro-btn-secondary:hover {
    background: #444;
  }

  .macro-btn-danger {
    background: #dc3545;
    color: white;
  }

  .macro-btn-danger:hover {
    background: #c82333;
  }

  .macro-empty-state {
    text-align: center;
    padding: 48px 16px;
  }

  .macro-empty-state p {
    margin: 0 0 8px;
    font-size: 16px;
    color: #999;
  }

  .macro-empty-hint {
    font-size: 13px;
    color: #666;
  }

  .macro-editor {
    padding: 16px;
  }

  .macro-editor-title {
    margin: 0 0 16px;
    font-size: 18px;
    font-weight: 600;
  }

  .macro-editor-field {
    margin-bottom: 16px;
  }

  .macro-label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    color: #999;
  }

  .macro-input {
    width: 100%;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 14px;
  }

  .macro-textarea {
    width: 100%;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 14px;
    resize: vertical;
  }

  .macro-operations-list {
    background: #222;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .macro-operation-item {
    display: flex;
    gap: 12px;
    padding: 6px 8px;
    font-size: 12px;
    border-bottom: 1px solid #2a2a2a;
  }

  .macro-operation-item:last-child {
    border-bottom: none;
  }

  .macro-op-index {
    color: #666;
    min-width: 24px;
  }

  .macro-op-type {
    color: #0066ff;
    font-family: monospace;
  }

  .macro-op-target {
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .macro-op-more {
    color: #666;
    font-style: italic;
  }

  .macro-editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
  }

  .macro-progress {
    margin: 16px;
    padding: 16px;
    background: #2a2a2a;
    border: 1px solid #333;
    border-radius: 8px;
  }

  .macro-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .macro-progress-title {
    font-size: 14px;
    font-weight: 500;
  }

  .macro-progress-bar-container {
    height: 8px;
    background: #333;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .macro-progress-bar {
    height: 100%;
    background: #0066ff;
    transition: width 0.3s ease;
  }

  .macro-progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #999;
  }

  .macro-progress-operation {
    margin-top: 8px;
    font-size: 12px;
    color: #666;
  }

  .macro-progress-error {
    margin-top: 8px;
    font-size: 12px;
    color: #dc3545;
  }
`;

export default MacroPanel;
