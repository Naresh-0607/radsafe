import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import { text, password, objectId } from '../middleware/validate.js';
import { ok, HttpError, requireFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { listQuery, paged } from '../services/query.js';
const fields = {
  name: text(),
  email: z.email().trim().toLowerCase(),
  employeeId: text(50),
  department: z.string().trim().max(120),
  assignedZone: objectId.nullable().optional(),
};
export const createUserSchema = z
  .object({ ...fields, password, role: z.literal('SAFETY_OFFICER').default('SAFETY_OFFICER') })
  .strict();
export const updateUserSchema = z
  .object({ ...fields, password: password.optional() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide a field to update');
export async function usersList(req, res) {
  const { filter, options } = listQuery(req.query, {
    searchFields: ['name', 'email', 'employeeId'],
    extra: ['department'],
  });
  ok(res, await paged(User, filter, options, 'assignedZone'));
}
export async function userGet(req, res) {
  ok(res, requireFound(await User.findById(req.params.id).populate('assignedZone'), 'User'));
}
export async function userCreate(req, res) {
  const { password: raw, ...data } = req.body;
  if (data.assignedZone) requireFound(await Zone.findById(data.assignedZone), 'Zone');
  const passwordHash = await bcrypt.hash(raw, 12);
  let user;
  await mongoose.connection.transaction(async (session) => {
    [user] = await User.create([{ ...data, passwordHash }], { session });
    await audit(req.user._id, 'CREATE_USER', 'User', user._id, {}, session);
  });
  ok(res, user, 'Safety Officer created', 201);
}
export async function userUpdate(req, res) {
  const { password: raw, ...data } = req.body;
  if (data.assignedZone) requireFound(await Zone.findById(data.assignedZone), 'Zone');
  if (raw) data.passwordHash = await bcrypt.hash(raw, 12);
  let user;
  await mongoose.connection.transaction(async (session) => {
    user = requireFound(
      await User.findById(req.params.id).select('+sessionVersion').session(session),
      'User',
    );
    user.set(data);
    if (raw) user.sessionVersion += 1;
    await user.save({ session });
    await audit(
      req.user._id,
      'UPDATE_USER',
      'User',
      user._id,
      { fields: Object.keys(data).filter((k) => k !== 'passwordHash') },
      session,
    );
  });
  ok(res, user, 'User updated');
}
export async function userStatus(req, res) {
  let user;
  await mongoose.connection.transaction(async (session) => {
    user = requireFound(
      await User.findById(req.params.id).select('+sessionVersion').session(session),
      'User',
    );
    if (user.role === 'ADMIN')
      throw new HttpError(409, 'Administrator accounts cannot be deactivated');
    user.active = req.body.active;
    user.sessionVersion += 1;
    await user.save({ session });
    await audit(
      req.user._id,
      'UPDATE_USER_STATUS',
      'User',
      user._id,
      { active: user.active },
      session,
    );
  });
  ok(res, user, 'Account status updated');
}
export async function userDelete(req, res) {
  await mongoose.connection.transaction(async (session) => {
    const user = requireFound(await User.findById(req.params.id).session(session), 'User');
    if (user.role === 'ADMIN') throw new HttpError(409, 'Administrator accounts cannot be deleted');
    // Audit/history documents retain identifiers after account deletion.
    await user.deleteOne({ session });
    await audit(req.user._id, 'DELETE_USER', 'User', user._id, {}, session);
  });
  ok(res, {}, 'User deleted');
}
