import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError, ok } from '../utils/http.js';
import { audit } from '../services/audit.js';
// A generated dummy hash keeps unknown-account password checks comparable in cost.
const dummyHash = await bcrypt.hash('unused-dummy-comparison-value', 12);
export const login = (config) => async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +sessionVersion');
  const valid = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !valid) throw new HttpError(401, 'Invalid email or password');
  if (!user.active) throw new HttpError(401, 'Your account is inactive. Contact an administrator.');
  const token = jwt.sign({ version: user.sessionVersion }, config.jwtSecret, {
    subject: String(user._id),
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',
    issuer: 'radsafe',
    audience: 'radsafe-client',
  });
  await audit(user._id, 'LOGIN', 'User', user._id);
  ok(res, { token, user });
};
export async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
  await audit(req.user._id, 'LOGOUT', 'User', req.user._id);
  ok(res, {}, 'Signed out; all sessions for this account have been revoked');
}
