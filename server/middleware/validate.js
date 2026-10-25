import { z } from 'zod';
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');
export const text = (max = 200) => z.string().trim().min(1).max(max);
export const optionalText = (max = 2000) => z.string().trim().max(max).default('');
export const password = z
  .string()
  .min(12, 'Use at least 12 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must not exceed 72 UTF-8 bytes');
export const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body);
  next();
};
export const validateId = (req, res, next) => {
  for (const value of Object.values(req.params)) objectId.parse(value);
  next();
};
export const isoDate = z.string().datetime({ offset: true });
