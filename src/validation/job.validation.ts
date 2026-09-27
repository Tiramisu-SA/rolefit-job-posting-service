import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  SKILL_LEVELS,
  WORK_ARRANGEMENTS,
  type Job,
  type JobInput,
  type Location,
  type PreferredSkill,
  type RequiredSkill,
  type Requirements,
  type Salary,
} from '../types/job.types';
import { ValidationError, type FieldError } from '../utils/errors';

type Body = Record<string, unknown>;

/** Collects field errors while reading untrusted input. */
class Checker {
  readonly errors: FieldError[] = [];

  fail(field: string, message: string): void {
    this.errors.push({ field, message });
  }

  object(value: unknown, field: string): Body {
    if (value === undefined || value === null) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value as Body;
    this.fail(field, 'Must be an object');
    return {};
  }

  /** Trimmed string, or undefined when missing/empty. */
  optionalString(value: unknown, field: string, max: number): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
      this.fail(field, 'Must be text');
      return undefined;
    }
    const s = value.trim();
    if (s === '') return undefined;
    if (s.length > max) this.fail(field, `Must be at most ${max} characters`);
    return s;
  }

  requiredString(value: unknown, field: string, max: number): string {
    const s = this.optionalString(value, field, max);
    if (s === undefined) {
      this.fail(field, 'Is required');
      return '';
    }
    return s;
  }

  stringList(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      this.fail(field, 'Must be a list');
      return [];
    }
    const out: string[] = [];
    value.forEach((item, i) => {
      const s = this.optionalString(item, `${field}[${i}]`, maxLength);
      if (s !== undefined) out.push(s);
    });
    if (out.length > maxItems) this.fail(field, `At most ${maxItems} items`);
    return out;
  }

  /** Enum value; undefined or '' means "not set". */
  optionalEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
    const s = this.optionalString(value, field, 50);
    if (s === undefined) return undefined;
    if (!allowed.includes(s as T)) {
      this.fail(field, `Must be one of ${allowed.join(', ')}`);
      return undefined;
    }
    return s as T;
  }

  number(value: unknown, field: string, min: number, max: number, opts: { integer?: boolean } = {}): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.fail(field, 'Must be a number');
      return undefined;
    }
    if (opts.integer && !Number.isInteger(value)) this.fail(field, 'Must be a whole number');
    if (value < min || value > max) this.fail(field, `Must be between ${min} and ${max}`);
    return value;
  }

  boolean(value: unknown, field: string, fallback: boolean): boolean {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'boolean') {
      this.fail(field, 'Must be true or false');
      return fallback;
    }
    return value;
  }

  list(value: unknown, field: string, max: number): unknown[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      this.fail(field, 'Must be a list');
      return [];
    }
    if (value.length > max) this.fail(field, `At most ${max} items`);
    return value;
  }
}

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function checkRequirements(c: Checker, raw: unknown): Requirements {
  const b = c.object(raw, 'requirements');
  const seen = new Set<string>();
  const uniqueName = (name: string, field: string) => {
    const key = name.toLowerCase();
    if (name && seen.has(key)) c.fail(field, `"${name}" is listed more than once`);
    seen.add(key);
  };

  const requiredSkills: RequiredSkill[] = c.list(b.requiredSkills, 'requirements.requiredSkills', 30).map((item, i) => {
    const path = `requirements.requiredSkills[${i}]`;
    const s = c.object(item, path);
    const skill = {
      name: c.requiredString(s.name, `${path}.name`, 100),
      level: c.optionalEnum(s.level, `${path}.level`, SKILL_LEVELS) ?? 'BASIC',
      minimumYears: c.number(s.minimumYears, `${path}.minimumYears`, 0, 50, { integer: true }) ?? 0,
    };
    uniqueName(skill.name, `${path}.name`);
    return skill;
  });

  const preferredSkills: PreferredSkill[] = c.list(b.preferredSkills, 'requirements.preferredSkills', 30).map((item, i) => {
    const path = `requirements.preferredSkills[${i}]`;
    const s = c.object(item, path);
    const skill = {
      name: c.requiredString(s.name, `${path}.name`, 100),
      level: c.optionalEnum(s.level, `${path}.level`, SKILL_LEVELS) ?? 'BASIC',
    };
    uniqueName(skill.name, `${path}.name`);
    return skill;
  });

  return {
    requiredSkills,
    preferredSkills,
    minimumExperienceYears:
      c.number(b.minimumExperienceYears, 'requirements.minimumExperienceYears', 0, 50, { integer: true }) ?? 0,
    educationLevel: c.optionalEnum(b.educationLevel, 'requirements.educationLevel', EDUCATION_LEVELS) ?? 'NONE',
    acceptedFields: c.stringList(b.acceptedFields, 'requirements.acceptedFields', 20, 100),
  };
}

