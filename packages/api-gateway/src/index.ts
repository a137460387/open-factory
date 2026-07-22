/**
 * API Gateway entry point
 */

import { startServer } from './server.js';

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { createServer, startServer } from './server.js';
export { getConfig, loadConfig } from './config.js';
export { authMiddleware, verifyToken, generateToken } from './middleware/auth.js';
export { rbacMiddleware, hasPermission } from './middleware/rbac.js';
export { PluginService, pluginService } from './services/plugin-service.js';
export { CreatorService, creatorService } from './services/creator-service.js';
export * from './types.js';
export * from './utils/response.js';
export * from './utils/errors.js';
