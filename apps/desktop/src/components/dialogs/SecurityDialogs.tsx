import { lazy, Suspense } from 'react';
import type { ProjectFileEncryptionOptions } from '../../lib/projectFiles';
import type { ProjectPasswordRequest } from './ProjectPasswordDialog';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorFeatureStore } from '../../store/editorFeatureStore';
import { PanelLoading } from '../PanelLoading';

const ProjectEncryptionSaveDialog = lazy(() =>
  import('./ProjectEncryptionSaveDialog').then((m) => ({ default: m.ProjectEncryptionSaveDialog }))
);
const ProjectPasswordDialog = lazy(() =>
  import('./ProjectPasswordDialog').then((m) => ({ default: m.ProjectPasswordDialog }))
);

export interface SecurityDialogsProps {
  confirmProjectEncryptionSave: (options: ProjectFileEncryptionOptions) => Promise<void>;
}

export function SecurityDialogs({
  confirmProjectEncryptionSave,
}: SecurityDialogsProps) {
  const projectEncryptionSaveOpen = useEditorUIStore((s) => s.projectEncryptionSaveOpen);
  const setProjectEncryptionSaveOpen = useEditorUIStore((s) => s.setProjectEncryptionSaveOpen);
  const projectPasswordRequest = useEditorFeatureStore((s) => s.projectPasswordRequest);
  const setProjectPasswordRequest = useEditorFeatureStore((s) => s.setProjectPasswordRequest);

  return (
    <Suspense fallback={<PanelLoading label="安全" />}>
      {projectEncryptionSaveOpen ? (
        <ProjectEncryptionSaveDialog
          onConfirm={(options) => void confirmProjectEncryptionSave(options)}
          onClose={() => setProjectEncryptionSaveOpen(false)}
        />
      ) : null}
      {projectPasswordRequest ? (
        <ProjectPasswordDialog
          request={projectPasswordRequest}
          onClose={() => {
            projectPasswordRequest.resolve(undefined);
            setProjectPasswordRequest(undefined);
          }}
          onConfirm={(password) => {
            projectPasswordRequest.resolve(password);
            setProjectPasswordRequest(undefined);
          }}
        />
      ) : null}
    </Suspense>
  );
}
