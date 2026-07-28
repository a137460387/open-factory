import React, {useState, useMemo} from 'react';
import type {NodeCategory} from './node-editor-types';
import type {NodePaletteProps} from './node-editor-panel-types';

export const NodePalette: React.FC<NodePaletteProps> = ({ definitions, onAddNode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | null>(null);

  const categories: NodeCategory[] = ['input', 'ai-engine', 'transform', 'output', 'control', 'utility'];

  const filteredDefinitions = useMemo(() => {
    let result = definitions;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        d =>
          d.name.toLowerCase().includes(lowerQuery) ||
          d.description.toLowerCase().includes(lowerQuery),
      );
    }

    if (selectedCategory) {
      result = result.filter(d => d.category === selectedCategory);
    }

    return result;
  }, [definitions, searchQuery, selectedCategory]);

  return (
    <div className="node-palette">
      <div className="palette-header">
        <h3>Nodes</h3>
        <input
          type="text"
          className="palette-search"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="palette-categories">
        <button
          className={`category-btn ${selectedCategory === null ? 'active' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="palette-nodes">
        {filteredDefinitions.map(def => (
          <div
            key={def.type}
            className="palette-node-item"
            onClick={() => onAddNode(def.type)}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('nodeType', def.type);
            }}
          >
            <span className="palette-node-icon">{def.icon ?? '⚙️'}</span>
            <div className="palette-node-info">
              <span className="palette-node-name">{def.name}</span>
              <span className="palette-node-desc">{def.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
