import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { jobService } from './container';
import { startGrpcServer } from './grpc/grpc.server';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  try {
    await connectDatabase();
  } catch (err) {
    // The skeleton keeps running without MongoDB so REST/gRPC can be smoke-tested.
    // TODO: Decide whether the service should fail fast (exit) when MongoDB is unreachable.
    logger.error(`Could not connect to MongoDB at ${env.mongodbUri}`, (err as Error).message);
  }

  const app = createApp();
  const httpServer = app.listen(env.httpPort, () => {
    logger.info(`REST API listening on http://localhost:${env.httpPort}`);
  });

  const { server: grpcServer, port: grpcPort } = await startGrpcServer(jobService, env.grpcHost, env.grpcPort);
  logger.info(`gRPC server listening on ${env.grpcHost}:${grpcPort}`);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    httpServer.close();
    grpcServer.tryShutdown(() => undefined);
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
