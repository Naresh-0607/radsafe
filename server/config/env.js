import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export function getConfig() {
  const {
    MONGO_URI,
    JWT_SECRET,
    JWT_EXPIRES_IN = '1d',
    CLIENT_URL = 'http://localhost:5173',
  } = process.env;
  if (!MONGO_URI)
    throw new Error(
      'MONGO_URI is required. Configure your MongoDB Atlas connection in server/.env.',
    );
  if (!JWT_SECRET || JWT_SECRET.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  if (!/^\d+[smhd]$/.test(JWT_EXPIRES_IN))
    throw new Error('JWT_EXPIRES_IN must be a duration such as 1d or 8h.');
  const warning = Number(process.env.DEMO_WARNING_LEVEL);
  const critical = Number(process.env.DEMO_CRITICAL_LEVEL);
  if (
    !Number.isFinite(warning) ||
    warning <= 0 ||
    !Number.isFinite(critical) ||
    critical <= warning
  )
    throw new Error(
      'Configure DEMO_CRITICAL_LEVEL > DEMO_WARNING_LEVEL > 0. These are demonstration thresholds only.',
    );
  return {
    mongoUri: MONGO_URI,
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: JWT_EXPIRES_IN,
    clientUrl: CLIENT_URL,
    port: Number(process.env.PORT || 5000),
    thresholds: { warning, critical, unit: 'uSv/h', label: 'Demonstration thresholds' },
  };
}
