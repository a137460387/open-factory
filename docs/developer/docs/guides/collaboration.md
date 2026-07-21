---
sidebar_position: 2
---

# 协作服务部署指南

本指南介绍如何部署和配置 Open Factory 协作服务器，实现多人实时协作编辑。

:::info 开发中
协作服务器 (`packages/collaboration-server`) 正在积极开发中。以下文档描述了预期的架构和配置。
:::

## 概述

Open Factory 协作服务器基于 WebSocket 提供实时多人协作能力：

- **实时同步** — 多用户同时编辑同一项目
- **冲突解决** — 基于 CRDT 的自动冲突合并
- **权限管理** — 细粒度的访问控制
- **操作历史** — 完整的编辑历史记录
- **在线状态** — 实时显示协作者状态

## 架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client A   │     │  Client B   │     │  Client C   │
│  (Editor)   │     │  (Editor)   │     │  (Editor)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │ WebSocket         │ WebSocket         │ WebSocket
       └───────────┬───────┴───────────────────┘
                   │
            ┌──────┴──────┐
            │ Collaboration│
            │   Server     │
            └──────┬──────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
  │  Redis  │ │ Database│ │  S3/OSS │
  │ (Cache) │ │(Persist)│ │ (Media) │
  └─────────┘ └─────────┘ └─────────┘
```

## 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18.0 | 运行时 |
| Redis | >= 7.0 | 会话缓存与消息队列 |
| PostgreSQL | >= 15.0 | 持久化存储 |
| Nginx | >= 1.24 | 反向代理（可选） |

## 快速开始

### 使用 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  collaboration-server:
    build: ./packages/collaboration-server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:pass@postgres:5432/openfactory
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=openfactory
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  redis-data:
  postgres-data:
```

启动服务：

```bash
docker-compose up -d
```

### 手动部署

```bash
# 进入协作服务器目录
cd packages/collaboration-server

# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 构建
bun run build

# 启动
bun run start
```

## 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3001 |
| `NODE_ENV` | 运行环境 | development |
| `REDIS_URL` | Redis 连接地址 | redis://localhost:6379 |
| `DATABASE_URL` | PostgreSQL 连接地址 | - |
| `JWT_SECRET` | JWT 签名密钥 | - |
| `MAX_ROOM_SIZE` | 每个房间最大人数 | 10 |
| `SYNC_INTERVAL` | 同步间隔（毫秒） | 100 |
| `HISTORY_TTL` | 操作历史保留时间（秒） | 86400 |
| `MEDIA_STORAGE` | 媒体存储类型 (local/s3/oss) | local |
| `MEDIA_BUCKET` | 媒体存储桶名 | - |

### 配置文件

```json
{
  "server": {
    "port": 3001,
    "cors": {
      "origins": ["http://localhost:3000", "https://app.open-factory.dev"],
      "credentials": true
    },
    "rateLimit": {
      "windowMs": 60000,
      "max": 100
    }
  },
  "collaboration": {
    "maxRoomSize": 10,
    "syncIntervalMs": 100,
    "conflictResolution": "crdt",
    "operationBufferSize": 1000
  },
  "auth": {
    "jwtSecret": "${JWT_SECRET}",
    "tokenExpiry": "24h",
    "refreshTokenExpiry": "7d"
  },
  "storage": {
    "type": "postgresql",
    "pool": {
      "min": 2,
      "max": 10
    }
  }
}
```

## 客户端集成

### 连接协作服务器

```typescript
import { CollaborationClient } from '@open-factory/sdk';

const client = new CollaborationClient({
  serverUrl: 'wss://collab.open-factory.dev',
  token: userToken,
});

// 连接到项目
const session = await client.joinSession('project-123');

// 监听连接状态
session.onConnectionChange((status) => {
  console.log('Connection:', status);
  // 'connected' | 'reconnecting' | 'disconnected'
});
```

### 实时协作

