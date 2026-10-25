import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from '../utils/http.js';
export const protect = (config) => async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in to continue');
  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'radsafe',
      audience: 'radsafe-client',
    });
  } catch {
    throw new HttpError(401, 'Your session is invalid or expired. Please sign in again.');
  }
  if (!/^[a-f\d]{24}$/i.test(payload.sub || '')) throw new HttpError(401, 'Invalid session');
  const user = await User.findById(payload.sub).select('+sessionVersion');
  if (!user || !user.active || user.sessionVersion !== payload.version)
    throw new HttpError(401, 'Account inactive or session revoked. Please sign in again.');
  req.user = user;
  next();
};
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      throw new HttpError(403, 'You do not have permission to perform this action');
    next();
  };
