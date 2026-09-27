import { createAIModelAdapter } from './adapters/ai/ai.adapter';
import { JobRepository } from './repositories/job.repository';
import { JobService } from './services/job.service';
import { createJobPostingClient } from './grpc/job-posting.client';
import { env } from './config/env';

// Composition root: wires dependencies once so REST and gRPC share
// the exact same JobService instance.
const jobRepository = new JobRepository();
const aiModelAdapter = createAIModelAdapter();

export const jobService = new JobService(jobRepository, aiModelAdapter);

export const jobPostingGrpcClient = createJobPostingClient(
  env.grpcHost,
  env.grpcPort,
);
