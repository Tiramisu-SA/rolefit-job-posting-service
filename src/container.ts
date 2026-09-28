import { createAIModelAdapter } from './adapters/ai/ai.adapter';
import { MongoJobRepository } from './repositories/mongo-job.repository';
import { JobService } from './services/job.service';

// Composition root: wires dependencies once so REST and gRPC share
// the exact same JobService instance.
const jobRepository = new MongoJobRepository();
const aiModelAdapter = createAIModelAdapter();

export const jobService = new JobService(jobRepository, aiModelAdapter);
