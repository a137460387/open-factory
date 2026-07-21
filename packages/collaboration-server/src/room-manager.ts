/**
 * Room management with state machine, Redis persistence, and cross-instance sync.
 * Handles room lifecycle: waiting -> active -> closed.
 */

import Redis from "ioredis";
import type { CollaborationConfig } from "./config.js";
import type {
  Collaborator,
  EditOperation,
  Room,
  RoomOptions,
  RoomSnapshot,
  RoomState,
  UserRole,
} from "./types.js";

// ============================================================
// Constants
// ============================================================

const STATE_TRANSITIONS: Record<RoomState, RoomState[]> = {
  waiting: ["active", "closed"],
  active: ["closed"],
  closed: [],
};

// ============================================================
// Errors
// ============================================================

export class RoomError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly roomId?: string
  ) {
    super(message);
    this.name = "RoomError";
  }
}

// ============================================================
// RoomManager
// ============================================================

export class RoomManager {
  private rooms = new Map<string, Room>();
  private redis: Redis | null = null;
  private redisSub: Redis | null = null;
  private config: CollaborationConfig;
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(config: CollaborationConfig) {
    this.config = config;
  }

  // ----------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------

  /** Initialize Redis connections if configured */
  async init(): Promise<void> {
    if (this.config.redis.cluster && this.config.redis.clusterNodes.length > 0) {
      this.redis = new Redis.Cluster(this.config.redis.clusterNodes, {
        redisOptions: {
          keyPrefix: this.config.redis.keyPrefix,
          maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
        },
      });
    } else {
      this.redis = new Redis(this.config.redis.url, {
        keyPrefix: this.config.redis.keyPrefix,
        maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
      });
    }

    // Dedicated connection for pub/sub (cannot use keyPrefix with cluster subscribe)
    this.redisSub = new Redis(this.config.redis.url, {
      maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
    });

    await this.redisSub.subscribe("collab:room:sync");
    this.redisSub.on("message", (channel, message) => {
      if (channel === "collab:room:sync") {
        this.handleRemoteSync(message);
      }
    });

    // Restore rooms from Redis on startup
    await this.restoreRooms();
  }

  /** Shut down and clean up resources */
  async shutdown(): Promise<void> {
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();

    if (this.redisSub) {
      await this.redisSub.unsubscribe("collab:room:sync");
      this.redisSub.disconnect();
    }
    if (this.redis) {
      this.redis.disconnect();
    }
    this.rooms.clear();
  }

  // ----------------------------------------------------------
  // Room CRUD
  // ----------------------------------------------------------

  /** Create a new room. Throws if the room already exists. */
  async createRoom(
    roomId: string,
    ownerId: string,
    options: RoomOptions = {}
  ): Promise<Room> {
    if (this.rooms.has(roomId)) {
      throw new RoomError(
        `Room ${roomId} already exists`,
        "ROOM_EXISTS",
        roomId
      );
    }

    if (this.rooms.size >= this.config.maxRooms) {
      throw new RoomError(
        "Maximum number of rooms reached",
        "MAX_ROOMS_REACHED"
      );
    }

    const now = Date.now();
    const room: Room = {
      roomId,
      state: "waiting",
      ownerId,
      createdAt: now,
      updatedAt: now,
      collaborators: [],
      options: {
        maxUsers: options.maxUsers ?? this.config.maxUsersPerRoom,
        persistent: options.persistent ?? false,
        turnConfig: options.turnConfig ?? this.buildTurnConfig(),
      },
      metadata: {},
      editHistory: [],
    };

    this.rooms.set(roomId, room);
    await this.persistRoom(room);
    this.resetIdleTimer(roomId);

    return room;
  }

  /** Get a room by ID. Returns null if not found. */
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  /** Get a snapshot of all active rooms (lightweight). */
  listRooms(): RoomSnapshot[] {
    return Array.from(this.rooms.values()).filter(
      (r) => r.state !== "closed"
    );
  }

  /** Close a room and remove all collaborators. */
  async closeRoom(roomId: string, closedBy: string): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    this.assertTransition(room.state, "closed");

    room.state = "closed";
    room.updatedAt = Date.now();
    room.collaborators = [];

