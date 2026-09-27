import {
  CreateJobInput,
  Job,
  JobStatus,
  ListJobsQuery,
  PaginatedResult,
  ResumeTemplate,
  UpdateJobInput,
} from '../types/job.types';
import { JobModel } from '../models/job.model';
import { NotImplementedError } from '../utils/errors';

/**
 * Data-access layer for jobs. The ONLY place that talks to MongoDB/Mongoose.
 * Returns plain domain objects (Job), never Mongoose documents, so upper layers
 * stay independent of the database.
 *
 * TODO: Implement every method using JobModel (see TODO.md).
 */

function toJob(document: any): Job {
  return {
    id: document._id.toString(),
    title: document.title,
    description: document.description ?? '',
    requirements: document.requirements ?? '',
    status: document.status as JobStatus,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export class JobRepository {
  async create(input: CreateJobInput): Promise<Job> {
    // TODO: Insert a new job document and map it to a Job.
    const document = await JobModel.create({
      title: input.title,
      description: input.description,
      requirements: input.requirements,
    });

    return toJob(document);
  }

  async findById(jobId: string): Promise<Job | null> {
    // TODO: Handle invalid ObjectId strings; return null when not found.
    const document = await JobModel.findById(jobId);

    if (!document) {
      return null;
    }

    return toJob(document);
  }

  async update(
    jobId: string,
    changes: UpdateJobInput | Partial<Job>,
  ): Promise<Job | null> {
    // TODO: Update and return the new version of the document.
    const document = await JobModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          ...(changes.title !== undefined && {
            title: changes.title,
          }),
          ...(changes.description !== undefined && {
            description: changes.description,
          }),
          ...(changes.requirements !== undefined && {
            requirements: changes.requirements,
          }),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!document) {
      return null;
    }

    return toJob(document);
  }

  async list(query: ListJobsQuery): Promise<PaginatedResult<Job>> {
    // TODO: Apply filters, sorting and pagination.
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);

    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    const [documents, total] = await Promise.all([
      JobModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      JobModel.countDocuments(filter),
    ]);

    return {
      items: documents.map(toJob),
      total,
      page,
      limit,
    };
  }

  async delete(jobId: string): Promise<boolean> {
    const result = await JobModel.findByIdAndDelete(jobId);

    return result !== null;
  }

  async saveResumeTemplate(
    _jobId: string,
    _content: unknown,
  ): Promise<ResumeTemplate | null> {
    // TODO: Persist the resume template according to the chosen storage design.
    throw new NotImplementedError('JobRepository.saveResumeTemplate');
  }

  async findResumeTemplate(
    _jobId: string,
  ): Promise<ResumeTemplate | null> {
    // TODO: Load the resume template for a job.
    throw new NotImplementedError('JobRepository.findResumeTemplate');
  }
}