import { readCollaborationIdentitySettings, type CollaborationIdentitySettings, type LocalCoeditingSettings } from '../settings/appSettings';
import { useEditorStore } from '../store/editorStore';
import { collaborationController } from './local-network';

export async function applyLocalCoeditingSettings(settings: LocalCoeditingSettings, identity?: CollaborationIdentitySettings): Promise<void> {
  if (!settings.enabled) {
    await collaborationController.disable();
    return;
  }
  const resolvedIdentity = identity ?? (await readCollaborationIdentitySettings());
  if (settings.mode === 'host') {
    await collaborationController.enableHost({
      port: settings.port,
      networkMode: settings.networkMode,
      authToken: settings.authToken,
    });
  } else {
    await collaborationController.enableClient({ permission: settings.permission });
  }
  collaborationController.updatePresence(useEditorStore.getState().playheadTime, resolvedIdentity.name, resolvedIdentity.color);
}
