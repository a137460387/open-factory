/**
 * Main entry point for the collaboration server package.
 * Re-exports all public APIs for use as a library.
 */

// Configuration
export { loadConfig, configSchema } from "./config.js";
export type { CollaborationConfig } from "./config.js";

// Authentication
export { createAuthMiddleware, verifyToken, generateTestToken, AuthError } from "./auth.js";
export type { TokenPayload } from "./auth.js";

// Room Management
export { RoomManager, RoomError } from "./room-manager.js";

// Server
export { createCollaborationServer } from "./server.js";
export type { CollaborationServerResult } from "./server.js";

// Types
export {
  ROOM_STATES,
  USER_ROLES,
  EDIT_OP_TYPES,
} from "./types.js";
export type {
  RoomState,
  UserRole,
  CursorPosition,
  Collaborator,
  RoomOptions,
  TurnConfig,
  RoomSnapshot,
  Room,
  SignalOffer,
  SignalAnswer,
  SignalIceCandidate,
  EditOpType,
  EditOperation,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  TypedSocket,
} from "./types.js";