    await this.persistRoom(room);
    this.clearIdleTimer(roomId);
    await this.broadcastSync(room);
  }

  /** Delete a room entirely (owner only). */
  async deleteRoom(roomId: string, userId: string): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    if (room.ownerId !== userId) {
      throw new RoomError(
        "Only the room owner can delete the room",
        "NOT_OWNER",
        roomId
      );
    }

    this.rooms.delete(roomId);
    this.clearIdleTimer(roomId);
    if (this.redis) {
      await this.redis.del(`room:${roomId}`);
      await this.redis.srem("rooms:active", roomId);
    }
  }

  // ----------------------------------------------------------
  // Collaborator Management
  // ----------------------------------------------------------

  /** Add a user to a room. Returns the Collaborator object. */
  async addCollaborator(
    roomId: string,
    userId: string,
    displayName: string,
    socketId: string,
    role: UserRole = "editor"
  ): Promise<Collaborator> {
    const room = this.getRoomOrThrow(roomId);

    if (room.state === "closed") {
      throw new RoomError(
        `Room ${roomId} is closed`,
        "ROOM_CLOSED",
        roomId
      );
    }

    // Check if user is already in the room (reconnect scenario)
    const existing = room.collaborators.find((c) => c.userId === userId);
    if (existing) {
      existing.socketId = socketId;
      existing.isOnline = true;
      existing.joinedAt = Date.now();
      await this.persistRoom(room);
      return existing;
    }

    // Check capacity
    const activeCount = room.collaborators.filter((c) => c.isOnline).length;
    const maxUsers = room.options.maxUsers ?? this.config.maxUsersPerRoom;
    if (activeCount >= maxUsers) {
      throw new RoomError(
        `Room ${roomId} is full (${activeCount}/${maxUsers})`,
        "ROOM_FULL",
        roomId
      );
    }

    const collaborator: Collaborator = {
      userId,
      displayName,
      socketId,
      role,
      cursor: null,
      joinedAt: Date.now(),
      isOnline: true,
    };

    room.collaborators.push(collaborator);
    room.updatedAt = Date.now();

    // Auto-transition to active on first join
    if (room.state === "waiting" && room.collaborators.length > 0) {
      room.state = "active";
    }

    await this.persistRoom(room);
    this.clearIdleTimer(roomId);

    return collaborator;
  }

  /** Remove a user from a room. */
  async removeCollaborator(
    roomId: string,
    userId: string
  ): Promise<void> {
    const room = this.getRoomOrThrow(roomId);

    room.collaborators = room.collaborators.filter(
      (c) => c.userId !== userId
    );
    room.updatedAt = Date.now();

    // Auto-close when empty and not persistent
    if (
      room.collaborators.length === 0 &&
      !room.options.persistent &&
      room.state === "active"
    ) {
      room.state = "waiting";
      this.resetIdleTimer(roomId);
    }

    await this.persistRoom(room);
  }

  /** Mark a user as offline (socket disconnect) without removing them. */
  async markOffline(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const collab = room.collaborators.find((c) => c.userId === userId);
    if (collab) {
      collab.isOnline = false;
      room.updatedAt = Date.now();
      await this.persistRoom(room);
    }
  }

  /** Kick a user from a room (owner/editor only). */
  async kickUser(
    roomId: string,
    requesterId: string,
    targetUserId: string
  ): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    const requester = room.collaborators.find(
      (c) => c.userId === requesterId
    );

    if (!requester || (requester.role !== "owner" && requester.role !== "editor")) {
      throw new RoomError(
        "Insufficient permissions to kick users",
        "FORBIDDEN",
        roomId
      );
    }

    const target = room.collaborators.find(
      (c) => c.userId === targetUserId
    );
    if (!target) {
      throw new RoomError(
        "Target user not found in room",
        "USER_NOT_FOUND",
        roomId
      );
    }

    // Cannot kick the owner
    if (target.role === "owner") {
      throw new RoomError("Cannot kick the room owner", "FORBIDDEN", roomId);
    }

    // Editors can only kick viewers
    if (requester.role === "editor" && target.role !== "viewer") {
      throw new RoomError(
        "Editors can only kick viewers",
        "FORBIDDEN",
        roomId
      );
    }

    await this.removeCollaborator(roomId, targetUserId);
  }

  /** Update a user's role (owner only). */
  async updateUserRole(
    roomId: string,
    requesterId: string,
    targetUserId: string,
    newRole: UserRole
  ): Promise<void> {
    const room = this.getRoomOrThrow(roomId);

    if (room.ownerId !== requesterId) {
      throw new RoomError(
        "Only the owner can change roles",
        "NOT_OWNER",
        roomId
      );
    }

    const target = room.collaborators.find(
      (c) => c.userId === targetUserId
    );
    if (!target) {
      throw new RoomError(
        "Target user not found in room",
        "USER_NOT_FOUND",
        roomId
      );
    }

    target.role = newRole;
    room.updatedAt = Date.now();
    await this.persistRoom(room);
  }

  // ----------------------------------------------------------
  // Cursor & Edit Operations
  // ----------------------------------------------------------

  /** Update a user's cursor position. */
  async updateCursor(
    roomId: string,
    userId: string,
    cursor: Collaborator["cursor"]
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const collab = room.collaborators.find((c) => c.userId === userId);
    if (collab) {
      collab.cursor = cursor;
    }
  }

  /** Record an edit operation and append to history. */
  addEditOperation(
    roomId: string,
    operation: EditOperation
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.editHistory.push(operation);
    room.updatedAt = Date.now();

    // Cap history to prevent unbounded growth
    if (room.editHistory.length > 10_000) {
      room.editHistory = room.editHistory.slice(-5_000);
    }
  }

  /** Get the collaborator object by socket ID. */
  findCollaboratorBySocket(
    socketId: string
  ): { room: Room; collaborator: Collaborator } | null {
    for (const room of this.rooms.values()) {
      const collab = room.collaborators.find(
        (c) => c.socketId === socketId
      );
      if (collab) return { room, collaborator: collab };
    }
    return null;
  }

  // ----------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------

  private async persistRoom(room: Room): Promise<void> {
    if (!this.redis) return;

    const snapshot = this.toSnapshot(room);
    const key = `room:${room.roomId}`;
    await this.redis.set(key, JSON.stringify(snapshot));

    if (room.state !== "closed") {
      await this.redis.sadd("rooms:active", room.roomId);
    } else {
      await this.redis.srem("rooms:active", room.roomId);
    }
  }

  private async restoreRooms(): Promise<void> {
    if (!this.redis) return;

    const roomIds = await this.redis.smembers("rooms:active");
    for (const roomId of roomIds) {
      const raw = await this.redis.get(`room:${roomId}`);
      if (raw) {
        try {
          const snapshot = JSON.parse(raw) as RoomSnapshot;
          const room: Room = {
            ...snapshot,
            editHistory: [],
          };
          // Mark all users as offline after restart
          for (const c of room.collaborators) {
            c.isOnline = false;
          }
          this.rooms.set(roomId, room);
        } catch {
          // Skip malformed entries
        }
      }
    }
  }

  private async broadcastSync(room: Room): Promise<void> {
    if (!this.redis) return;
    const snapshot = this.toSnapshot(room);
    await this.redis.publish(
      "collab:room:sync",
      JSON.stringify({ roomId: room.roomId, snapshot })
    );
  }

  private handleRemoteSync(message: string): void {
    try {
      const { roomId, snapshot } = JSON.parse(message) as {
        roomId: string;
        snapshot: RoomSnapshot;
      };
      const existing = this.rooms.get(roomId);
      if (existing) {
        // Update state from remote, keep local edit history
        existing.state = snapshot.state;
        existing.collaborators = snapshot.collaborators;
        existing.updatedAt = snapshot.updatedAt;
        existing.metadata = snapshot.metadata;
      } else if (snapshot.state !== "closed") {
        this.rooms.set(roomId, { ...snapshot, editHistory: [] });
      }
    } catch {
      // Ignore malformed sync messages
    }
  }

  // ----------------------------------------------------------
  // Idle Timer
  // ----------------------------------------------------------

  private resetIdleTimer(roomId: string): void {
    this.clearIdleTimer(roomId);
    if (this.config.roomIdleTimeoutMs <= 0) return;

    const timer = setTimeout(async () => {
      const room = this.rooms.get(roomId);
      if (room && room.collaborators.length === 0 && !room.options.persistent) {
        room.state = "closed";
        room.updatedAt = Date.now();
        await this.persistRoom(room);
        this.rooms.delete(roomId);
      }
    }, this.config.roomIdleTimeoutMs);

    this.idleTimers.set(roomId, timer);
  }

  private clearIdleTimer(roomId: string): void {
    const timer = this.idleTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(roomId);
    }
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private getRoomOrThrow(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new RoomError(`Room ${roomId} not found`, "ROOM_NOT_FOUND", roomId);
    }
    return room;
  }

  private assertTransition(from: RoomState, to: RoomState): void {
    if (!STATE_TRANSITIONS[from].includes(to)) {
      throw new RoomError(
        `Invalid state transition: ${from} -> ${to}`,
        "INVALID_TRANSITION"
      );
    }
  }

  private buildTurnConfig(): CollaborationConfig["turn"] {
    return {
      urls: this.config.turn.urls,
      username: this.config.turn.username,
      credential: this.config.turn.credential,
    };
  }

  private toSnapshot(room: Room): RoomSnapshot {
    return {
      roomId: room.roomId,
      state: room.state,
      ownerId: room.ownerId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      collaborators: room.collaborators,
      options: room.options,
      metadata: room.metadata,
    };
  }
}
