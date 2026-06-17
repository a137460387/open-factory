import { CommandManager, type ProjectAccessor, type TimelineAccessor } from '@open-factory/editor-core';
import { collaborationController } from '../collaboration/local-network';
import { useEditorStore } from './editorStore';

export const commandManager = new CommandManager();

commandManager.setOnChange((historyMeta) => {
  useEditorStore.getState().setHistoryMeta(historyMeta);
});

commandManager.setOnExecute((command) => {
  void collaborationController.broadcastCommand(command);
});

export const timelineAccessor: TimelineAccessor = {
  getTimeline: () => useEditorStore.getState().project.timeline,
  setTimeline: (timeline) => useEditorStore.getState().replaceTimeline(timeline)
};

export const projectAccessor: ProjectAccessor = {
  getProject: () => useEditorStore.getState().project,
  setProject: (project) => useEditorStore.getState().replaceProject(project)
};
