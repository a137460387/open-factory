import type {
  CollaborationClipLock,
  CollaborationOperation,
  CollaborationPermission,
  CollaborationRole,
  CollaborationUserPresence,
} from '@open-factory/editor-core';
import { create } from 'zustand';

export interface CollaborationUiState {
  enabled: boolean;
  role: CollaborationRole;
  permission: CollaborationPermission;
  userId: string;
  /** 会话 ID：host 创建会话时生成，仅内存态，随会话关闭清空。 */
  sessionId?: string;
  /** 会话锁定者 userId：由远端 session-lock 消息设置；仅面板展示，不拦截编辑命令广播。 */
  sessionLockedBy?: string;
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
  sessionId: undefined as string | undefined,
  sessionLockedBy: undefined as string | undefined,
  users: [] as CollaborationUserPresence[],
  locks: [] as CollaborationClipLock[],
  operations: [] as CollaborationOperation[],
  lastSyncAt: undefined as number | undefined,
};

export const useCollaborationStore = create<CollaborationUiState>((set) => ({
  ...DEFAULT_COLLABORATION_UI_STATE,
  setControllerState: (state) =>
    set({
      ...state,
      users: [...state.users],
      locks: [...state.locks],
      operations: [...state.operations],
    }),
  reset: () => set({ ...DEFAULT_COLLABORATION_UI_STATE, users: [], locks: [], operations: [] }),
}));
