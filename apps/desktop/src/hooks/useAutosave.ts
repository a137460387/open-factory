import { useEffect, useRef } from 'react';
import type { Project } from '@open-factory/editor-core';
import { DEFAULT_AUTOSAVE_INTERVAL_SECONDS, writeAutosaveProjectSafely } from '../lib/projectFiles';
import { useEditorStore } from '../store/editorStore';

export interface AutosaveTickInput {
  project: Project;
  projectPath?: string;
  dirty: boolean;
}

export async function runAutosaveTick({ project, projectPath, dirty }: AutosaveTickInput): Promise<string | undefined> {
  if (!dirty) {
    return undefined;
  }
  return writeAutosaveProjectSafely(project, projectPath);
}

export function useAutosave(intervalSeconds = DEFAULT_AUTOSAVE_INTERVAL_SECONDS): void {
  const project = useEditorStore((state) => state.project);
  const dirty = useEditorStore((state) => state.dirty);
  const projectPath = useEditorStore((state) => state.projectPath);
  const latest = useRef<AutosaveTickInput>({ project, projectPath, dirty });

  useEffect(() => {
    latest.current = { project, projectPath, dirty };
  }, [dirty, project, projectPath]);

  useEffect(() => {
    const intervalMs = Math.max(1, intervalSeconds) * 1000;
    const id = window.setInterval(() => {
      void runAutosaveTick(latest.current);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalSeconds]);
}
