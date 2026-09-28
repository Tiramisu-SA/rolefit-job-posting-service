import express, { type Express } from 'express';
import { isDatabaseConnected } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

/**
 * HTTP server for health checks only. The job API is gRPC
 * (proto/job-posting.proto); the web frontend calls it from its Next.js server.
 */
export function createApp(): Express {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'job-posting-service',
      database: isDatabaseConnected() ? 'connected' : 'disconnected',
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
