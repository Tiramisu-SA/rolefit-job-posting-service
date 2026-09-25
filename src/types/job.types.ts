// Shared domain types used by REST, gRPC, service and repository layers.
// These are transport-agnostic: controllers and gRPC handlers map to/from them.

// TODO: Confirm the lifecycle states with the team. Draw the allowed
// transitions (e.g. DRAFT -> PUBLISHED -> CLOSED -> PUBLISHED?) before implementing them.
export enum JobStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
}

// TODO: Finalize the Job fields together with job.model.ts and proto/job-posting.proto.
export interface Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  // TODO: company/owner, location, employment type, salary, skills, requirements, ...
  createdAt: Date;
  updatedAt: Date;
}

// TODO: Decide which fields are required on create vs. optional.
export interface CreateJobInput {
  title: string;
  description: string;
}

// TODO: Decide which fields may be changed after a job is published.
export type UpdateJobInput = Partial<CreateJobInput>;

// TODO: Decide the resume template format (plain text? structured sections? file reference?).
export interface ResumeTemplate {
  jobId: string;
  content: unknown;
  updatedAt: Date;
}

export interface AttachResumeTemplateInput {
  content: unknown;
}

// TODO: Decide filters (status, company, keyword, ...) and pagination style (page/limit vs cursor).
export interface ListJobsQuery {
  status?: JobStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
