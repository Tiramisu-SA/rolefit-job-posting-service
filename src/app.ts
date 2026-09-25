import express, { type Express } from 'express';
import { isDatabaseConnected } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { createJobRouter } from './routes/job.routes';
import type { JobService } from './services/job.service';

export function createApp(jobService: JobService): Express {
  const app = express();

  app.use(express.json());
  // TODO: Add CORS configuration for the web frontend origin.
  // TODO: Add request logging.

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'job-posting-service',
      database: isDatabaseConnected() ? 'connected' : 'disconnected',
    });
  });

  app.use('/api/jobs', createJobRouter(jobService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
