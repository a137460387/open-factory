import React, {useState, useMemo} from 'react';
import {getWorkflowTemplateLibrary} from './workflow-templates';
import type {TemplateBrowserProps} from './node-editor-panel-types';

export const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
  onSelectTemplate,
  onClose,
}) => {
  const library = useMemo(() => getWorkflowTemplateLibrary(), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => library.getCategories(), [library]);
  const templates = useMemo(() => {
    let result = searchQuery ? library.searchTemplates(searchQuery) : library.getAllTemplates();
    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory);
    }
    return result;
  }, [library, searchQuery, selectedCategory]);

  return (
    <div className="template-browser">
      <div className="template-header">
        <h3>Workflow Templates</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="template-toolbar">
        <input
          type="text"
          className="template-search"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        <div className="template-categories">
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
      </div>

      <div className="template-list">
        {templates.map(template => (
          <div
            key={template.id}
            className="template-item"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="template-info">
              <h4 className="template-name">{template.name}</h4>
              <p className="template-desc">{template.description}</p>
              <div className="template-tags">
                {template.tags.map(tag => (
                  <span key={tag} className="template-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="template-meta">
              <span className="template-usage">{template.usageCount} uses</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
