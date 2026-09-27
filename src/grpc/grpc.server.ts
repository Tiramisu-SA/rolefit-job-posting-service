import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { JobService } from '../services/job.service';
import { createJobPostingHandlers } from './job-posting.grpc';

// Resolves correctly from both src/grpc (tsx) and dist/grpc (compiled).
const PROTO_PATH = path.resolve(__dirname, '../../proto/job-posting.proto');

function loadJobPostingServiceDefinition(): grpc.ServiceDefinition {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  return proto.rolefit.jobposting.v1.JobPostingService.service;
}

export function startGrpcServer(
  jobService: JobService,
  host: string,
  port: number,
): Promise<grpc.Server> {
  const server = new grpc.Server();
  server.addService(
    loadJobPostingServiceDefinition(),
    createJobPostingHandlers(jobService),
  );

  // TODO: Use TLS / mTLS credentials for service-to-service calls in production.
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${host}:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err) => {
        if (err) return reject(err);
        resolve(server);
      },
    );
  });
}
