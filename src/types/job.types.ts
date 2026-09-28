// Shared domain types used by the gRPC, service and repository layers.
// They follow the agreed job JSON document
// (docs/superpowers/specs/2026-09-27-job-posting-grpc-design.md).

export const JOB_STATUSES = ['DRAFT', 'OPEN', 'CLOSED'] as const;
export const SKILL_LEVELS = ['BASIC', 'INTERMEDIATE', 'ADVANCED'] as const;
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT'] as const;
export const WORK_ARRANGEMENTS = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export const EDUCATION_LEVELS = ['NONE', 'HIGH_SCHOOL', 'DIPLOMA', 'BACHELOR', 'MASTER', 'DOCTORATE'] as const;

/** DRAFT -> OPEN (publish) -> CLOSED (close) -> OPEN (reopen). Only DRAFT jobs can be deleted. */
export type JobStatus = (typeof JOB_STATUSES)[number];
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export interface RequiredSkill {
  name: string;
  level: SkillLevel;
  minimumYears: number;
}

export interface PreferredSkill {
  name: string;
  level: SkillLevel;
}

export interface Requirements {
  requiredSkills: RequiredSkill[];
  preferredSkills: PreferredSkill[];
  minimumExperienceYears: number;
  educationLevel: EducationLevel;
  acceptedFields: string[];
}

export interface Location {
  country?: string;
  province?: string;
  district?: string;
}

export interface Salary {
  minimum?: number;
  maximum?: number;
  currency: string;
  visible: boolean;
}

export interface ApplicationSettings {
  applicationDeadline?: Date;
  positionsAvailable: number;
  resumeTemplateId?: string;
  requireCoverLetter: boolean;
}

export interface Job {
  id: string;
  recruiterId: string;
  companyId: string;
  title: string;
  /** '' until the recruiter writes one (required to publish). */
  description: string;
  requirements: Requirements;
  responsibilities: string[];
  employmentType?: EmploymentType;
  workArrangement?: WorkArrangement;
  location: Location;
  salary: Salary;
  applicationSettings: ApplicationSettings;
  status: JobStatus;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields a recruiter edits. UpdateJob replaces all of them. */
export interface JobInput {
  title: string;
  description: string;
  requirements: Requirements;
  responsibilities: string[];
  employmentType?: EmploymentType;
  workArrangement?: WorkArrangement;
  location: Location;
  salary: Salary;
  applicationDeadline?: Date;
  positionsAvailable: number;
  requireCoverLetter: boolean;
}

/** Verified caller claims. Reads accept any authenticated role; writes require recruiter + company. */
export type Caller = { userId: string; role?: string; companyId?: string } | null;

export interface ListJobsQuery {
  status?: JobStatus;
  companyId?: string;
  /** Case-insensitive text matched against the title and required skill names. */
  query?: string;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const RESUME_TEMPLATE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
export const MAX_RESUME_TEMPLATE_BYTES = 2 * 1024 * 1024;

export interface ResumeTemplate {
  id: string;
  jobId: string;
  companyId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Left out when only metadata was requested. */
  content?: Buffer;
  createdAt: Date;
}

export interface ResumeTemplateUpload {
  fileName: string;
  contentType: string;
  content: Buffer;
}
