import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { login, logout } from '../controllers/auth.js';
import { ok } from '../utils/http.js';
export default function authRoutes(config) {
  const router = Router();
  router.post(
    '/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { success: false, message: 'Too many sign-in attempts. Try again in 15 minutes.' },
    }),
    validate(
      z
        .object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(200) })
        .strict(),
    ),
    login(config),
  );
  router.get('/me', protect(config), (req, res) => ok(res, req.user));
  router.post('/logout', protect(config), logout);
  return router;
}
