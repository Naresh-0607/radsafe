import mongoose from 'mongoose';
import { getConfig } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
try {
  const config = getConfig();
  await connectDB(config.mongoUri);
  const server = createApp(config).listen(config.port, () =>
    console.log(`RadSafe academic API listening on port ${config.port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () =>
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      }),
    );
} catch (error) {
  console.error(
    'Startup failed:',
    error.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, '[connection URI redacted]'),
  );
  process.exitCode = 1;
}
