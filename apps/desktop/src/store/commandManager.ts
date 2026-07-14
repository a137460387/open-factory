import { CommandManager, type Command, type ProjectAccessor, type TimelineAccessor } from '@open-factory/editor-core';
import { collaborationController } from '../collaboration/local-network';
import type { EditorState } from './editorStore';

// Use a getter to break circular dependency with editorStore
// editorStore imports commandManager, so we cannot statically import useEditorStore here
let _editorStoreGetter: (() => { getState: () => EditorState }) | undefined;

export function setEditorStoreGetter(getter: () => { getState: () => EditorState }) {
  _editorStoreGetter = getter;
}

function getEditorStore() {
  return _editorStoreGetter?.();
}

export const commandManager = new CommandManager();

type CommandExecuteListener = (command: Command) => void;
const onExecuteListeners: CommandExecuteListener[] = [];

export function addOnExecuteListener(listener: CommandExecuteListener): () => void {
  onExecuteListeners.push(listener);
  return () => {
    const index = onExecuteListeners.indexOf(listener);
    if (index >= 0) onExecuteListeners.splice(index, 1);
  };
}

commandManager.setOnChange((historyMeta) => {
  getEditorStore()?.getState().setHistoryMeta(historyMeta);
});

commandManager.setOnExecute((command) => {
  void collaborationController.broadcastCommand(command);
  for (const listener of onExecuteListeners) {
    listener(command);
  }
});

export const timelineAccessor: TimelineAccessor = {
  getTimeline: () => getEditorStore()!.getState().project.timeline,
  setTimeline: (timeline) => getEditorStore()!.getState().replaceTimeline(timeline)
};

export const projectAccessor: ProjectAccessor = {
  getProject: () => getEditorStore()!.getState().project,
  setProject: (project) => getEditorStore()!.getState().replaceProject(project)
};
