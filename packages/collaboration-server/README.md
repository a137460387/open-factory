# Collaboration Server

WebRTC signaling and relay server for Open Factory real-time collaboration.

## Features

- **WebRTC Signaling**: SDP offer/answer exchange, ICE candidate relay, TURN server support
- **Room Management**: Create/join/leave rooms with state machine (waiting/active/closed)
- **Collaborator Presence**: User list, cursor position broadcast, edit operation sync
- **Permission Control**: Three-tier roles — owner, editor, viewer
- **Redis Persistence**: Room state persistence, cross-instance synchronization via pub/sub
- **Management API**: REST endpoints for room and user management

## Quick Start

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `COLLAB_PORT` | `3001` | Server listen port |
| `COLLAB_HOST` | `0.0.0.0` | Server bind host |
| `NODE_ENV` | `development` | Node environment |
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `REDIS_KEY_PREFIX` | `collab:` | Redis key prefix |
| `REDIS_CLUSTER` | `false` | Enable Redis cluster mode |
| `REDIS_CLUSTER_NODES` | | Cluster nodes (host:port,comma-separated) |
| `JWT_SECRET` | **required** | JWT secret (min 32 chars) |
| `JWT_ISSUER` | `open-factory` | Expected token issuer |
| `JWT_AUDIENCE` | `collaboration-server` | Expected token audience |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `CORS_CREDENTIALS` | `true` | Allow CORS credentials |
| `MAX_ROOMS` | `1000` | Maximum concurrent rooms |
| `MAX_USERS_PER_ROOM` | `10` | Maximum users per room |
| `HEARTBEAT_INTERVAL_MS` | `30000` | Socket heartbeat interval (ms) |
| `ROOM_IDLE_TIMEOUT_MS` | `3600000` | Room idle timeout (ms, 0=never) |
| `TURN_URLS` | | TURN server URLs (comma-separated) |
| `TURN_USERNAME` | | TURN username |
| `TURN_CREDENTIAL` | | TURN credential |

### Local Development

```bash
# Install dependencies
bun install

# Start Redis (requires Docker)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Set JWT secret
export JWT_SECRET="your-secret-key-at-least-32-characters-long"

# Start in dev mode (with hot reload)
bun run dev
```

### Docker Compose

```bash
# Create .env file
echo 'JWT_SECRET=your-production-secret-key-at-least-32-chars' > .env

# Start all services
docker compose up -d

# View logs
docker compose logs -f collaboration-server
```

## REST API

### Health Check

```
GET /health
```

Response: `{ "status": "ok", "uptime": 123.456 }`

### List Rooms

```
GET /api/rooms
```

Response: `{ "rooms": [RoomSnapshot, ...] }`

### Get Room

```
GET /api/rooms/:roomId
```

Response: `{ "room": RoomSnapshot }`

### Delete Room

```
DELETE /api/rooms/:roomId
X-User-Id: <owner-user-id>
```

Response: `{ "success": true }`

### List Room Users

```
GET /api/rooms/:roomId/users
```

Response: `{ "users": [Collaborator, ...] }`

## Socket.IO Events

### Client to Server

| Event | Data | Description |
|---|---|---|
| `room:create` | `{ roomId, options? }` | Create a new room |
| `room:join` | `{ roomId }` | Join an existing room |
| `room:leave` | `{ roomId }` | Leave a room |
| `room:kick-user` | `{ roomId, targetUserId }` | Kick a user (owner/editor) |
| `room:update-role` | `{ roomId, targetUserId, role }` | Change user role (owner) |
| `signal:offer` | `{ roomId, targetUserId, sdp }` | Send WebRTC offer |
| `signal:answer` | `{ roomId, targetUserId, sdp }` | Send WebRTC answer |
| `signal:ice-candidate` | `{ roomId, targetUserId, candidate }` | Send ICE candidate |
| `cursor:move` | `{ roomId, cursor }` | Broadcast cursor position |
| `edit:operation` | `{ roomId, operation }` | Broadcast edit operation |

### Server to Client

| Event | Data | Description |
|---|---|---|
| `room:joined` | `{ room, collaborators }` | Successfully joined room |
| `room:user-joined` | `{ user }` | Another user joined |
| `room:user-left` | `{ userId }` | A user left |
| `room:state-changed` | `{ roomId, state }` | Room state transition |
| `room:error` | `{ message, code }` | Error occurred |
| `room:role-updated` | `{ userId, role }` | User role changed |
| `room:kicked` | `{ roomId, reason }` | You were kicked |
| `signal:offer` | `{ fromUserId, ... }` | WebRTC offer from peer |
| `signal:answer` | `{ fromUserId, ... }` | WebRTC answer from peer |
| `signal:ice-candidate` | `{ fromUserId, ... }` | ICE candidate from peer |
| `cursor:update` | `{ userId, cursor }` | Peer cursor moved |
| `edit:broadcast` | `{ userId, operation }` | Peer edit operation |
| `edit:ack` | `{ operationId, serverTimestamp }` | Edit acknowledged |

## Authentication

All Socket.IO connections require a JWT token. Pass it via:

```javascript
const socket = io("http://localhost:3001", {
  auth: { token: "your-jwt-token" },
});
```

Token payload must include:
- `sub`: User ID
- `name`: Display name

## Room State Machine

```
waiting ──→ active ──→ closed
   ↑          │
   └──────────┘  (all users leave, non-persistent)
```

- **waiting**: Room created, no active collaborators
- **active**: At least one collaborator connected
- **closed**: Room permanently shut down

## Permission Model

| Action | Owner | Editor | Viewer |
|---|---|---|---|
| Join room | Yes | Yes | Yes |
| Send signals | Yes | Yes | Yes |
| Move cursor | Yes | Yes | Yes |
| Send edits | Yes | Yes | No |
| Kick viewers | Yes | Yes | No |
| Kick editors | Yes | No | No |
| Change roles | Yes | No | No |
| Delete room | Yes | No | No |

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────┐
│  Client A   │────▶│  Collaboration Server │◀────│  Redis  │
│  (Socket.IO)│     │                      │     │  (State)│
└─────────────┘     │  ┌──────────────┐    │     └─────────┘
                    │  │  Room Manager │    │
┌─────────────┐     │  └──────────────┘    │     ┌─────────┐
│  Client B   │────▶│  ┌──────────────┐    │◀────│  Redis  │
│  (Socket.IO)│     │  │  Auth (JWT)  │    │     │  (PubSub)│
└─────────────┘     │  └──────────────┘    │     └─────────┘
                    │  ┌──────────────┐    │
                    │  │  REST API    │    │
                    │  └──────────────┘    │
                    └──────────────────────┘
```

## License

MIT
