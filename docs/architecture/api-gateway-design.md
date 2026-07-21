# API Gateway Architecture - Sprint AH

## Overview

构建统一的 API 网关，连接前端应用与后端服务，实现认证、授权、路由和数据聚合。

## 技术栈选择

### 网关框架：Fastify

选择理由：
- 性能优异，比 Express 快 2-3 倍
- 原生 TypeScript 支持
- 内置 JSON Schema 验证
- 插件系统成熟
- 异步优先设计

### 认证授权

- JWT 认证（复用 collaboration-server 的 auth 模块）
- RBAC 基于角色的访问控制
- OAuth 2.0 支持（可选）

### API 规范

- OpenAPI 3.0 规范
- 自动生成客户端 SDK
- Swagger UI 文档

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Apps                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Plugin Market │  │Creator Dash  │  │  Desktop App │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Fastify)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Middleware Chain                                     │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │  │
│  │  │  CORS   │ │  Auth   │ │  RBAC   │ │  Rate   │  │  │
│  │  │         │ │  (JWT)  │ │         │ │ Limit   │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Route Handlers                                      │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │  │
│  │  │   Plugins   │ │  Creators   │ │   Projects  │  │  │
│  │  │   /api/v1/  │ │  /api/v1/   │ │  /api/v1/   │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Plugin Service│  │Creator Service│  │Project Service│      │
│  │  (Database)  │  │  (Database)  │  │  (Database)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
packages/api-gateway/
├── src/
│   ├── index.ts                 # 入口文件
│   ├── server.ts                # Fastify 服务器配置
│   ├── config.ts                # 配置管理
│   ├── types.ts                 # 类型定义
│   ├── middleware/
│   │   ├── auth.ts              # JWT 认证中间件
│   │   ├── rbac.ts              # RBAC 授权中间件
│   │   ├── cors.ts              # CORS 配置
│   │   ├── rate-limit.ts        # 速率限制
│   │   └── validation.ts        # 请求验证
│   ├── routes/
│   │   ├── plugins.ts           # 插件市场 API
│   │   ├── creators.ts          # 创作者 API
│   │   ├── projects.ts          # 项目 API
│   │   └── health.ts            # 健康检查
│   ├── services/
│   │   ├── plugin-service.ts    # 插件业务逻辑
│   │   ├── creator-service.ts   # 创作者业务逻辑
│   │   └── project-service.ts   # 项目业务逻辑
│   ├── schemas/
│   │   ├── plugin.schema.ts     # 插件 JSON Schema
│   │   ├── creator.schema.ts    # 创作者 JSON Schema
│   │   └── project.schema.ts    # 项目 JSON Schema
│   └── utils/
│       ├── response.ts          # 统一响应格式
│       └── errors.ts            # 错误处理
├── openapi/
│   └── spec.yaml                # OpenAPI 规范
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## API 端点设计

### 插件市场 API

```
GET    /api/v1/plugins              # 搜索插件
GET    /api/v1/plugins/:id          # 获取插件详情
POST   /api/v1/plugins              # 创建插件（需要认证）
PUT    /api/v1/plugins/:id          # 更新插件（需要认证+权限）
DELETE /api/v1/plugins/:id          # 删除插件（需要认证+权限）
POST   /api/v1/plugins/:id/install  # 安装插件（需要认证）
POST   /api/v1/plugins/:id/review   # 提交评价（需要认证）
```

### 创作者 API

```
GET    /api/v1/creators/me          # 获取当前创作者信息
GET    /api/v1/creators/:id         # 获取创作者公开信息
GET    /api/v1/creators/:id/plugins # 获取创作者的插件列表
GET    /api/v1/creators/:id/stats   # 获取创作者统计数据
PUT    /api/v1/creators/me          # 更新创作者信息（需要认证）
GET    /api/v1/creators/me/revenue  # 获取收入数据（需要认证）
```

### 项目 API

```
GET    /api/v1/projects             # 获取用户项目列表（需要认证）
POST   /api/v1/projects             # 创建项目（需要认证）
GET    /api/v1/projects/:id         # 获取项目详情（需要认证+权限）
PUT    /api/v1/projects/:id         # 更新项目（需要认证+权限）
DELETE /api/v1/projects/:id         # 删除项目（需要认证+权限）
```

## 认证授权流程

### JWT 认证

```typescript
// 请求头
Authorization: Bearer <token>

// Token Payload
{
  "sub": "user_id",
  "name": "display_name",
  "email": "user@example.com",
  "roles": ["creator", "user"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

### RBAC 角色

```typescript
type Role = 'admin' | 'creator' | 'user';

interface Permission {
  resource: string;
  action: 'read' | 'write' | 'delete';
}

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    { resource: '*', action: '*' },
  ],
  creator: [
    { resource: 'plugins', action: 'read' },
    { resource: 'plugins', action: 'write' },  // own plugins only
    { resource: 'creators', action: 'read' },
    { resource: 'creators', action: 'write' }, // own profile only
  ],
  user: [
    { resource: 'plugins', action: 'read' },
    { resource: 'creators', action: 'read' },
  ],
};
```

## 统一响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
```

## 数据库设计

### 插件表 (plugins)

```sql
CREATE TABLE plugins (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  author_id VARCHAR(255) REFERENCES users(id),
  manifest JSONB NOT NULL,
  stats JSONB DEFAULT '{}',
  rating JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);
```

### 创作者表 (creators)

```sql
CREATE TABLE creators (
  id VARCHAR(255) PRIMARY KEY REFERENCES users(id),
  display_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(500),
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  revenue_total DECIMAL(10,2) DEFAULT 0,
  revenue_monthly DECIMAL(10,2) DEFAULT 0,
  plugins_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 用户表 (users)

```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url VARCHAR(500),
  roles TEXT[] DEFAULT '{user}',
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 实现阶段

### Phase 1: 基础网关（当前 Sprint）

1. 创建 `packages/api-gateway/` 模块
2. 实现 Fastify 服务器基础配置
3. 集成 JWT 认证中间件
4. 实现 RBAC 授权
5. 创建插件市场 API 端点
6. 创建创作者 API 端点
7. 编写单元测试

### Phase 2: 数据库集成

1. 集成 PostgreSQL/SQLite
2. 实现数据访问层
3. 迁移 mock 数据到真实数据库
4. 添加数据验证

### Phase 3: 高级功能

1. OAuth 2.0 集成
2. OpenAPI 规范自动生成
3. SDK 自动生成
4. 性能优化和缓存

## 性能目标

- API 响应时间 < 100ms (p95)
- 支持 1000+ 并发连接
- 认证延迟 < 50ms

## 安全要求

- 所有 API 端点使用 HTTPS
- JWT Token 有效期 1 小时
- 敏感操作需要重新认证
- 速率限制：100 请求/分钟/用户
- 输入验证和 SQL 注入防护
