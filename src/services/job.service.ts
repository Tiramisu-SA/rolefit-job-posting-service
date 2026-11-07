import { ulid } from 'ulid';
import type { AIModelAdapter } from '../adapters/ai/ai.adapter';
import type { JobRepository } from '../repositories/job.repository';
import {
  JOB_STATUSES,
  MAX_RESUME_TEMPLATE_BYTES,
  RESUME_TEMPLATE_TYPES,
  type Caller,
  type Job,
  type JobStatus,
  type ListJobsQuery,
  type PaginatedResult,
  type ResumeTemplate,
  type ResumeTemplateUpload,
} from '../types/job.types';
import {
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type FieldError,
} from '../utils/errors';
import { assertPublishable, validateJobInput } from '../validation/job.validation';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const jobNotFound = () => new NotFoundError('Job not found');

/**
 * Business logic for job postings: lifecycle, ownership and visibility.
 *
 * This is the SINGLE source of business rules. The gRPC handlers call into
 * this class and never talk to the repository directly.
 *
 * Rules (see the design spec):
 * - A DRAFT job is visible only to its own company.
 * - Writes need a caller; the caller's company must own the job.
 * - DRAFT -> OPEN (publish) -> CLOSED (close) -> OPEN (reopen). Only drafts can be deleted.
 */
export class JobService {
  constructor(
    private readonly repo: JobRepository,
    // Optional collaborator (extractJobRequirements); not called yet.
    private readonly aiModelAdapter: AIModelAdapter,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: (prefix: string) => string = (prefix) => `${prefix}_${ulid()}`,
  ) {}

  // --- reads ---------------------------------------------------------------

  async getJob(caller: Caller, jobId: string): Promise<Job> {
    const job = await this.repo.findById(jobId);
    if (!job || !isVisible(job, caller)) throw jobNotFound();
    return job;
  }

