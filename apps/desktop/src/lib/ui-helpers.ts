import type { WorkspaceLayoutDefinition } from '../layout/layoutSettings';
import { AddMediaFolderCommand, MoveMediaToFolderCommand } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { commandManager, projectAccessor } from '../store/commandManager';

export function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

export function isEditableKeyboardEventTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}

export function joinLocalPath(baseDir: string, child: string): string {
  return `${baseDir.replace(/\\/g, '/').replace(/\/+$/g, '')}/${child}`;
}

export function getWorkspaceLayoutDisplayName(layout: WorkspaceLayoutDefinition): string {
  return layout.builtIn ? zhCN.toolbar.workspaceLayouts[layout.id as keyof typeof zhCN.toolbar.workspaceLayouts] ?? layout.name : layout.name;
}

export function moveAutomationMediaToGroup(assetId: string, groupName: string): void {
  const name = groupName.trim();
  if (!name) {
    return;
  }
  let folder = projectAccessor.getProject().mediaFolders.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!folder) {
    const command = new AddMediaFolderCommand(projectAccessor, { name });
    commandManager.execute(command);
    folder = command.folder;
  }
  if (folder) {
    commandManager.execute(new MoveMediaToFolderCommand(projectAccessor, [assetId], folder.id));
  }
}
