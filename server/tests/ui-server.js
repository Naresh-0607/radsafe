// Isolated browser-test fixture. Never connects to Atlas or uses application .env credentials.
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createServer } from 'vite';
import { createApp } from '../app.js';
import { seedDemo } from '../seed/demo.js';
const binary = resolve('node_modules/.cache/mongodb-memory-server');
const repl = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  ...(existsSync(binary) ? { binary: { downloadDir: binary } } : {}),
});
await mongoose.connect(repl.getUri());
mongoose.set('sanitizeFilter', true);
for (const Model of Object.values(mongoose.models)) await Model.init();
const config = {
  jwtSecret: randomBytes(48).toString('hex'),
  jwtExpiresIn: '1d',
  clientUrl: 'http://127.0.0.1:5173',
  thresholds: { warning: 2.5, critical: 5, unit: 'uSv/h', label: 'Demonstration thresholds' },
};
if (!process.env.RADSAFE_UI_PASSWORD)
  throw new Error('Run through npm run test:ui to generate an ephemeral test password.');
Object.assign(process.env, {
  SEED_ADMIN_NAME: 'Alex Morgan',
  SEED_ADMIN_EMAIL: 'admin@example.test',
  SEED_ADMIN_PASSWORD: process.env.RADSAFE_UI_PASSWORD,
  SEED_OFFICER_NAME: 'Sam Rivera',
  SEED_OFFICER_EMAIL: 'officer@example.test',
  SEED_OFFICER_PASSWORD: process.env.RADSAFE_UI_PASSWORD,
});
await seedDemo(config);
const api = createApp(config).listen(5000, '127.0.0.1');
const vite = await createServer({
  root: resolve('client'),
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
await vite.listen();
async function close() {
  await vite.close();
  await new Promise((r) => api.close(r));
  await mongoose.disconnect();
  await repl.stop();
  process.exit(0);
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
