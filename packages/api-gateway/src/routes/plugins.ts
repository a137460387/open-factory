/**
 * Plugin routes
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pluginService } from '../services/plugin-service.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { successResponse, paginatedResponse } from '../utils/response.js';

// ============================================================
// Schemas
// ============================================================

const pluginSearchQuerySchema = z.object({
  keyword: z.string().optional(),
  category: z.enum([
    'effect', 'transition', 'generator', 'analyzer', 'exporter',
    'importer', 'tool', 'workflow', 'theme', 'other',
  ]).optional(),
  sortBy: z.enum(['relevance', 'downloads', 'rating', 'updated', 'created', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const pluginIdParamSchema = z.object({
  id: z.string().min(1),
});

const installBodySchema = z.object({
  version: z.string().optional(),
});

const reviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  content: z.string().max(2000).optional(),
});

const createPluginBodySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.enum([
    'effect', 'transition', 'generator', 'analyzer', 'exporter',
    'importer', 'tool', 'workflow', 'theme', 'other',
  ]),
  keywords: z.array(z.string()).max(10),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  license: z.string().optional(),
});

// ============================================================
// Routes
// ============================================================

export async function pluginRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/plugins - Search plugins
  fastify.get('/api/v1/plugins', {
    preHandler: [optionalAuthMiddleware],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          category: { type: 'string' },
          sortBy: { type: 'string' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                results: { type: 'array' },
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const query = pluginSearchQuerySchema.parse(request.query);
    const result = await pluginService.searchPlugins(query);
    return successResponse(result);
  });

  // GET /api/v1/plugins/:id - Get plugin details
  fastify.get('/api/v1/plugins/:id', {
    preHandler: [optionalAuthMiddleware],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = pluginIdParamSchema.parse(request.params);
    const result = await pluginService.getPluginById(id);
    return successResponse(result);
  });

  // POST /api/v1/plugins/:id/install - Install plugin
  fastify.post('/api/v1/plugins/:id/install', {
    preHandler: [authMiddleware],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          version: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = pluginIdParamSchema.parse(request.params);
    const body = installBodySchema.parse(request.body);
    const userId = request.user!.sub;

    const result = await pluginService.installPlugin(id, userId, body.version);
    return successResponse(result);
  });

  // POST /api/v1/plugins/:id/review - Submit review
  fastify.post('/api/v1/plugins/:id/review', {
    preHandler: [authMiddleware],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          title: { type: 'string', maxLength: 200 },
          content: { type: 'string', maxLength: 2000 },
        },
        required: ['rating'],
      },
    },
  }, async (request, reply) => {
    const { id } = pluginIdParamSchema.parse(request.params);
    const body = reviewBodySchema.parse(request.body);
    const userId = request.user!.sub;

    const result = await pluginService.submitReview(
      id,
      userId,
      body.rating,
      body.title,
      body.content
    );
    return successResponse(result);
  });

  // POST /api/v1/plugins - Create plugin (creator only)
  fastify.post('/api/v1/plugins', {
    preHandler: [
      authMiddleware,
      rbacMiddleware({ resource: 'plugins', action: 'write' }),
    ],
    schema: {
      body: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          version: { type: 'string' },
          category: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          homepage: { type: 'string' },
          repository: { type: 'string' },
          license: { type: 'string' },
        },
        required: ['id', 'name', 'description', 'version', 'category'],
      },
    },
  }, async (request, reply) => {
    const body = createPluginBodySchema.parse(request.body);
    const userId = request.user!.sub;

    const manifest = {
      ...body,
      author: request.user!.name,
      license: body.license || 'MIT',
      engines: { openFactory: '>=4.0.0' },
    };

    const result = await pluginService.createPlugin(manifest, userId);
    reply.status(201);
    return successResponse(result);
  });
}
