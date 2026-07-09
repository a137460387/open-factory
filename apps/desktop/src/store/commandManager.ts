import { CommandManager, type ProjectAccessor, type TimelineAccessor } from '@open-factory/editor-core';
import { collaborationController } from '../collaboration/local-network';
import { useEditorStore } from './editorStore';

export const commandManager = new CommandManager();

type CommandExecuteListener = (command: unknown) => void;
const onExecuteListeners: CommandExecuteListener[] = [];

export function addOnExecuteListener(listener: CommandExecuteListener): () => void {
  onExecuteListeners.push(listener);
  return () => {
    const index = onExecuteListeners.indexOf(listener);
    if (index >= 0) onExecuteListeners.splice(index, 1);
  };
}

commandManager.setOnChange((historyMeta) => {
  useEditorStore.getState().setHistoryMeta(historyMeta);
});

commandManager.setOnExecute((command) => {
  void collaborationController.broadcastCommand(command);
  for (const listener of onExecuteListeners) {
    listener(command);
  }
});

export const timelineAccessor: TimelineAccessor = {
  getTimeline: () => useEditorStore.getState().project.timeline,
  setTimeline: (timeline) => useEditorStore.getState().replaceTimeline(timeline)
};

export const projectAccessor: ProjectAccessor = {
  getProject: () => useEditorStore.getState().project,
  setProject: (project) => useEditorStore.getState().replaceProject(project)
};
