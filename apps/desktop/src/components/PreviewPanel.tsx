import React from 'react';
import { useEditorStore, findMulticamClipInProject } from '../store/editorStore';
import { AngleSwitcherPanel } from './AngleSwitcher/AngleSwitcherPanel';

export const PreviewPanel: React.FC = () => {
  const {
    multicamEditMode,
    activeMulticamClipId,
    playheadTime,
    isPlaying,
    project,
    isMulticamSyncing,
    switchMulticamAngle,
    syncMulticamClip,
    addMulticamSwitchPoint,
    deleteMulticamSwitchPoint,
    updateMulticamSwitchPoint,
    detectMulticamDrift,
  } = useEditorStore();

  // Find the active multicam clip
  const activeMulticamClip = multicamEditMode && activeMulticamClipId
    ? findMulticamClipInProject(project, activeMulticamClipId)
    : null;

  return (
    <div className="preview-panel">
      {/* Existing preview content placeholder */}

      {/* Multicam angle switcher panel */}
      {activeMulticamClip && (
        <AngleSwitcherPanel
          multicamClip={activeMulticamClip}
          currentTime={playheadTime}
          isPlaying={isPlaying}
          onAngleSwitch={(angleIndex, _time) => switchMulticamAngle(angleIndex)}
          onSyncRequest={syncMulticamClip}
          onSwitchPointAdd={addMulticamSwitchPoint}
          onSwitchPointDelete={deleteMulticamSwitchPoint}
          onSwitchPointUpdate={updateMulticamSwitchPoint}
          onDriftDetection={detectMulticamDrift}
          isSyncing={isMulticamSyncing}
        />
      )}
    </div>
  );
};
