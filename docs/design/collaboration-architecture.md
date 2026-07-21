# Collaboration Architecture Design

> Open Factory v4.53.0 - Sprint AC Technical Design

## Overview

End-to-end encrypted P2P collaboration for timeline-based video editing. Enables multiple creators to edit the same project simultaneously without a central server storing project data.

## Architecture

### Layer Stack

```
┌─────────────────────────────────────────────┐
│           UI Layer (React Components)        │
│  CollaboratorCursors, StatusPanel, Presence  │
├─────────────────────────────────────────────┤
│         Awareness Layer (Yjs)                │
│  Cursor positions, selections, user presence │
├─────────────────────────────────────────────┤
│         CRDT Layer (Yjs Shared Types)        │
│  SharedDoc → Y.Map(tracks, clips, trans)    │
├─────────────────────────────────────────────┤
│         Encryption Layer (Web Crypto API)    │
│  AES-GCM-256 for content, ECDH for key exch │
├─────────────────────────────────────────────┤
│         Transport Layer (WebRTC)             │
│  P2P data channels, ICE/STUN/TURN           │
├─────────────────────────────────────────────┤
│         Signaling Layer                      │
│  WebSocket signaling server (lightweight)    │
│  OR: reuse LLM channel for signaling        │
└─────────────────────────────────────────────┘
```

### 1. CRDT Layer (Yjs)

**Why Yjs:**
- Proven CRDT implementation with rich ecosystem
- Native support for text, maps, arrays
- Small bundle size (~12KB gzipped)
- Offline-first: changes merge automatically on reconnect

**Data Model Mapping:**

| Timeline Concept | Yjs Type | Rationale |
|---|---|---|
| Timeline | Y.Doc | Top-level container |
| Tracks | Y.Map<trackId, Y.Map<props>> | Keyed access, property-level merge |
| Clips | Y.Map<clipId, Y.Map<props>> | Concurrent clip edits merge |
| Transitions | Y.Map<transId, Y.Map<props>> | Independent merge per transition |
| Clip Order | Y.Array<clipId> | Ordered sequence with insert/delete |
| Text Content | Y.Text | Rich collaborative text editing |
| Awareness | Yjs Awareness | Ephemeral cursor/selection state |

**Merge Semantics:**
- Scalar properties: Last-Writer-Wins (LWW) with vector clocks
- Ordered arrays: YATA algorithm (Yjs's CRDT for sequences)
- Maps: key-level merge (concurrent writes to different keys both win)
- Conflicts on same property: resolved by Lamport timestamp

### 2. Encryption Layer (Web Crypto API)

**Key Exchange (ECDH):**
```
Host generates ECDH key pair → shares public key via signaling
Peer generates ECDH key pair → shares public key via signaling
Both derive shared AES-GCM-256 key from ECDH exchange
```

**Message Encryption:**
```
Plaintext (CRDT update) → AES-GCM-256(key, nonce, plaintext) → Ciphertext
Nonce: 12-byte random per message (prepended to ciphertext)
Auth tag: 16-byte GCM tag (appended to ciphertext)
```

**Key Rotation:**
- Session key derived per collaboration session
- Key rotation on peer join/leave
- Forward secrecy via ephemeral ECDH keys

### 3. Transport Layer (WebRTC)

**Connection Model:**
- Mesh topology for ≤4 participants
- Each peer maintains direct data channel to every other peer
- No server-side project data storage

**Data Channels:**
| Channel | Priority | Content |
|---|---|---|
| `crdt-sync` | High | CRDT document updates |
| `awareness` | Medium | Cursor positions, presence |
| `signaling` | Low | Connection management |

**ICE Configuration:**
```typescript
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // TURN server for NAT traversal (production)
  ],
  iceCandidatePoolSize: 10,
};
```

### 4. Signaling Layer

**Option A: Dedicated WebSocket Signaling Server**
- Lightweight (< 100 lines)
- Only exchanges SDP offers/answers and ICE candidates
- No project data stored on server
- Can be self-hosted

**Option B: Reuse LLM Channel**
- Embed signaling messages in existing LLM communication channel
- Pro: No additional infrastructure
- Con: Higher latency, coupling with LLM service

**Recommendation:** Option A for production, Option B for prototype.

**Signaling Protocol:**
```typescript
interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  from: string;
  to: string; // 'broadcast' or specific peer ID
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | JoinPayload;
}

interface JoinPayload {
  projectId: string;
  displayName: string;
  publicKey: JsonWebKey; // ECDH public key for encryption
}
```

### 5. Awareness Layer

**Ephemeral State (not persisted):**
- Cursor timecode position
- Active track/clip selection
- User display name and color
- Online/offline status

**Update Frequency:**
- Cursor: 10 Hz (100ms throttle)
- Selection: on change
- Presence: heartbeat every 5s, timeout 15s

## Data Flow

```
User Edit → Local Y.Doc update → Encrypt → WebRTC DataChannel → Peer
                                                                       ↓
                                                    Decrypt → Apply to Remote Y.Doc → UI Update
```

## Security Considerations

1. **No server-side project data** - All editing data stays on peers
2. **E2E encryption** - Signaling server cannot read CRDT payloads
3. **Forward secrecy** - Ephemeral keys per session
4. **Authentication** - Invitation links with pre-shared tokens
5. **Rate limiting** - Prevent CRDT spam attacks

## Scalability Limits

| Participants | Topology | Max Concurrent Edits |
|---|---|---|
| 2 | Direct P2P | Unlimited |
| 3-4 | Full mesh | ~50/s per peer |
| 5-8 | Selective mesh | ~20/s per peer |
| 9+ | SFU required | Not supported in v1 |

## Implementation Phases

### Phase 1 (Sprint AC - Current)
- [x] CRDT data model design
- [x] CrdtDocumentManager prototype
- [ ] Basic WebRTC connection (2 peers)
- [ ] Awareness state sync

### Phase 2 (Sprint AD)
- [ ] ECDH key exchange
- [ ] AES-GCM encryption layer
- [ ] Signaling server (WebSocket)
- [ ] Invitation link system

### Phase 3 (Sprint AE)
- [ ] Offline support with sync
- [ ] Conflict resolution UI
- [ ] Permission model (view/edit/admin)
- [ ] Performance optimization for large timelines

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| yjs | ^13.6 | CRDT framework |
| y-webrtc | ^10.3 | WebRTC provider for Yjs |
| y-protocols | ^1.0 | Awareness protocol |

## Open Questions

1. Should we support server-side persistence for async collaboration?
2. How to handle media file sharing between peers?
3. Maximum timeline complexity for acceptable sync latency?
