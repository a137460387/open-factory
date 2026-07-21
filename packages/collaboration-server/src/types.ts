/**
 * Type definitions for the collaboration server.
 * Covers WebRTC signaling, room management, and user roles.
 */

import type { Socket } from "socket.io";

// ============================================================
// Enums & Constants
// ============================================================

/** Room lifecycle states */
export const ROOM_STATES = ["waiting", "active", "closed"] as const;
export type RoomState = (typeof ROOM_STATES)[number];

/** User permission levels within a room */
export const USER_ROLES = ["owner", "editor", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ============================================================
// User & Presence
// ============================================================

/** Cursor position within the shared editing context */
export interface CursorPosition {
  /** Timeline track index */
  trackIndex: number;
  /** Time position in seconds */
  timeOffset: number;
  /** Selected element ID, if any */
  elementId?: string;
}

/** A connected collaborator */
export interface Collaborator {
  /** Unique user ID from auth token */
  userId: string;
  /** Display name */
  displayName: string;
  /** Socket.IO socket ID */
  socketId: string;
  /** Permission role in the room */
  role: UserRole;
  /** Current cursor position, null when not tracking */
  cursor: CursorPosition | null;
  /** When the user joined the room */
  joinedAt: number;
  /** Whether the user is actively connected */
  isOnline: boolean;
}

// ============================================================
// Room
// ============================================================

/** Room configuration set at creation time */
export interface RoomOptions {
  /** Maximum number of collaborators (default: 10) */
  maxUsers?: number;
  /** Whether the room persists after all users leave (default: false) */
  persistent?: boolean;
  /** TURN server configuration for NAT traversal */
  turnConfig?: TurnConfig;
}

/** TURN server credentials */
export interface TurnConfig {
  urls: string[];
  username: string;
  credential: string;
}

/** Serialized room state for Redis persistence */
export interface RoomSnapshot {
  roomId: string;
  state: RoomState;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  collaborators: Collaborator[];
  options: RoomOptions;
  /** Arbitrary project metadata shared across collaborators */
  metadata: Record<string, unknown>;
}

/** Full room object held in memory */
export interface Room extends RoomSnapshot {
  /** Edit history for conflict resolution */
  editHistory: EditOperation[];
}

// ============================================================
// WebRTC Signaling
// ============================================================

/** SDP offer from a peer */
export interface SignalOffer {
  roomId: string;
  targetUserId: string;
  sdp: RTCSessionDescriptionInit;
}

/** SDP answer from a peer */
export interface SignalAnswer {
  roomId: string;
  targetUserId: string;
  sdp: RTCSessionDescriptionInit;
}

/** ICE candidate exchange */
export interface SignalIceCandidate {
  roomId: string;
  targetUserId: string;
  candidate: RTCIceCandidateInit;
}

// ============================================================
// Edit Operations
// ============================================================

/** Types of collaborative edit operations */
export const EDIT_OP_TYPES = [
  "insert",
  "delete",
  "update",
  "move",
  "cursor",
] as const;
export type EditOpType = (typeof EDIT_OP_TYPES)[number];

/** A single edit operation in the shared document */
export interface EditOperation {
  /** Unique operation ID */
  id: string;
  /** User who performed the operation */
  userId: string;
  /** Type of edit */
  type: EditOpType;
  /** Target element or track */
  target: string;
  /** Operation payload (structure depends on type) */
  payload: Record<string, unknown>;
  /** Lamport timestamp for ordering */
  timestamp: number;
  /** Parent operation ID for causal ordering */
  parentId?: string;
}

// ============================================================
// Socket.IO Event Maps
// ============================================================

/** Events emitted by the client to the server */
export interface ClientToServerEvents {
  "room:join": (data: { roomId: string }) => void;
  "room:leave": (data: { roomId: string }) => void;
  "room:create": (data: { roomId: string; options?: RoomOptions }) => void;

  "signal:offer": (data: SignalOffer) => void;
  "signal:answer": (data: SignalAnswer) => void;
  "signal:ice-candidate": (data: SignalIceCandidate) => void;

  "cursor:move": (data: { roomId: string; cursor: CursorPosition }) => void;
  "edit:operation": (data: { roomId: string; operation: EditOperation }) => void;

  "room:kick-user": (data: { roomId: string; targetUserId: string }) => void;
  "room:update-role": (data: {
    roomId: string;
    targetUserId: string;
    role: UserRole;
  }) => void;
}

/** Events emitted by the server to the client */
export interface ServerToClientEvents {
  "room:joined": (data: {
    room: RoomSnapshot;
    collaborators: Collaborator[];
  }) => void;
  "room:user-joined": (data: { user: Collaborator }) => void;
  "room:user-left": (data: { userId: string }) => void;
  "room:state-changed": (data: { roomId: string; state: RoomState }) => void;
  "room:error": (data: { message: string; code: string }) => void;
  "room:role-updated": (data: { userId: string; role: UserRole }) => void;
  "room:kicked": (data: { roomId: string; reason: string }) => void;

  "signal:offer": (data: SignalOffer & { fromUserId: string }) => void;
  "signal:answer": (data: SignalAnswer & { fromUserId: string }) => void;
  "signal:ice-candidate": (data: SignalIceCandidate & { fromUserId: string }) => void;

  "cursor:update": (data: { userId: string; cursor: CursorPosition }) => void;
  "edit:broadcast": (data: { userId: string; operation: EditOperation }) => void;
  "edit:ack": (data: { operationId: string; serverTimestamp: number }) => void;
}

/** Inter-server events for Redis adapter */
export interface InterServerEvents {
  "room:sync": (data: { roomId: string; snapshot: RoomSnapshot }) => void;
}

/** Data attached to each socket */
export interface SocketData {
  userId: string;
  displayName: string;
  role?: UserRole;
}

// ============================================================
// Typed Socket Alias
// ============================================================

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
