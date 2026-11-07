import type { Job, JobStatus, ResumeTemplate } from '../types/job.types';

// Pure mapping between domain objects and proto messages (snake_case,
// prefixed enum names, ISO strings). Proto3 has no null: "" / 0 / UNSPECIFIED
// mean "not set" and become undefined in the domain.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Msg = Record<string, any>;

const PREFIX = {
  status: 'JOB_STATUS_',
  level: 'SKILL_LEVEL_',
  employment: 'EMPLOYMENT_TYPE_',
  arrangement: 'WORK_ARRANGEMENT_',
  education: 'EDUCATION_LEVEL_',
} as const;

function toEnum(prefix: string, value: string | undefined): string {
  return `${prefix}${value ?? 'UNSPECIFIED'}`;
}

/** 'EMPLOYMENT_TYPE_FULL_TIME' -> 'FULL_TIME'; UNSPECIFIED / '' -> undefined; unknown values pass through for validation to reject. */
function fromEnum<T extends string>(prefix: string, value: unknown): T | undefined {
  if (value === undefined || value === null || value === '' || value === `${prefix}UNSPECIFIED`) return undefined;
  const s = String(value);
  return (s.startsWith(prefix) ? s.slice(prefix.length) : s) as T;
}

const emptyToUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const iso = (date: Date | undefined): string => (date ? date.toISOString() : '');
const dateOrUndefined = (value: unknown): Date | undefined => (emptyToUndefined(value) ? new Date(value as string) : undefined);

export function toProtoJob(job: Job): Msg {
  const salary: Msg = { currency: job.salary.currency, visible: job.salary.visible };
  if (job.salary.minimum !== undefined) salary.minimum = job.salary.minimum;
  if (job.salary.maximum !== undefined) salary.maximum = job.salary.maximum;
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    status: toEnum(PREFIX.status, job.status),
    created_at: iso(job.createdAt),
    updated_at: iso(job.updatedAt),
    recruiter_id: job.recruiterId,
    company_id: job.companyId,
    requirements: {
      required_skills: job.requirements.requiredSkills.map((s) => ({
        name: s.name,
        level: toEnum(PREFIX.level, s.level),
        minimum_years: s.minimumYears,
      })),
      preferred_skills: job.requirements.preferredSkills.map((s) => ({ name: s.name, level: toEnum(PREFIX.level, s.level) })),
      minimum_experience_years: job.requirements.minimumExperienceYears,
      education_level: toEnum(PREFIX.education, job.requirements.educationLevel),
      accepted_fields: job.requirements.acceptedFields,
    },
    responsibilities: job.responsibilities,
    employment_type: toEnum(PREFIX.employment, job.employmentType),
    work_arrangement: toEnum(PREFIX.arrangement, job.workArrangement),
    location: {
      country: job.location.country ?? '',
      province: job.location.province ?? '',
      district: job.location.district ?? '',
    },
    salary,
    application_settings: {
      application_deadline: iso(job.applicationSettings.applicationDeadline),
      positions_available: job.applicationSettings.positionsAvailable,
      resume_template_id: job.applicationSettings.resumeTemplateId ?? '',
      require_cover_letter: job.applicationSettings.requireCoverLetter,
    },
    published_at: iso(job.publishedAt),
  };
}

