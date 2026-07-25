/**
 * Tests for RoomManager — room lifecycle, collaborator management,
 * edit operations, state transitions, and conflict resolution.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoomManager, RoomError } from "../room-manager.js";
import type { CollaborationConfig } from "../config.js";
import type { EditOperation, Collaborator } from "../types.js";

// ============================================================
// Test Config (no Redis)
// ============================================================

const testConfig: CollaborationConfig = {
  port: 3001,
  host: "0.0.0.0",
  nodeEnv: "test",
  logLevel: "error",
  redis: {
    url: "redis://localhost:6379",
    keyPrefix: "test:",
    maxRetriesPerRequest: 3,
    cluster: false,
    clusterNodes: [],
  },
  jwt: {
    secret: "test-secret-key-that-is-at-least-32-chars-long!!",
    issuer: "open-factory",
    audience: "collaboration-server",
  },
  turn: { urls: [], username: "", credential: "" },
  cors: { origin: [], credentials: true },
  maxRooms: 100,
  maxUsersPerRoom: 10,
  heartbeatIntervalMs: 30000,
  roomIdleTimeoutMs: 0, // disabled for tests
};

function makeEditOp(overrides: Partial<EditOperation> = {}): EditOperation {
  return {
    id: `op-${Math.random().toString(36).slice(2, 8)}`,
    userId: "user-1",
    type: "insert",
    target: "track-0",
    payload: { value: "test" },
    timestamp: Date.now(),
    ...overrides,
  };
}

// ============================================================
// Room Lifecycle
// ============================================================

describe("RoomManager — room lifecycle", () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager(testConfig);
  });

  it("creates a room with default options", async () => {
    const room = await manager.createRoom("room-1", "owner-1");
    expect(room.roomId).toBe("room-1");
    expect(room.ownerId).toBe("owner-1");
    expect(room.state).toBe("waiting");
    expect(room.collaborators).toEqual([]);
    expect(room.options.maxUsers).toBe(10);
    expect(room.options.persistent).toBe(false);
  });

  it("creates a room with custom options", async () => {
    const room = await manager.createRoom("room-2", "owner-1", {
      maxUsers: 5,
      persistent: true,
    });
    expect(room.options.maxUsers).toBe(5);
    expect(room.options.persistent).toBe(true);
  });

  it("throws ROOM_EXISTS when creating duplicate room", async () => {
    await manager.createRoom("room-1", "owner-1");
    await expect(manager.createRoom("room-1", "owner-2")).rejects.toThrow(
      expect.objectContaining({ code: "ROOM_EXISTS" })
    );
  });

  it("throws MAX_ROOMS_REACHED when limit exceeded", async () => {
    const smallConfig = { ...testConfig, maxRooms: 2 };
    const mgr = new RoomManager(smallConfig);
    await mgr.createRoom("r1", "o1");
    await mgr.createRoom("r2", "o1");
    await expect(mgr.createRoom("r3", "o1")).rejects.toThrow(
      expect.objectContaining({ code: "MAX_ROOMS_REACHED" })
    );
  });

  it("returns null for non-existent room", () => {
    expect(manager.getRoom("nope")).toBeNull();
  });

  it("lists only non-closed rooms", async () => {
    await manager.createRoom("r1", "o1");
    await manager.createRoom("r2", "o1");
    await manager.closeRoom("r1", "o1");
    const rooms = manager.listRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomId).toBe("r2");
  });

  it("closes a room and clears collaborators", async () => {
    await manager.createRoom("r1", "o1");
    await manager.addCollaborator("r1", "u1", "User 1", "sock-1");
    await manager.closeRoom("r1", "o1");
    const room = manager.getRoom("r1");
    expect(room!.state).toBe("closed");
    expect(room!.collaborators).toEqual([]);
  });

  it("throws INVALID_TRANSITION when closing already closed room", async () => {
    await manager.createRoom("r1", "o1");
    await manager.closeRoom("r1", "o1");
    await expect(manager.closeRoom("r1", "o1")).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_TRANSITION" })
    );
  });

  it("deletes a room (owner only)", async () => {
    await manager.createRoom("r1", "owner-1");
    await manager.deleteRoom("r1", "owner-1");
    expect(manager.getRoom("r1")).toBeNull();
  });

  it("throws NOT_OWNER when non-owner tries to delete", async () => {
    await manager.createRoom("r1", "owner-1");
    await expect(manager.deleteRoom("r1", "user-2")).rejects.toThrow(
      expect.objectContaining({ code: "NOT_OWNER" })
    );
  });
});

// ============================================================
// Collaborator Management
// ============================================================

describe("RoomManager — collaborator management", () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager(testConfig);
  });

  it("adds a collaborator and auto-transitions to active", async () => {
    await manager.createRoom("r1", "owner-1");
    const collab = await manager.addCollaborator(
      "r1",
      "user-1",
      "Alice",
      "sock-1"
    );
    expect(collab.userId).toBe("user-1");
    expect(collab.displayName).toBe("Alice");
    expect(collab.role).toBe("editor");
    expect(collab.isOnline).toBe(true);

    const room = manager.getRoom("r1");
    expect(room!.state).toBe("active");
  });

  it("reconnects existing user (updates socketId)", async () => {
    await manager.createRoom("r1", "owner-1");
    await manager.addCollaborator("r1", "user-1", "Alice", "sock-1");
    const reconnect = await manager.addCollaborator(
      "r1",
      "user-1",
      "Alice",
      "sock-2"
    );
    expect(reconnect.socketId).toBe("sock-2");
    const room = manager.getRoom("r1");
    expect(room!.collaborators).toHaveLength(1);
  });

  it("throws ROOM_FULL when capacity exceeded", async () => {
    await manager.createRoom("r1", "owner-1", { maxUsers: 2 });
    await manager.addCollaborator("r1", "u1", "A", "s1");
    await manager.addCollaborator("r1", "u2", "B", "s2");
    await expect(
      manager.addCollaborator("r1", "u3", "C", "s3")
    ).rejects.toThrow(expect.objectContaining({ code: "ROOM_FULL" }));
  });

  it("throws ROOM_CLOSED when adding to closed room", async () => {
    await manager.createRoom("r1", "owner-1");
    await manager.closeRoom("r1", "owner-1");
    await expect(
      manager.addCollaborator("r1", "u1", "A", "s1")
    ).rejects.toThrow(expect.objectContaining({ code: "ROOM_CLOSED" }));
  });

  it("removes a collaborator", async () => {
    await manager.createRoom("r1", "owner-1");
    await manager.addCollaborator("r1", "u1", "A", "s1");
    await manager.removeCollaborator("r1", "u1");
    const room = manager.getRoom("r1");
    expect(room!.collaborators).toHaveLength(0);
  });

  it("auto-transitions to waiting when last non-persistent user leaves", async () => {
    await manager.createRoom("r1", "owner-1");
    await manager.addCollaborator("r1", "u1", "A", "s1");
    expect(manager.getRoom("r1")!.state).toBe("active");
    await manager.removeCollaborator("r1", "u1");
    expect(manager.getRoom("r1")!.state).toBe("waiting");
  });

  it("stays active when persistent room becomes empty", async () => {
    await manager.createRoom("r1", "owner-1", { persistent: true });
    await manager.addCollaborator("r1", "u1", "A", "s1");
    await manager.removeCollaborator("r1", "u1");
    expect(manager.getRoom("r1")!.state).toBe("active");
  });

  it("marks user offline without removing", async () => {
    await manager.createRoom("r1", "owner-1");
    await manager.addCollaborator("r1", "u1", "A", "s1");
    await manager.markOffline("r1", "u1");
    const room = manager.getRoom("r1");
    const collab = room!.collaborators.find((c) => c.userId === "u1");
    expect(collab!.isOnline).toBe(false);
    expect(room!.collaborators).toHaveLength(1);
  });

  it("finds collaborator by socket ID", async () => {
    await manager.createRoom("r1", "owner-1");
    await manager.addCollaborator("r1", "u1", "Alice", "sock-42");
    const found = manager.findCollaboratorBySocket("sock-42");
    expect(found).not.toBeNull();
    expect(found!.collaborator.userId).toBe("u1");
    expect(found!.room.roomId).toBe("r1");
  });

  it("returns null for unknown socket ID", () => {
    expect(manager.findCollaboratorBySocket("unknown")).toBeNull();
  });
});

// ============================================================
// Kick & Role Management
// ============================================================

describe("RoomManager — kick and role management", () => {
  let manager: RoomManager;

  beforeEach(async () => {
    manager = new RoomManager(testConfig);
    await manager.createRoom("r1", "owner-1");
    await manager.addCollaborator("r1", "owner-1", "Owner", "s-owner", "owner");
    await manager.addCollaborator("r1", "editor-1", "Editor", "s-editor", "editor");
    await manager.addCollaborator("r1", "viewer-1", "Viewer", "s-viewer", "viewer");
  });

  it("owner can kick viewer", async () => {
    await manager.kickUser("r1", "owner-1", "viewer-1");
    const room = manager.getRoom("r1");
    expect(room!.collaborators.find((c) => c.userId === "viewer-1")).toBeUndefined();
  });

  it("owner can kick editor", async () => {
    await manager.kickUser("r1", "owner-1", "editor-1");
    const room = manager.getRoom("r1");
    expect(room!.collaborators.find((c) => c.userId === "editor-1")).toBeUndefined();
  });

  it("editor can kick viewer", async () => {
    await manager.kickUser("r1", "editor-1", "viewer-1");
    const room = manager.getRoom("r1");
    expect(room!.collaborators.find((c) => c.userId === "viewer-1")).toBeUndefined();
  });

  it("editor cannot kick other editor", async () => {
    await manager.addCollaborator("r1", "editor-2", "E2", "s-e2", "editor");
    await expect(manager.kickUser("r1", "editor-1", "editor-2")).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
  });

  it("viewer cannot kick anyone", async () => {
    await expect(manager.kickUser("r1", "viewer-1", "editor-1")).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
  });

  it("cannot kick the owner", async () => {
    await expect(manager.kickUser("r1", "editor-1", "owner-1")).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
  });

  it("throws USER_NOT_FOUND for non-existent target", async () => {
    await expect(manager.kickUser("r1", "owner-1", "ghost")).rejects.toThrow(
      expect.objectContaining({ code: "USER_NOT_FOUND" })
    );
  });

  it("owner can update user role", async () => {
    await manager.updateUserRole("r1", "owner-1", "viewer-1", "editor");
    const room = manager.getRoom("r1");
    const target = room!.collaborators.find((c) => c.userId === "viewer-1");
    expect(target!.role).toBe("editor");
  });

  it("non-owner cannot update role", async () => {
    await expect(
      manager.updateUserRole("r1", "editor-1", "viewer-1", "editor")
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_OWNER" }));
  });
});

// ============================================================
// Edit Operations & Conflict Resolution
// ============================================================

describe("RoomManager — edit operations", () => {
  let manager: RoomManager;

  beforeEach(async () => {
    manager = new RoomManager(testConfig);
    await manager.createRoom("r1", "owner-1");
    await manager.addCollaborator("r1", "u1", "A", "s1");
  });

  it("appends edit operation to history", () => {
    const op = makeEditOp({ id: "op-1", userId: "u1" });
    manager.addEditOperation("r1", op);
    const room = manager.getRoom("r1");
    expect(room!.editHistory).toHaveLength(1);
    expect(room!.editHistory[0].id).toBe("op-1");
  });

  it("ignores edit for non-existent room", () => {
    const op = makeEditOp();
    expect(() => manager.addEditOperation("ghost", op)).not.toThrow();
  });

  it("caps edit history at 10_000 entries", () => {
    for (let i = 0; i < 10_005; i++) {
      manager.addEditOperation("r1", makeEditOp({ id: `op-${i}` }));
    }
    const room = manager.getRoom("r1");
    // After 10_001st op triggers slice to last 5_000, then 4 more added = 5_004
    expect(room!.editHistory.length).toBeLessThanOrEqual(5_100);
  });

  it("preserves edit history across collaborator changes", async () => {
    manager.addEditOperation("r1", makeEditOp({ id: "op-1" }));
    await manager.addCollaborator("r1", "u2", "B", "s2");
    manager.addEditOperation("r1", makeEditOp({ id: "op-2" }));
    const room = manager.getRoom("r1");
    expect(room!.editHistory).toHaveLength(2);
  });

  it("concurrent edits from different users are appended in order", () => {
    manager.addEditOperation("r1", makeEditOp({ id: "op-1", userId: "u1" }));
    manager.addEditOperation("r1", makeEditOp({ id: "op-2", userId: "u2" }));
    manager.addEditOperation("r1", makeEditOp({ id: "op-3", userId: "u1" }));
    const room = manager.getRoom("r1");
    const ids = room!.editHistory.map((op) => op.id);
    expect(ids).toEqual(["op-1", "op-2", "op-3"]);
  });

  it("edit operations are serializable to JSON", () => {
    const op = makeEditOp({
      id: "op-1",
      type: "update",
      target: "clip-abc",
      payload: { startTime: 10, endTime: 20 },
    });
    manager.addEditOperation("r1", op);
    const room = manager.getRoom("r1");
    const json = JSON.stringify(room!.editHistory);
    const parsed = JSON.parse(json) as EditOperation[];
    expect(parsed[0].id).toBe("op-1");
    expect(parsed[0].type).toBe("update");
    expect(parsed[0].payload.startTime).toBe(10);
  });
});

// ============================================================
// Cursor Management
// ============================================================

describe("RoomManager — cursor management", () => {
  let manager: RoomManager;

  beforeEach(async () => {
    manager = new RoomManager(testConfig);
    await manager.createRoom("r1", "owner-1");
    await manager.addCollaborator("r1", "u1", "A", "s1");
  });

  it("updates cursor position", async () => {
    await manager.updateCursor("r1", "u1", {
      trackIndex: 2,
      timeOffset: 5.5,
      elementId: "clip-1",
    });
    const room = manager.getRoom("r1");
    const collab = room!.collaborators.find((c) => c.userId === "u1");
    expect(collab!.cursor).toEqual({
      trackIndex: 2,
      timeOffset: 5.5,
      elementId: "clip-1",
    });
  });

  it("clears cursor to null", async () => {
    await manager.updateCursor("r1", "u1", {
      trackIndex: 0,
      timeOffset: 0,
    });
    await manager.updateCursor("r1", "u1", null);
    const room = manager.getRoom("r1");
    const collab = room!.collaborators.find((c) => c.userId === "u1");
    expect(collab!.cursor).toBeNull();
  });
});

// ============================================================
// State Transitions
// ============================================================

describe("RoomManager — state transitions", () => {
  it("waiting -> active on first join", async () => {
    const manager = new RoomManager(testConfig);
    await manager.createRoom("r1", "o1");
    expect(manager.getRoom("r1")!.state).toBe("waiting");
    await manager.addCollaborator("r1", "u1", "A", "s1");
    expect(manager.getRoom("r1")!.state).toBe("active");
  });

  it("waiting -> closed directly", async () => {
    const manager = new RoomManager(testConfig);
    await manager.createRoom("r1", "o1");
    await manager.closeRoom("r1", "o1");
    expect(manager.getRoom("r1")!.state).toBe("closed");
  });

  it("active -> closed", async () => {
    const manager = new RoomManager(testConfig);
    await manager.createRoom("r1", "o1");
    await manager.addCollaborator("r1", "u1", "A", "s1");
    await manager.closeRoom("r1", "o1");
    expect(manager.getRoom("r1")!.state).toBe("closed");
  });

  it("active -> waiting when last user leaves (non-persistent)", async () => {
    const manager = new RoomManager(testConfig);
    await manager.createRoom("r1", "o1");
    await manager.addCollaborator("r1", "u1", "A", "s1");
    await manager.removeCollaborator("r1", "u1");
    expect(manager.getRoom("r1")!.state).toBe("waiting");
  });
});
