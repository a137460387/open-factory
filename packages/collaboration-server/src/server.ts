/**
 * Socket.IO server for WebRTC signaling and real-time collaboration.
 * Handles peer connection setup, room events, cursor/edit broadcasts,
 * and a REST management API.
 */

import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { CollaborationConfig } from "./config.js";
import { createAuthMiddleware, createExpressAuthMiddleware, AuthError } from "./auth.js";
import { RoomManager, RoomError } from "./room-manager.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  TypedSocket,
  EditOperation,
  UserRole,
} from "./types.js";

// ============================================================
// Server Factory
// ============================================================

export interface CollaborationServerResult {
  /** The HTTP server instance */
  httpServer: ReturnType<typeof createServer>;
  /** The Socket.IO server instance */
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  /** The room manager instance */
  roomManager: RoomManager;
  /** Start listening on the configured port */
  start: () => Promise<void>;
  /** Gracefully shut down */
  stop: () => Promise<void>;
}

/**
 * Create and configure the collaboration server.
 */
export function createCollaborationServer(
  config: CollaborationConfig
): CollaborationServerResult {
  const app = express();
  const httpServer = createServer(app);
  const roomManager = new RoomManager(config);

  // ----------------------------------------------------------
  // Express Middleware
  // ----------------------------------------------------------

  app.use(
    cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials,
    })
  );
  app.use(express.json());

  // ----------------------------------------------------------
  // REST Management API
  // ----------------------------------------------------------

  // Public health endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // JWT-authenticated API routes
  const apiAuth = createExpressAuthMiddleware(config);

  app.get("/api/rooms", apiAuth, (_req, res) => {
    const rooms = roomManager.listRooms();
    res.json({ rooms });
  });

  app.get("/api/rooms/:roomId", apiAuth, (req, res) => {
    const room = roomManager.getRoom(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({ room });
  });

  app.delete("/api/rooms/:roomId", apiAuth, async (req, res) => {
    try {
      const userId = req.user!.userId;
      await roomManager.deleteRoom(req.params.roomId, userId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof RoomError) {
        res.status(err.code === "ROOM_NOT_FOUND" ? 404 : 403).json({
          error: err.message,
          code: err.code,
        });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/rooms/:roomId/users", apiAuth, (req, res) => {
    const room = roomManager.getRoom(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({ users: room.collaborators });
  });

  // ----------------------------------------------------------
  // Socket.IO Setup
  // ----------------------------------------------------------

  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: config.cors.origin,
        credentials: config.cors.credentials,
      },
      pingInterval: config.heartbeatIntervalMs,
      pingTimeout: config.heartbeatIntervalMs * 2,
      maxHttpBufferSize: 1e6, // 1 MB
    }
  );

  // Auth middleware
  const authMiddleware = createAuthMiddleware(config);
  io.use((socket, next) => {
    authMiddleware(socket, next);
  });

  // Rate limiting: max 100 events per minute per socket
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const RATE_LIMIT_MAX = 100;

  io.use((socket, next) => {
    let eventCount = 0;
    let windowStart = Date.now();

    const originalOnEvent = socket.onAny.bind(socket);
    socket.onAny((event, ...args) => {
      const now = Date.now();
      if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
        eventCount = 0;
        windowStart = now;
      }
      eventCount++;
      if (eventCount > RATE_LIMIT_MAX) {
        socket.emit("room:error", {
          message: "Rate limit exceeded. Please slow down.",
          code: "RATE_LIMIT_EXCEEDED",
        });
        return;
      }
      originalOnEvent(event, ...args);
    });

    next();
  });

  // Error handling for auth failures
  io.on("connection_error", (err) => {
    if (err.message.includes("auth") || err.message.includes("token")) {
      // Expected auth failures — log at warn level
      log(config, "warn", `Connection rejected: ${err.message}`);
    } else {
      log(config, "error", `Connection error: ${err.message}`);
    }
  });

  // ----------------------------------------------------------
  // Connection Handler
  // ----------------------------------------------------------

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as TypedSocket;
    const { userId, displayName } = socket.data;

    log(config, "info", `User connected: ${displayName} (${userId})`);

    // -- Room: Create --
    socket.on("room:create", async (data) => {
      try {
        const room = await roomManager.createRoom(
          data.roomId,
          userId,
          data.options
        );
        // Auto-join after creation
        const collaborator = await roomManager.addCollaborator(
          data.roomId,
          userId,
          displayName,
          socket.id,
          "owner"
        );

        socket.join(data.roomId);

        socket.emit("room:joined", {
          room: {
            roomId: room.roomId,
            state: room.state,
            ownerId: room.ownerId,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
            collaborators: [collaborator],
            options: room.options,
            metadata: room.metadata,
          },
          collaborators: [collaborator],
        });

        log(config, "info", `Room created: ${data.roomId} by ${displayName}`);
      } catch (err) {
        emitRoomError(socket, err);
      }
    });

    // -- Room: Join --
    socket.on("room:join", async (data) => {
      try {
        const room = roomManager.getRoom(data.roomId);
        if (!room) {
          socket.emit("room:error", {
            message: `Room ${data.roomId} not found`,
            code: "ROOM_NOT_FOUND",
          });
          return;
        }

        // Determine role: owner if room creator, otherwise editor
        const role: UserRole = room.ownerId === userId ? "owner" : "editor";

        const collaborator = await roomManager.addCollaborator(
          data.roomId,
          userId,
          displayName,
          socket.id,
          role
        );

        socket.join(data.roomId);

        // Notify the joining user
        socket.emit("room:joined", {
          room: {
            roomId: room.roomId,
            state: room.state,
            ownerId: room.ownerId,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
            collaborators: room.collaborators,
            options: room.options,
            metadata: room.metadata,
          },
          collaborators: room.collaborators,
        });

        // Notify others
        socket.to(data.roomId).emit("room:user-joined", {
          user: collaborator,
        });

        log(
          config,
          "info",
          `User ${displayName} joined room ${data.roomId} as ${role}`
        );
      } catch (err) {
        emitRoomError(socket, err);
      }
    });

    // -- Room: Leave --
    socket.on("room:leave", async (data) => {
      try {
        await roomManager.removeCollaborator(data.roomId, userId);
        socket.leave(data.roomId);
        socket.to(data.roomId).emit("room:user-left", { userId });
        log(config, "info", `User ${displayName} left room ${data.roomId}`);
      } catch (err) {
        emitRoomError(socket, err);
      }
    });

    // -- Room: Kick User --
    socket.on("room:kick-user", async (data) => {
      try {
        await roomManager.kickUser(data.roomId, userId, data.targetUserId);

        // Find the kicked user's socket and notify them
        const room = roomManager.getRoom(data.roomId);
        if (room) {
          const kickedCollab = room.collaborators.find(
            (c) => c.userId === data.targetUserId
          );
          if (kickedCollab) {
            io.to(kickedCollab.socketId).emit("room:kicked", {
              roomId: data.roomId,
              reason: "You have been removed from the room",
            });
          }
        }

        io.to(data.roomId).emit("room:user-left", {
          userId: data.targetUserId,
        });
      } catch (err) {
        emitRoomError(socket, err);
      }
    });

    // -- Room: Update Role --
    socket.on("room:update-role", async (data) => {
      try {
        await roomManager.updateUserRole(
          data.roomId,
          userId,
          data.targetUserId,
          data.role
        );
        io.to(data.roomId).emit("room:role-updated", {
          userId: data.targetUserId,
          role: data.role,
        });
      } catch (err) {
        emitRoomError(socket, err);
      }
    });

    // -- WebRTC Signaling: Offer --
    socket.on("signal:offer", (data) => {
      forwardSignal(io, socket, data.targetUserId, "signal:offer", {
        roomId: data.roomId,
        targetUserId: data.targetUserId,
        sdp: data.sdp,
        fromUserId: userId,
      });
    });

    // -- WebRTC Signaling: Answer --
    socket.on("signal:answer", (data) => {
      forwardSignal(io, socket, data.targetUserId, "signal:answer", {
        roomId: data.roomId,
        targetUserId: data.targetUserId,
        sdp: data.sdp,
        fromUserId: userId,
      });
    });

    // -- WebRTC Signaling: ICE Candidate --
    socket.on("signal:ice-candidate", (data) => {
      forwardSignal(io, socket, data.targetUserId, "signal:ice-candidate", {
        roomId: data.roomId,
        targetUserId: data.targetUserId,
        candidate: data.candidate,
        fromUserId: userId,
      });
    });

    // -- Cursor Move --
    socket.on("cursor:move", async (data) => {
      await roomManager.updateCursor(data.roomId, userId, data.cursor);
      socket.to(data.roomId).emit("cursor:update", {
        userId,
        cursor: data.cursor,
      });
    });

    // -- Edit Operation --
    socket.on("edit:operation", async (data) => {
      const serverTimestamp = Date.now();
      const operation: EditOperation = {
        ...data.operation,
        timestamp: serverTimestamp,
      };

      roomManager.addEditOperation(data.roomId, operation);

      // Acknowledge to the sender
      socket.emit("edit:ack", {
        operationId: operation.id,
        serverTimestamp,
      });

      // Broadcast to others in the room
      socket.to(data.roomId).emit("edit:broadcast", {
        userId,
        operation,
      });
    });

    // -- Disconnect --
    socket.on("disconnect", async (reason) => {
      log(
        config,
        "info",
        `User disconnected: ${displayName} (${userId}), reason: ${reason}`
      );

      // Find which room this socket was in and mark offline
      const found = roomManager.findCollaboratorBySocket(socket.id);
      if (found) {
        await roomManager.markOffline(found.room.roomId, userId);
        socket.to(found.room.roomId).emit("room:user-left", { userId });
      }
    });
  });

  // ----------------------------------------------------------
  // Start / Stop
  // ----------------------------------------------------------

  const start = async (): Promise<void> => {
    await roomManager.init();

    return new Promise((resolve) => {
      httpServer.listen(config.port, config.host, () => {
        log(
          config,
          "info",
          `Collaboration server listening on ${config.host}:${config.port}`
        );
        resolve();
      });
    });
  };

  const stop = async (): Promise<void> => {
    log(config, "info", "Shutting down collaboration server...");

    // Disconnect all sockets
    io.disconnectSockets(true);
    io.close();

    await roomManager.shutdown();

    return new Promise((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  return { httpServer, io, roomManager, start, stop };
}

// ============================================================
// Helpers
// ============================================================

function forwardSignal(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  senderSocket: TypedSocket,
  targetUserId: string,
  event: "signal:offer" | "signal:answer" | "signal:ice-candidate",
  data: Record<string, unknown>
): void {
  // Find the target user's socket ID from the room
  const roomData = senderSocket.data;
  const rooms = Array.from(senderSocket.rooms);

  for (const roomId of rooms) {
    if (roomId === senderSocket.id) continue; // skip default room
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets) continue;

    for (const socketId of roomSockets) {
      if (socketId === senderSocket.id) continue;
      const targetSocket = io.sockets.sockets.get(socketId) as TypedSocket | undefined;
      if (targetSocket && targetSocket.data.userId === targetUserId) {
        targetSocket.emit(event, data as never);
        return;
      }
    }
  }
}

function emitRoomError(socket: TypedSocket, err: unknown): void {
  if (err instanceof RoomError) {
    socket.emit("room:error", {
      message: err.message,
      code: err.code,
    });
  } else {
    socket.emit("room:error", {
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}

function log(
  config: CollaborationConfig,
  level: "debug" | "info" | "warn" | "error",
  message: string
): void {
  const levels = ["debug", "info", "warn", "error"];
  const configLevel = levels.indexOf(config.logLevel);
  const msgLevel = levels.indexOf(level);
  if (msgLevel >= configLevel) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    if (level === "error") {
      console.error(`${prefix} ${message}`);
    } else if (level === "warn") {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}