function checkLocation(c: Checker, raw: unknown): Location {
  const b = c.object(raw, 'location');
  return {
    country: c.optionalString(b.country, 'location.country', 100),
    province: c.optionalString(b.province, 'location.province', 100),
    district: c.optionalString(b.district, 'location.district', 100),
  };
}

function checkSalary(c: Checker, raw: unknown): Salary {
  const b = c.object(raw, 'salary');
  const salary: Salary = {
    minimum: c.number(b.minimum, 'salary.minimum', 0, Number.MAX_SAFE_INTEGER),
    maximum: c.number(b.maximum, 'salary.maximum', 0, Number.MAX_SAFE_INTEGER),
    currency: c.optionalString(b.currency, 'salary.currency', 20) ?? 'THB',
    visible: c.boolean(b.visible, 'salary.visible', true),
  };
  if (salary.minimum !== undefined && salary.maximum !== undefined && salary.minimum > salary.maximum) {
    c.fail('salary.maximum', 'Must be at least the minimum');
  }
  if (!/^[A-Z]{3}$/.test(salary.currency)) c.fail('salary.currency', 'Must be a 3-letter currency code, e.g. THB');
  return salary;
}

function checkDeadline(c: Checker, value: unknown): Date | undefined {
  const s = c.optionalString(value, 'applicationDeadline', 40);
  if (s === undefined) return undefined;
  const date = new Date(s);
  if (!ISO_DATETIME_RE.test(s) || Number.isNaN(date.getTime())) {
    c.fail('applicationDeadline', 'Must be an ISO-8601 date and time, e.g. 2026-10-31T16:59:59Z');
    return undefined;
  }
  return date;
}

/**
 * Validates the editable fields of a job (create and update) and applies the
 * draft defaults. A draft only needs a title; publishing checks more
 * (see assertPublishable).
 */
export function validateJobInput(raw: unknown): JobInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError([{ field: 'body', message: 'Must be an object' }]);
  }
  const b = raw as Body;
  const c = new Checker();
  const input: JobInput = {
    title: c.requiredString(b.title, 'title', 200),
    description: c.optionalString(b.description, 'description', 10_000) ?? '',
    requirements: checkRequirements(c, b.requirements),
    responsibilities: c.stringList(b.responsibilities, 'responsibilities', 30, 500),
    employmentType: c.optionalEnum(b.employmentType, 'employmentType', EMPLOYMENT_TYPES),
    workArrangement: c.optionalEnum(b.workArrangement, 'workArrangement', WORK_ARRANGEMENTS),
    location: checkLocation(c, b.location),
    salary: checkSalary(c, b.salary),
    applicationDeadline: checkDeadline(c, b.applicationDeadline),
    positionsAvailable: 1,
    requireCoverLetter: c.boolean(b.requireCoverLetter, 'requireCoverLetter', false),
  };
  // 0 means "not set" (proto3 default).
  if (b.positionsAvailable !== 0) {
    input.positionsAvailable = c.number(b.positionsAvailable, 'positionsAvailable', 1, 1000, { integer: true }) ?? 1;
  }
  if (c.errors.length > 0) throw new ValidationError(c.errors);
  return input;
}

/** Everything a job needs before candidates can see it. */
export function assertPublishable(job: Job, now: Date): void {
  const errors: FieldError[] = [];
  const need = (ok: unknown, field: string, message: string) => {
    if (!ok) errors.push({ field, message });
  };
  need(job.description.trim(), 'description', 'Add a description before publishing');
  need(job.requirements.requiredSkills.length > 0, 'requirements.requiredSkills', 'Add at least one required skill');
  need(job.employmentType, 'employmentType', 'Choose an employment type');
  need(job.workArrangement, 'workArrangement', 'Choose a work arrangement');
  need(job.location.country, 'location.country', 'Add the country');
  need(job.location.province, 'location.province', 'Add the province');
  const deadline = job.applicationSettings.applicationDeadline;
  need(!deadline || deadline > now, 'applicationSettings.applicationDeadline', 'The deadline has already passed');
  need(job.applicationSettings.positionsAvailable >= 1, 'applicationSettings.positionsAvailable', 'At least 1 position');
  if (errors.length > 0) throw new ValidationError(errors);
}
