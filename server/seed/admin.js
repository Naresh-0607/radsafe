import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { z } from 'zod';
import { getConfig } from '../config/env.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { password, text } from '../middleware/validate.js';

export async function seedAdmin() {
  const data = z.object({ name: text(), email: z.email().toLowerCase(), password }).parse({
    name: process.env.SEED_ADMIN_NAME,
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  });
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    if (existing.role !== 'ADMIN') throw new Error('Seed email belongs to a non-admin account.');
    console.log('Admin already exists; no changes made.');
    return existing;
  }
  const admin = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, 12),
    role: 'ADMIN',
    employeeId: 'ADMIN-001',
    department: 'Administration',
  });
  console.log('Initial admin created.');
  return admin;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await connectDB(getConfig().mongoUri);
    await User.init();
    await seedAdmin();
  } catch (error) {
    console.error(
      'Admin seed failed:',
      error.code === 11000 ? 'Unique account identifier already exists.' : error.message,
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
