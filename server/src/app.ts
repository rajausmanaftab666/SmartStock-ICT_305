import express, { type Express } from 'express';
import { sessionMiddleware } from './config/session';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Assembles the API. Kept separate from server.ts so tests can mount the app
 * with supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(sessionMiddleware());

  // Feature routes are mounted here, one pull request at a time.

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
