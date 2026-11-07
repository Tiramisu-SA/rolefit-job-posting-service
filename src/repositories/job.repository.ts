import type { Job, ListJobsQuery, ResumeTemplate } from '../types/job.types';

/**
 * Data access for jobs and resume templates. Implementations are the ONLY code
 * that talks to the database, and they return plain domain objects.
 * JobService depends on this interface, so tests can use an in-memory fake.
 */
export interface JobRepository {
  create(job: Job): Promise<Job>;
  findById(id: string): Promise<Job | null>;
  /** Applies the patch and returns the new version, or null if the job is gone. */
  update(id: string, patch: Partial<Omit<Job, 'id' | 'createdAt'>>): Promise<Job | null>;
  delete(id: string): Promise<boolean>;
  /**
   * Filters, sorts and pages jobs. DRAFT jobs are returned only for
   * `draftsVisibleTo` (the caller's company id).
   * Sort: updatedAt desc when query.companyId is set, otherwise publishedAt desc.
   */
  list(query: ListJobsQuery, opts: { draftsVisibleTo?: string }): Promise<{ items: Job[]; total: number }>;

  /** Stores the template and deletes any earlier template of the same job. */
  saveTemplate(template: ResumeTemplate): Promise<void>;
  findTemplateByJobId(jobId: string, includeContent: boolean): Promise<ResumeTemplate | null>;
  deleteTemplateByJobId(jobId: string): Promise<boolean>;
}