/** Inverse of toProtoJob (used by clients and tests). */
export function fromProtoJob(msg: Msg): Job {
  const r = msg.requirements ?? {};
  const s = msg.salary ?? {};
  const a = msg.application_settings ?? {};
  const loc = msg.location ?? {};
  const location: Job['location'] = {};
  if (emptyToUndefined(loc.country)) location.country = loc.country;
  if (emptyToUndefined(loc.province)) location.province = loc.province;
  if (emptyToUndefined(loc.district)) location.district = loc.district;
  const salary: Job['salary'] = { currency: s.currency, visible: s.visible };
  if (typeof s.minimum === 'number') salary.minimum = s.minimum;
  if (typeof s.maximum === 'number') salary.maximum = s.maximum;
  const applicationSettings: Job['applicationSettings'] = {
    positionsAvailable: a.positions_available,
    requireCoverLetter: a.require_cover_letter,
  };
  const deadline = dateOrUndefined(a.application_deadline);
  if (deadline) applicationSettings.applicationDeadline = deadline;
  if (emptyToUndefined(a.resume_template_id)) applicationSettings.resumeTemplateId = a.resume_template_id;

  const job: Job = {
    id: msg.id,
    recruiterId: msg.recruiter_id,
    companyId: msg.company_id,
    title: msg.title,
    description: msg.description,
    requirements: {
      requiredSkills: (r.required_skills ?? []).map((x: Msg) => ({
        name: x.name,
        level: fromEnum(PREFIX.level, x.level) ?? 'BASIC',
        minimumYears: x.minimum_years ?? 0,
      })),
      preferredSkills: (r.preferred_skills ?? []).map((x: Msg) => ({ name: x.name, level: fromEnum(PREFIX.level, x.level) ?? 'BASIC' })),
      minimumExperienceYears: r.minimum_experience_years ?? 0,
      educationLevel: fromEnum(PREFIX.education, r.education_level) ?? 'NONE',
      acceptedFields: r.accepted_fields ?? [],
    },
    responsibilities: msg.responsibilities ?? [],
    employmentType: fromEnum(PREFIX.employment, msg.employment_type),
    workArrangement: fromEnum(PREFIX.arrangement, msg.work_arrangement),
    location,
    salary,
    applicationSettings,
    status: fromEnum<JobStatus>(PREFIX.status, msg.status) ?? 'DRAFT',
    publishedAt: dateOrUndefined(msg.published_at),
    createdAt: new Date(msg.created_at),
    updatedAt: new Date(msg.updated_at),
  };
  return job;
}

/**
 * Proto JobInput -> the raw camelCase object validateJobInput expects.
 * Values are not checked here; validation reports anything wrong.
 */
export function fromProtoJobInput(msg: Msg | undefined): Record<string, unknown> {
  const m = msg ?? {};
  const r = m.requirements ?? {};
  const loc = m.location ?? {};
  const s = m.salary ?? {};
  return {
    title: m.title,
    description: m.description,
    requirements: {
      requiredSkills: (r.required_skills ?? []).map((x: Msg) => ({
        name: x.name,
        level: fromEnum(PREFIX.level, x.level),
        minimumYears: x.minimum_years,
      })),
      preferredSkills: (r.preferred_skills ?? []).map((x: Msg) => ({ name: x.name, level: fromEnum(PREFIX.level, x.level) })),
      minimumExperienceYears: r.minimum_experience_years,
      educationLevel: fromEnum(PREFIX.education, r.education_level),
      acceptedFields: r.accepted_fields ?? [],
    },
    responsibilities: m.responsibilities ?? [],
    employmentType: fromEnum(PREFIX.employment, m.employment_type),
    workArrangement: fromEnum(PREFIX.arrangement, m.work_arrangement),
    location: {
      country: emptyToUndefined(loc.country),
      province: emptyToUndefined(loc.province),
      district: emptyToUndefined(loc.district),
    },
    salary: {
      minimum: typeof s.minimum === 'number' ? s.minimum : undefined,
      maximum: typeof s.maximum === 'number' ? s.maximum : undefined,
      currency: emptyToUndefined(s.currency),
      visible: s.visible,
    },
    applicationDeadline: emptyToUndefined(m.application_deadline),
    positionsAvailable: m.positions_available,
    requireCoverLetter: m.require_cover_letter,
  };
}

export function fromProtoStatus(value: unknown): JobStatus | undefined {
  return fromEnum<JobStatus>(PREFIX.status, value);
}

export function toProtoTemplate(t: ResumeTemplate): Msg {
  return {
    id: t.id,
    job_id: t.jobId,
    file_name: t.fileName,
    content_type: t.contentType,
    size_bytes: t.sizeBytes,
    content: t.content ?? Buffer.alloc(0),
    created_at: iso(t.createdAt),
  };
}
