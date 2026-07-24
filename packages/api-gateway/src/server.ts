/**
 * Fastify server configuration
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { getConfig } from './config.js';
import { errorHandler } from './utils/errors.js';
import { pluginRoutes } from './routes/plugins.js';
import { creatorRoutes } from './routes/creators.js';
import { healthRoutes } from './routes/health.js';

// ============================================================
// Server Factory
// ============================================================

export async function createServer() {
  const config = getConfig();

  const fastify = Fastify({
    logger: {
      level: config.logging.level,
      transport: config.logging.pretty
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  });

  // ============================================================
  // Plugins
  // ============================================================

  // CORS
  await fastify.register(cors, {
    origin: config.cors.origins,
    credentials: config.cors.credentials,
  });

  // Rate Limiting
  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
  });

  // Security Headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow Tauri WebView
  });

  // ============================================================
  // Error Handler
  // ============================================================

  fastify.setErrorHandler(errorHandler);

  // ============================================================
  // Routes
  // ============================================================

  await fastify.register(healthRoutes);
  await fastify.register(pluginRoutes);
  await fastify.register(creatorRoutes);

  // ============================================================
  // Swagger Documentation (development only)
  // ============================================================

  if (config.nodeEnv === 'development') {
    try {
      const swagger = await import('@fastify/swagger');
      const swaggerUi = await import('@fastify/swagger-ui');

      await fastify.register(swagger.default, {
        openapi: {
          openapi: '3.0.0',
          info: {
            title: 'Open Factory API',
            description: 'API Gateway for Open Factory platform',
            version: '0.1.0',
          },
          servers: [
            {
              url: `http://${config.host}:${config.port}`,
              description: 'Development server',
            },
          ],
          components: {
            securitySchemes: {
              bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
              },
            },
          },
        },
      });

      await fastify.register(swaggerUi.default, {
        routePrefix: '/docs',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: true,
        },
      });
    } catch {
      // Swagger is optional in development
      fastify.log.warn('Swagger documentation not available');
    }
  }

  return fastify;
}

// ============================================================
// Start Server
// ============================================================

export async function startServer() {
  const config = getConfig();
  const server = await createServer();

  try {
    await server.listen({
      port: config.port,
      host: config.host,
    });

    server.log.info(`Server running at http://${config.host}:${config.port}`);

    if (config.nodeEnv === 'development') {
      server.log.info(`API docs available at http://${config.host}:${config.port}/docs`);
    }

    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
