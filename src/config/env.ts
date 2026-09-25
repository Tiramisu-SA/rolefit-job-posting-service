import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// TODO: Validate required variables at startup (e.g. fail fast in production
// if MONGODB_URI is missing) instead of silently falling back to defaults.
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  httpPort: toPort(process.env.HTTP_PORT, 3000),
  grpcHost: process.env.GRPC_HOST ?? '0.0.0.0',
  grpcPort: toPort(process.env.GRPC_PORT, 50051),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/rolefit_job_posting',
  aiProvider: process.env.AI_PROVIDER ?? 'none',
  aiApiKey: process.env.AI_API_KEY ?? '',
} as const;
