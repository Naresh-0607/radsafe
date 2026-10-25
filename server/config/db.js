import dns from 'node:dns';
import mongoose from 'mongoose';

export async function connectDB(uri) {
  mongoose.set('sanitizeFilter', true);
  if (uri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch {
      // Ignore if setServers is not permitted in the environment
    }
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
}


