import React from 'react';
import type {ExecutionPanelProps} from './node-editor-panel-types';

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  progress,
  onExecute,
  onAbort,
}) => {
  if (!progress) {
    return (
      <div className="execution-panel">
        <button className="execute-btn" onClick={onExecute}>
          ▶ Execute Workflow
        </button>
      </div>
    );
  }

  const percentage =
    progress.totalNodes > 0
      ? Math.round((progress.completedNodes / progress.totalNodes) * 100)
      : 0;

  return (
    <div className="execution-panel">
      <div className="execution-header">
        <span className="execution-status">{progress.status}</span>
        {progress.status === 'running' && (
          <button className="abort-btn" onClick={onAbort}>
            Abort
          </button>
        )}
      </div>

      <div className="execution-progress">
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${percentage}%` }} />
        </div>
        <div className="progress-info">
          <span>{progress.completedNodes} / {progress.totalNodes} nodes</span>
          <span>{percentage}%</span>
        </div>
      </div>

      {progress.currentNodeId && (
        <div className="current-node">
          Processing: {progress.currentNodeId}
        </div>
      )}
    </div>
  );
};