  async listJobs(caller: Caller, query: Partial<ListJobsQuery>): Promise<PaginatedResult<Job>> {
    const page = Number.isInteger(query.page) && query.page! >= 1 ? query.page! : 1;
    const rawLimit = Number.isInteger(query.limit) && query.limit! >= 1 ? query.limit! : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);
    if (query.status !== undefined && !JOB_STATUSES.includes(query.status)) {
      throw new ValidationError([{ field: 'status', message: `Must be one of ${JOB_STATUSES.join(', ')}` }]);
    }
    const normalized: ListJobsQuery = {
      status: query.status,
      companyId: query.companyId?.trim() || undefined,
      query: query.query?.trim().slice(0, 100) || undefined,
      page,
      limit,
    };
    const { items, total } = await this.repo.list(normalized, { draftsVisibleTo: caller?.companyId });
    return { items, total, page, limit };
  }

  // --- writes --------------------------------------------------------------

  async createJob(caller: Caller, raw: unknown): Promise<Job> {
    const owner = requireCaller(caller);
    const input = validateJobInput(raw);
    const at = this.now();
    return this.repo.create({
      id: this.newId('job'),
      recruiterId: owner.userId,
      companyId: owner.companyId,
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      responsibilities: input.responsibilities,
      employmentType: input.employmentType,
      workArrangement: input.workArrangement,
      location: input.location,
      salary: input.salary,
      applicationSettings: {
        applicationDeadline: input.applicationDeadline,
        positionsAvailable: input.positionsAvailable,
        requireCoverLetter: input.requireCoverLetter,
      },
      status: 'DRAFT',
      createdAt: at,
      updatedAt: at,
    });
  }

  /** Replaces every editable field. Status, owner, publishedAt and template stay as they are. */
  async updateJob(caller: Caller, jobId: string, raw: unknown): Promise<Job> {
    const job = await this.loadOwned(caller, jobId);
    const input = validateJobInput(raw);
    return this.save(job.id, {
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      responsibilities: input.responsibilities,
      employmentType: input.employmentType,
      workArrangement: input.workArrangement,
      location: input.location,
      salary: input.salary,
      applicationSettings: {
        ...job.applicationSettings,
        applicationDeadline: input.applicationDeadline,
        positionsAvailable: input.positionsAvailable,
        requireCoverLetter: input.requireCoverLetter,
      },
    });
  }

  async deleteJob(caller: Caller, jobId: string): Promise<void> {
    const job = await this.loadOwned(caller, jobId);
    if (job.status !== 'DRAFT') {
      throw new InvalidStateError('Only draft jobs can be deleted. Close this job instead.');
    }
    await this.repo.deleteTemplateByJobId(job.id);
    await this.repo.delete(job.id);
  }

  async publishJob(caller: Caller, jobId: string): Promise<Job> {
    const job = await this.loadOwned(caller, jobId);
    assertStatus(job, 'DRAFT', 'Only draft jobs can be published');
    assertPublishable(job, this.now());
    return this.save(job.id, { status: 'OPEN', publishedAt: job.publishedAt ?? this.now() });
  }

  async closeJob(caller: Caller, jobId: string): Promise<Job> {
    const job = await this.loadOwned(caller, jobId);
    assertStatus(job, 'OPEN', 'Only open jobs can be closed');
    return this.save(job.id, { status: 'CLOSED' });
  }

  async reopenJob(caller: Caller, jobId: string): Promise<Job> {
    const job = await this.loadOwned(caller, jobId);
    assertStatus(job, 'CLOSED', 'Only closed jobs can be reopened');
    const deadline = job.applicationSettings.applicationDeadline;
    if (deadline && deadline <= this.now()) {
      throw new InvalidStateError('The application deadline has passed. Set a new deadline before reopening.');
    }
    return this.save(job.id, { status: 'OPEN' });
  }

  // --- resume templates ----------------------------------------------------

  async attachResumeTemplate(caller: Caller, jobId: string, upload: ResumeTemplateUpload): Promise<ResumeTemplate> {
    const job = await this.loadOwned(caller, jobId);
    validateTemplate(upload);
    const template: ResumeTemplate = {
      id: this.newId('template'),
      jobId: job.id,
      companyId: job.companyId,
      fileName: upload.fileName.trim(),
      contentType: upload.contentType,
      sizeBytes: upload.content.length,
      content: upload.content,
      createdAt: this.now(),
    };
    await this.repo.saveTemplate(template);
    await this.save(job.id, { applicationSettings: { ...job.applicationSettings, resumeTemplateId: template.id } });
    const { content: _content, ...metadata } = template;
    return metadata;
  }

  async getResumeTemplate(caller: Caller, jobId: string, includeContent: boolean): Promise<ResumeTemplate> {
    const job = await this.getJob(caller, jobId);
    const template = await this.repo.findTemplateByJobId(job.id, includeContent);
    if (!template) throw new NotFoundError('This job has no resume template');
    return template;
  }

  async deleteResumeTemplate(caller: Caller, jobId: string): Promise<void> {
    const job = await this.loadOwned(caller, jobId);
    if (!(await this.repo.deleteTemplateByJobId(job.id))) throw new NotFoundError('This job has no resume template');
    await this.save(job.id, { applicationSettings: { ...job.applicationSettings, resumeTemplateId: undefined } });
  }

  // --- helpers -------------------------------------------------------------

  /** Loads a job for a write: needs a caller, hides others' drafts, then checks ownership. */
  private async loadOwned(caller: Caller, jobId: string): Promise<Job> {
    const owner = requireCaller(caller);
    const job = await this.repo.findById(jobId);
    if (!job || !isVisible(job, owner)) throw jobNotFound();
    if (job.companyId !== owner.companyId) throw new ForbiddenError();
    return job;
  }

  private async save(jobId: string, patch: Partial<Omit<Job, 'id' | 'createdAt'>>): Promise<Job> {
    const job = await this.repo.update(jobId, { ...patch, updatedAt: this.now() });
    if (!job) throw jobNotFound();
    return job;
  }
}

function requireCaller(caller: Caller): NonNullable<Caller> {
  if (!caller) throw new UnauthorizedError();
  return caller;
}

function isVisible(job: Job, caller: Caller): boolean {
  return job.status !== 'DRAFT' || job.companyId === caller?.companyId;
}

function assertStatus(job: Job, expected: JobStatus, message: string): void {
  if (job.status !== expected) throw new InvalidStateError(`${message} (this job is ${job.status})`);
}

function validateTemplate(upload: ResumeTemplateUpload): void {
  const errors: FieldError[] = [];
  const name = upload.fileName?.trim() ?? '';
  if (!name || name.length > 255) errors.push({ field: 'file_name', message: 'Must be 1-255 characters' });
  if (!(RESUME_TEMPLATE_TYPES as readonly string[]).includes(upload.contentType)) {
    errors.push({ field: 'content_type', message: 'Upload a PDF or DOCX file' });
  }
  if (upload.content.length === 0) errors.push({ field: 'content', message: 'The file is empty' });
  else if (upload.content.length > MAX_RESUME_TEMPLATE_BYTES) errors.push({ field: 'content', message: 'The file is larger than 2 MB' });
  if (errors.length > 0) throw new ValidationError(errors);
}
