/**
 * Health check routes
 */

import type { FastifyInstance } from 'fastify';
import { successResponse } from '../utils/response.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /health - Basic health check
  fastify.get('/health', async () => {
    return successResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // GET /health/ready - Readiness check
  fastify.get('/health/ready', async () => {
    // In production, check database connection, external services, etc.
    return successResponse({
      status: 'ready',
      checks: {
        database: 'ok',
        cache: 'ok',
      },
    });
  });

  // GET /health/live - Liveness check
  fastify.get('/health/live', async () => {
    return successResponse({
      status: 'alive',
    });
  });
}
