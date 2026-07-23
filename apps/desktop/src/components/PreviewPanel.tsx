import React from 'react';
import { useEditorStore, findMulticamClipInProject } from '../store/editorStore';
import { AngleSwitcherPanel } from './AngleSwitcher/AngleSwitcherPanel';

export const PreviewPanel: React.FC = () => {
  const multicamEditMode = useEditorStore((s) => s.multicamEditMode);
  const activeMulticamClipId = useEditorStore((s) => s.activeMulticamClipId);
  const playheadTime = useEditorStore((s) => s.playheadTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const project = useEditorStore((s) => s.project);
  const isMulticamSyncing = useEditorStore((s) => s.isMulticamSyncing);
  const switchMulticamAngle = useEditorStore((s) => s.switchMulticamAngle);
  const syncMulticamClip = useEditorStore((s) => s.syncMulticamClip);
  const addMulticamSwitchPoint = useEditorStore((s) => s.addMulticamSwitchPoint);
  const deleteMulticamSwitchPoint = useEditorStore((s) => s.deleteMulticamSwitchPoint);
  const updateMulticamSwitchPoint = useEditorStore((s) => s.updateMulticamSwitchPoint);
  const detectMulticamDrift = useEditorStore((s) => s.detectMulticamDrift);

  // Find the active multicam clip
  const activeMulticamClip =
    multicamEditMode && activeMulticamClipId ? findMulticamClipInProject(project, activeMulticamClipId) : null;

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