```typescript
// 监听远程变更
session.onChange((change) => {
  console.log(`${change.userName} modified ${change.target}`);

  // 更新本地 UI
  switch (change.type) {
    case 'clip-update':
      updateClipInTimeline(change.clipId, change.updates);
      break;
    case 'clip-add':
      addClipToTimeline(change.clip);
      break;
    case 'clip-remove':
      removeClipFromTimeline(change.clipId);
      break;
  }
});

// 发送本地变更
function onLocalClipUpdate(clipId: string, updates: Partial<Clip>) {
  session.sendChange({
    type: 'clip-update',
    clipId,
    updates,
  });
}
```

### 在线状态

```typescript
// 获取当前在线用户
const users = session.getOnlineUsers();
// [{ id: 'user-1', name: 'Alice', color: '#ff0000', cursor: { x: 100, y: 200 } }]

// 监听用户状态变化
session.onUserJoin((user) => {
  console.log(`${user.name} joined the session`);
});

session.onUserLeave((user) => {
  console.log(`${user.name} left the session`);
});

// 发送光标位置
session.sendCursorPosition({ x: mouseX, y: mouseY });
```

## 权限管理

### 角色定义

```typescript
type CollaborationRole = 'owner' | 'editor' | 'viewer' | 'commenter';

interface CollaborationPermissions {
  canEdit: boolean;
  canComment: boolean;
  canExport: boolean;
  canInvite: boolean;
  canManageRoles: boolean;
}
```

### 角色权限矩阵

| 权限 | Owner | Editor | Viewer | Commenter |
|------|-------|--------|--------|-----------|
| 编辑项目 | ✓ | ✓ | - | - |
| 添加评论 | ✓ | ✓ | ✓ | ✓ |
| 导出项目 | ✓ | ✓ | ✓ | - |
| 邀请用户 | ✓ | ✓ | - | - |
| 管理角色 | ✓ | - | - | - |

### 设置权限

```typescript
// 创建会话时设置权限
const session = await client.createSession({
  projectId: 'project-123',
  role: 'owner',
});

// 邀请用户并设置角色
await session.inviteUser('user@example.com', 'editor');

// 修改用户角色
await session.updateUserRole('user-456', 'viewer');
```

## 冲突解决

协作服务器使用 CRDT（Conflict-free Replicated Data Type）自动解决冲突。

### 冲突类型

| 类型 | 处理方式 |
|------|---------|
| 同一属性修改 | Last-Writer-Wins (LWW) |
| 剪辑位置重叠 | 自动调整位置 |
| 同时删除/修改 | 保留删除操作 |
| 并行添加 | 合并两者 |

### 手动冲突处理

```typescript
session.onConflict((conflict) => {
  console.log('Conflict detected:', conflict);

  // 显示冲突解决 UI
  showConflictDialog({
    local: conflict.localChange,
    remote: conflict.remoteChange,
    onResolve: (resolution) => {
      session.resolveConflict(conflict.id, resolution);
    },
  });
});
```

## 监控与运维

### 健康检查

```bash
curl http://localhost:3001/health
# { "status": "ok", "uptime": 3600, "connections": 5 }
```

### 指标

```bash
curl http://localhost:3001/metrics
# {
#   "activeRooms": 3,
#   "totalConnections": 12,
#   "messagesPerSecond": 45,
#   "averageLatency": 23
# }
```

### 日志

```bash
# 查看实时日志
docker logs -f collaboration-server

# 日志级别配置
LOG_LEVEL=debug  # error | warn | info | debug
```

## 性能优化

### 建议配置

- **Redis** — 使用独立实例，配置适当的 `maxmemory`
- **PostgreSQL** — 配置连接池，定期清理过期数据
- **WebSocket** — 启用压缩，配置合理的超时时间
- **负载均衡** — 使用 Nginx 的 `ip_hash` 确保会话粘性

### Nginx 配置示例

```nginx
upstream collaboration {
    ip_hash;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 443 ssl;
    server_name collab.open-factory.dev;

    location / {
        proxy_pass http://collaboration;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

## 故障排除

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 连接失败 | 网络/防火墙 | 检查端口开放和 WebSocket 支持 |
| 同步延迟 | 服务器负载 | 检查服务器资源和连接数 |
| 数据丢失 | Redis 未持久化 | 配置 Redis AOF 持久化 |
| 冲突频繁 | 同时编辑同一区域 | 引导用户分工编辑不同区域 |
