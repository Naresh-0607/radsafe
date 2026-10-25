import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import { errorHandler } from './middleware/errors.js';
import { HttpError, ok } from './utils/http.js';
import { protect } from './middleware/auth.js';
import apiRoutes from './routes/api.js';
export function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.clientUrl,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (req, res) =>
    ok(res, { application: 'RadSafe', mode: 'academic-simulation' }),
  );
  app.use('/api/auth', authRoutes(config));
  app.use('/api', protect(config), apiRoutes(config));
  app.use((req, res, next) => next(new HttpError(404, 'Endpoint not found')));
  app.use(errorHandler);
  return app;
}
