import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { JobService } from '../services/job.service';
import { createJobPostingHandlers } from './job-posting.grpc';
import type { ClaimsVerifier } from '../auth/supabase';

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

/** Binds and starts the gRPC server. Resolves with the server and the bound port (useful with port 0). */
export function startGrpcServer(
  jobService: JobService,
  host: string,
  port: number,
  verifyClaims: ClaimsVerifier,
): Promise<{ server: grpc.Server; port: number }> {
  const server = new grpc.Server();
  server.addService(loadJobPostingServiceDefinition(), createJobPostingHandlers(jobService, verifyClaims));

  // Insecure credentials: fine for local development. Use TLS / mTLS between services in production.
  return new Promise((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      resolve({ server, port: boundPort });
    });
  });
}
