/**
 * Creator routes
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { creatorService } from '../services/creator-service.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { successResponse } from '../utils/response.js';

// ============================================================
// Schemas
// ============================================================

const creatorIdParamSchema = z.object({
  id: z.string().min(1),
});

const updateProfileBodySchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional(),
});

// ============================================================
// Routes
// ============================================================

export async function creatorRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/creators/me - Get current creator profile
  fastify.get('/api/v1/creators/me', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const profile = await creatorService.getCreatorByUserId(userId);
    return successResponse(profile);
  });

  // GET /api/v1/creators/me/stats - Get current creator stats
  fastify.get('/api/v1/creators/me/stats', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const profile = await creatorService.getCreatorByUserId(userId);
    const stats = await creatorService.getCreatorStats(profile.id);
    return successResponse(stats);
  });

  // GET /api/v1/creators/me/revenue - Get current creator revenue
  fastify.get('/api/v1/creators/me/revenue', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const profile = await creatorService.getCreatorByUserId(userId);
    const revenue = await creatorService.getCreatorRevenue(profile.id);
    return successResponse(revenue);
  });

  // GET /api/v1/creators/me/dashboard - Get full dashboard data
  fastify.get('/api/v1/creators/me/dashboard', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const dashboard = await creatorService.getDashboardData(userId);
    return successResponse(dashboard);
  });

  // PUT /api/v1/creators/me - Update creator profile
  fastify.put('/api/v1/creators/me', {
    preHandler: [
      authMiddleware,
      rbacMiddleware({ resource: 'creators', action: 'write' }),
    ],
    schema: {
      body: {
        type: 'object',
        properties: {
          displayName: { type: 'string', minLength: 1, maxLength: 100 },
          bio: { type: 'string', maxLength: 1000 },
          avatarUrl: { type: 'string', format: 'uri' },
        },
      },
    },
  }, async (request, reply) => {
    const body = updateProfileBodySchema.parse(request.body);
    const userId = request.user!.sub;

    const updated = await creatorService.updateCreatorProfile(userId, body);
    return successResponse(updated);
  });

  // GET /api/v1/creators/:id - Get creator public profile
  fastify.get('/api/v1/creators/:id', {
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
    const { id } = creatorIdParamSchema.parse(request.params);
    const profile = await creatorService.getCreatorById(id);
    return successResponse(profile);
  });

  // GET /api/v1/creators/:id/stats - Get creator stats
  fastify.get('/api/v1/creators/:id/stats', {
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
    const { id } = creatorIdParamSchema.parse(request.params);
    const stats = await creatorService.getCreatorStats(id);
    return successResponse(stats);
  });
}
