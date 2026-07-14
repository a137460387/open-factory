import { CommandManager, type Command, type ProjectAccessor, type TimelineAccessor } from '@open-factory/editor-core';
import { collaborationController } from '../collaboration/local-network';
import type { EditorState } from './editorStore';

// Use a getter to break circular dependency with editorStore
// editorStore imports commandManager, so we cannot statically import useEditorStore here
let _editorStoreGetter: (() => { getState: () => EditorState }) | undefined;

/**
 * 设置 editorStore 的 getter 函数，用于打破与 editorStore 的循环依赖。
 * @param getter - 返回 editorStore 实例的函数
 */
export function setEditorStoreGetter(getter: () => { getState: () => EditorState }) {
  _editorStoreGetter = getter;
}

function getEditorStore() {
  return _editorStoreGetter?.();
}

/** 全局命令管理器实例 */
export const commandManager = new CommandManager();

/** 命令执行监听器类型 */
type CommandExecuteListener = (command: Command) => void;
const onExecuteListeners: CommandExecuteListener[] = [];

/**
 * 注册命令执行监听器。
 * 当命令被执行时，监听器会被调用。
 * @param listener - 命令执行回调函数
 * @returns 取消注册的函数
 */
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
  setTimeline: (timeline) => getEditorStore()!.getState().replaceTimeline(timeline),
};

export const projectAccessor: ProjectAccessor = {
  getProject: () => getEditorStore()!.getState().project,
  setProject: (project) => getEditorStore()!.getState().replaceProject(project),
};
