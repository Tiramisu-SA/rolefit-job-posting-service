import type {
  CreateJobInput,
  Job,
  ListJobsQuery,
  PaginatedResult,
  ResumeTemplate,
  UpdateJobInput,
} from '../types/job.types';
import { NotImplementedError } from '../utils/errors';
// import { JobModel } from '../models/job.model';

/**
 * Data-access layer for jobs. The ONLY place that talks to MongoDB/Mongoose.
 * Returns plain domain objects (Job), never Mongoose documents, so upper layers
 * stay independent of the database.
 *
 * TODO: Implement every method using JobModel (see TODO.md).
 */
export class JobRepository {
  async create(_input: CreateJobInput): Promise<Job> {
    // TODO: Insert a new job document and map it to a Job.
    throw new NotImplementedError('JobRepository.create');
  }

  async findById(_jobId: string): Promise<Job | null> {
    // TODO: Handle invalid ObjectId strings; return null when not found.
    throw new NotImplementedError('JobRepository.findById');
  }

  async update(_jobId: string, _changes: UpdateJobInput | Partial<Job>): Promise<Job | null> {
    // TODO: Update and return the new version of the document.
    throw new NotImplementedError('JobRepository.update');
  }

  async list(_query: ListJobsQuery): Promise<PaginatedResult<Job>> {
    // TODO: Apply filters, sorting and pagination.
    throw new NotImplementedError('JobRepository.list');
  }

  async saveResumeTemplate(_jobId: string, _content: unknown): Promise<ResumeTemplate | null> {
    // TODO: Persist the resume template according to the chosen storage design.
    throw new NotImplementedError('JobRepository.saveResumeTemplate');
  }

  async findResumeTemplate(_jobId: string): Promise<ResumeTemplate | null> {
    // TODO: Load the resume template for a job.
    throw new NotImplementedError('JobRepository.findResumeTemplate');
  }
}
