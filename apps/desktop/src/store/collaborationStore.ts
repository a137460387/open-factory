import type {
  CollaborationClipLock,
  CollaborationOperation,
  CollaborationPermission,
  CollaborationRole,
  CollaborationUserPresence
} from '@open-factory/editor-core';
import { create } from 'zustand';

export interface CollaborationUiState {
  enabled: boolean;
  role: CollaborationRole;
  permission: CollaborationPermission;
  userId: string;
  users: CollaborationUserPresence[];
  locks: CollaborationClipLock[];
  operations: CollaborationOperation[];
  lastSyncAt?: number;
  setControllerState: (state: Omit<CollaborationUiState, 'setControllerState' | 'reset'>) => void;
  reset: () => void;
}

const DEFAULT_COLLABORATION_UI_STATE = {
  enabled: false,
  role: 'host' as CollaborationRole,
  permission: 'edit' as CollaborationPermission,
  userId: 'local-user',
  users: [] as CollaborationUserPresence[],
  locks: [] as CollaborationClipLock[],
  operations: [] as CollaborationOperation[],
  lastSyncAt: undefined as number | undefined
};

export const useCollaborationStore = create<CollaborationUiState>((set) => ({
  ...DEFAULT_COLLABORATION_UI_STATE,
  setControllerState: (state) =>
    set({
      ...state,
      users: [...state.users],
      locks: [...state.locks],
      operations: [...state.operations]
    }),
  reset: () => set({ ...DEFAULT_COLLABORATION_UI_STATE, users: [], locks: [], operations: [] })
}));
