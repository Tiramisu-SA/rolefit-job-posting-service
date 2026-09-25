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
import { NotImplementedError } from '../utils/errors';

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

  async createJob(_input: CreateJobInput): Promise<Job> {
    // TODO: Validate input, set the initial status, persist via jobRepository.
    // TODO (optional): Use this.aiModelAdapter.extractJobRequirements() and decide
    //                  what happens if the AI call fails (job creation must not break).
    throw new NotImplementedError('JobService.createJob');
  }

  async updateJob(_jobId: string, _input: UpdateJobInput): Promise<Job> {
    // TODO: Load job, throw NotFoundError if missing, enforce which fields may change
    //       in the current status, persist changes.
    throw new NotImplementedError('JobService.updateJob');
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

  async getJob(_jobId: string): Promise<Job> {
    // TODO: Load job, throw NotFoundError if missing.
    // TODO: Decide whether callers may see DRAFT jobs (REST owner vs. gRPC discovery).
    throw new NotImplementedError('JobService.getJob');
  }

  async listJobs(_query: ListJobsQuery): Promise<PaginatedResult<Job>> {
    // TODO: Validate/normalize filters and pagination, delegate to repository.
    throw new NotImplementedError('JobService.listJobs');
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
