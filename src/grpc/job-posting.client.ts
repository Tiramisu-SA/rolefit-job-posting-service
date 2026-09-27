import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_PATH = path.resolve(
  __dirname,
  '../../proto/job-posting.proto',
);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(
  packageDefinition,
) as any;

const JobPostingService =
  proto.rolefit.jobposting.v1.JobPostingService;

export function createJobPostingClient(
  host: string,
  port: number,
) {
  return new JobPostingService(
    `${host}:${port}`,
    grpc.credentials.createInsecure(),
  );
}