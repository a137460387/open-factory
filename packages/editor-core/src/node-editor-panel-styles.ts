export const nodeEditorStyles = `
  .node-editor-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1a1a1a;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #333;
  }

  .editor-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .editor-header-actions {
    display: flex;
    gap: 8px;
  }

  .editor-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .editor-btn.primary {
    background: #0066ff;
    color: white;
  }

  .editor-btn.primary:hover {
    background: #0052cc;
  }

  .editor-btn.secondary {
    background: #333;
    color: #e0e0e0;
  }

  .editor-btn.secondary:hover {
    background: #444;
  }

  .editor-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .node-palette {
    width: 250px;
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
  }

  .palette-header {
    padding: 12px;
    border-bottom: 1px solid #333;
  }

  .palette-header h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .palette-search {
    width: 100%;
    padding: 6px 10px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 12px;
  }

  .palette-categories {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid #333;
  }

  .category-btn {
    padding: 4px 8px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 12px;
    color: #999;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .category-btn:hover {
    background: #333;
    color: #e0e0e0;
  }

  .category-btn.active {
    background: #0066ff;
    border-color: #0066ff;
    color: white;
  }

  .palette-nodes {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .palette-node-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .palette-node-item:hover {
    background: #2a2a2a;
  }

  .palette-node-icon {
    font-size: 20px;
  }

  .palette-node-info {
    display: flex;
    flex-direction: column;
  }

  .palette-node-name {
    font-size: 12px;
    font-weight: 500;
  }

  .palette-node-desc {
    font-size: 10px;
    color: #666;
  }

  .editor-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #222;
    background-image: radial-gradient(circle, #333 1px, transparent 1px);
    background-size: 20px 20px;
  }

  .connections-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .nodes-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .node-component {
    position: absolute;
    width: 200px;
    background: #2a2a2a;
    border: 2px solid #666;
    border-radius: 8px;
    cursor: move;
    user-select: none;
    transition: border-color 0.2s;
  }

  .node-component.selected {
    border-color: #0066ff;
    box-shadow: 0 0 10px rgba(0, 102, 255, 0.3);
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px 6px 0 0;
    color: white;
  }

  .node-icon {
    font-size: 16px;
  }

  .node-title {
    font-size: 12px;
    font-weight: 600;
  }

  .node-body {
    padding: 8px;
  }

  .node-ports {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .node-port {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .input-port {
    justify-content: flex-start;
  }

  .output-port {
    justify-content: flex-end;
  }

  .port-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #666;
  }

  .port-dot.input-dot {
    background: #4CAF50;
  }

  .port-dot.output-dot {
    background: #2196F3;
  }

  .port-label {
    color: #999;
  }

  .node-disabled-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #999;
    border-radius: 6px;
  }

  .connection-line {
    pointer-events: stroke;
  }

  .empty-canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #666;
  }

  .empty-canvas p {
    margin: 0;
    font-size: 14px;
  }

  .editor-sidebar {
    width: 250px;
    border-left: 1px solid #333;
    padding: 12px;
    overflow-y: auto;
  }

  .execution-panel {
    margin-bottom: 16px;
  }

  .execute-btn {
    width: 100%;
    padding: 10px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .execute-btn:hover {
    background: #45a049;
  }

  .abort-btn {
    padding: 6px 12px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .execution-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .execution-status {
    font-size: 12px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .execution-progress {
    margin-bottom: 8px;
  }

  .progress-bar-container {
    height: 6px;
    background: #333;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 4px;
  }

  .progress-bar {
    height: 100%;
    background: #4CAF50;
    transition: width 0.3s ease;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #999;
  }

  .current-node {
    font-size: 11px;
    color: #666;
  }

  .validation-errors,
  .validation-warnings {
    margin-top: 16px;
  }

  .validation-errors h4,
  .validation-warnings h4 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
  }

  .validation-errors h4 {
    color: #dc3545;
  }

  .validation-warnings h4 {
    color: #ffc107;
  }

  .validation-error,
  .validation-warning {
    padding: 6px 8px;
    margin-bottom: 4px;
    font-size: 11px;
    border-radius: 4px;
  }

  .validation-error {
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
  }

  .validation-warning {
    background: rgba(255, 193, 7, 0.1);
    color: #ffc107;
  }

  .template-browser {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #1a1a1a;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .template-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #333;
  }

  .template-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: #999;
    font-size: 24px;
    cursor: pointer;
  }

  .template-toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid #333;
  }

  .template-search {
    width: 100%;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .template-categories {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .template-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .template-item {
    display: flex;
    justify-content: space-between;
    padding: 16px;
    background: #2a2a2a;
    border: 1px solid #333;
    border-radius: 8px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .template-item:hover {
    border-color: #555;
  }

  .template-info {
    flex: 1;
  }

  .template-name {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 500;
  }

  .template-desc {
    margin: 0 0 8px;
    font-size: 12px;
    color: #999;
  }

  .template-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .template-tag {
    padding: 2px 6px;
    background: #333;
    border-radius: 10px;
    font-size: 10px;
    color: #666;
  }

  .template-meta {
    display: flex;
    align-items: center;
  }

  .template-usage {
    font-size: 11px;
    color: #666;
  }
`;
