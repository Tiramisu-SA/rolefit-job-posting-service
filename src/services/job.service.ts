import type { AIModelAdapter } from '../adapters/ai/ai.adapter';
import type { JobRepository } from '../repositories/job.repository';
import type {
  AttachResumeTemplateInput,
  CreateJobInput,
  Job,
  ListJobsQuery,
  PaginatedResult,
  ResumeTemplate,
  UpdateJobInput,
} from '../types/job.types';
import { AppError, NotImplementedError } from '../utils/errors';

/**
 * Business logic for job postings.
 *
 * This is the SINGLE source of business rules. Both the REST controller and the
 * gRPC handler call into this class - neither of them should contain business logic
 * or talk to the repository directly.
 */
export class JobService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly aiModelAdapter: AIModelAdapter,
  ) {}

  async createJob(input: CreateJobInput): Promise<Job> {
    // TODO: Validate input, set the initial status, persist via jobRepository.
    // TODO (optional): Use this.aiModelAdapter.extractJobRequirements() and decide
    //                  what happens if the AI call fails (job creation must not break).
    return this.jobRepository.create(input);
  }

  async updateJob(
    jobId: string,
    input: UpdateJobInput,
  ): Promise<Job> {
    // TODO: Load job, throw NotFoundError if missing, enforce which fields may change
    //       in the current status, persist changes.
    const job = await this.jobRepository.update(jobId, input);

    if (!job) {
      throw new AppError('NOT_FOUND', `Job ${jobId} not found`);
    }

    return job;
  }


  async publishJob(_jobId: string): Promise<Job> {
    // TODO: Enforce publishing rules (allowed source states, required fields present).
    //       Throw InvalidStateError for illegal transitions.
    throw new NotImplementedError('JobService.publishJob');
  }

  async closeJob(_jobId: string): Promise<Job> {
    // TODO: Enforce close rules (which states can be closed?).
    throw new NotImplementedError('JobService.closeJob');
  }

  async reopenJob(_jobId: string): Promise<Job> {
    // TODO: Enforce reopen rules (back to which state?).
    throw new NotImplementedError('JobService.reopenJob');
  }

  async getJob(jobId: string): Promise<Job> {
    // TODO: Load job, throw NotFoundError if missing.
    // TODO: Decide whether callers may see DRAFT jobs (REST owner vs. gRPC discovery).
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new AppError('NOT_FOUND', `Job ${jobId} not found`);
    }

    return job;
  }


  async deleteJob(jobId: string): Promise<void> {
    const deleted = await this.jobRepository.delete(jobId);

    if (!deleted) {
      throw new AppError('NOT_FOUND', `Job ${jobId} not found`);
    }
  }

  async listJobs(
    query: ListJobsQuery,
  ): Promise<PaginatedResult<Job>> {
    // TODO: Validate/normalize filters and pagination, delegate to repository.
    return this.jobRepository.list(query);
  }

  async attachResumeTemplate(_jobId: string, _input: AttachResumeTemplateInput): Promise<ResumeTemplate> {
    // TODO: Ensure the job exists, validate the template, persist it.
    throw new NotImplementedError('JobService.attachResumeTemplate');
  }

  async getResumeTemplate(_jobId: string): Promise<ResumeTemplate> {
    // TODO: Return the template or throw NotFoundError.
    throw new NotImplementedError('JobService.getResumeTemplate');
  }
}
