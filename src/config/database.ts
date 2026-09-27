import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export async function connectDatabase(
  uri: string = env.mongodbUri,
): Promise<void> {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected'),
  );
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', err));

  // TODO: Tune connection options (pool size, timeouts, retry policy) for deployment.
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
