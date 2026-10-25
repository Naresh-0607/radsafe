import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { getConfig } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { seedAdmin } from './admin.js';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import Sensor from '../models/Sensor.js';
import { RadiationReading, Alert } from '../models/operations.js';
import { classifyReading } from '../services/thresholds.js';
import { audit } from '../services/audit.js';
import { password, text } from '../middleware/validate.js';
export async function seedDemo(config) {
  const admin = await seedAdmin();
  let officer = null;
  if (process.env.SEED_OFFICER_EMAIL || process.env.SEED_OFFICER_PASSWORD) {
    const input = z.object({ name: text(), email: z.email().toLowerCase(), password }).parse({
      name: process.env.SEED_OFFICER_NAME,
      email: process.env.SEED_OFFICER_EMAIL,
      password: process.env.SEED_OFFICER_PASSWORD,
    });
    officer = await User.findOne({ email: input.email });
    if (officer && officer.role !== 'SAFETY_OFFICER')
      throw new Error('Demo officer email belongs to a different role');
    if (!officer)
      officer = await User.create({
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        employeeId: 'SO-DEMO-001',
        role: 'SAFETY_OFFICER',
        department: 'Radiation Protection',
      });
  }
  const names = ['Reactor Zone A', 'Reactor Zone B', 'Cooling Area', 'Storage Area', 'Laboratory'];
  for (let i = 0; i < names.length; i++) {
    const zone = await Zone.findOneAndUpdate(
      { code: 'DEMO-Z' + (i + 1) },
      {
        $setOnInsert: {
          name: names[i],
          description: 'Synthetic academic demonstration area',
          status: 'ACTIVE',
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    const sensor = await Sensor.findOneAndUpdate(
      { sensorCode: 'DEMO-RAD-00' + (i + 1) },
      {
        $setOnInsert: {
          zone: zone._id,
          type: 'Demo area monitor',
          status: 'ACTIVE',
          installedAt: new Date(Date.now() - 30 * 86400000),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    // Existing history is left untouched. This command is a one-time fixture import, not a simulator.
    if (await RadiationReading.exists({ sensor: sensor._id })) continue;
    await mongoose.connection.transaction(async (session) => {
      for (let day = 6; day >= 0; day--) {
        const value =
          day === 0 && i === 1 ? config.thresholds.warning * 1.12 : 0.15 + i * 0.12 + day * 0.03;
        const status = classifyReading(value, config.thresholds);
        const recordedAt = new Date(Date.now() - day * 86400000 - 60000);
        const [reading] = await RadiationReading.create(
          [
            {
              sensor: sensor._id,
              zone: zone._id,
              value,
              unit: 'uSv/h',
              recordedAt,
              createdBy: (officer || admin)._id,
              status,
              demonstrationThresholds: {
                warning: config.thresholds.warning,
                critical: config.thresholds.critical,
              },
            },
          ],
          { session },
        );
        if (status !== 'NORMAL')
          await Alert.create(
            [
              {
                alertCode: 'DEMO-ALT-' + (i + 1) + '-' + day,
                sensor: sensor._id,
                zone: zone._id,
                radiationReading: reading._id,
                severity: status,
                message: 'Seeded synthetic reading reached a demonstration threshold.',
                createdAt: recordedAt,
              },
            ],
            { session },
          );
      }
      await audit(admin._id, 'IMPORT_DEMO_DATA', 'Sensor', sensor._id, {}, session);
    });
  }
  console.log('Demo fixtures ready. No existing records or passwords were overwritten.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = getConfig();
    await connectDB(config.mongoUri);
    for (const Model of Object.values(mongoose.models)) await Model.init();
    await seedDemo(config);
  } catch (error) {
    console.error(
      'Demo seed failed:',
      error.name,
      error.code || 'Check configuration and seed inputs.',
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
