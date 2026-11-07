import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublishable, validateJobInput } from '../src/validation/job.validation';
import { ValidationError } from '../src/utils/errors';
import type { Job } from '../src/types/job.types';

function failingFields(fn: () => unknown): string[] {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError, `expected ValidationError, got ${String(err)}`);
    return err.details.map((d) => d.field);
  }
  assert.fail('expected a ValidationError');
}

test('a draft needs only a title and gets defaults', () => {
  const input = validateJobInput({ title: '  Backend Engineer ' });
  assert.deepEqual(input, {
    title: 'Backend Engineer',
    description: '',
    requirements: { requiredSkills: [], preferredSkills: [], minimumExperienceYears: 0, educationLevel: 'NONE', acceptedFields: [] },
    responsibilities: [],
    employmentType: undefined,
    workArrangement: undefined,
    location: { country: undefined, province: undefined, district: undefined },
    salary: { minimum: undefined, maximum: undefined, currency: 'THB', visible: true },
    applicationDeadline: undefined,
    positionsAvailable: 1,
    requireCoverLetter: false,
  });
});

test('title is required and limited to 200 characters', () => {
  assert.deepEqual(failingFields(() => validateJobInput({ title: ' ' })), ['title']);
  assert.deepEqual(failingFields(() => validateJobInput({ title: 'x'.repeat(201) })), ['title']);
});

test('a body that is not an object fails with a single body error', () => {
  assert.deepEqual(failingFields(() => validateJobInput(null)), ['body']);
});

test('skills: level defaults to BASIC, bad level and years are rejected', () => {
  const input = validateJobInput({ title: 'T', requirements: { requiredSkills: [{ name: 'Go' }] } });
  assert.deepEqual(input.requirements.requiredSkills, [{ name: 'Go', level: 'BASIC', minimumYears: 0 }]);
  assert.deepEqual(
    failingFields(() =>
      validateJobInput({ title: 'T', requirements: { requiredSkills: [{ name: 'Go', level: 'GURU', minimumYears: 51 }] } }),
    ),
    ['requirements.requiredSkills[0].level', 'requirements.requiredSkills[0].minimumYears'],
  );
});

test('skills: a name repeated within or across lists (ignoring case) is rejected', () => {
  assert.deepEqual(
    failingFields(() =>
      validateJobInput({
        title: 'T',
        requirements: {
          requiredSkills: [{ name: 'Python' }, { name: 'python' }],
          preferredSkills: [{ name: 'PYTHON' }],
        },
      }),
    ),
    ['requirements.requiredSkills[1].name', 'requirements.preferredSkills[0].name'],
  );
});

test('more than 30 responsibilities is rejected', () => {
  const responsibilities = Array.from({ length: 31 }, (_, i) => `r${i}`);
  assert.deepEqual(failingFields(() => validateJobInput({ title: 'T', responsibilities })), ['responsibilities']);
});

test('enums must be known values', () => {
  assert.deepEqual(
    failingFields(() =>
      validateJobInput({ title: 'T', employmentType: 'FREELANCE', workArrangement: 'MOON', requirements: { educationLevel: 'PHD' } }),
    ),
    ['requirements.educationLevel', 'employmentType', 'workArrangement'],
  );
});

test('salary: minimum above maximum, negative amounts and bad currency are rejected', () => {
  assert.deepEqual(
    failingFields(() => validateJobInput({ title: 'T', salary: { minimum: 50000, maximum: 30000, currency: 'baht' } })),
    ['salary.maximum', 'salary.currency'],
  );
  assert.deepEqual(failingFields(() => validateJobInput({ title: 'T', salary: { minimum: -1 } })), ['salary.minimum']);
});

test('deadline must be a valid ISO datetime; positions must be 1-1000', () => {
  assert.deepEqual(
    failingFields(() => validateJobInput({ title: 'T', applicationDeadline: 'next friday', positionsAvailable: 1001 })),
    ['applicationDeadline', 'positionsAvailable'],
  );
  const ok = validateJobInput({ title: 'T', applicationDeadline: '2026-10-31T16:59:59Z', positionsAvailable: 0 });
  assert.equal(ok.applicationDeadline?.toISOString(), '2026-10-31T16:59:59.000Z');
  assert.equal(ok.positionsAvailable, 1);
});

const NOW = new Date('2026-09-27T00:00:00Z');

function draftJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job_1',
    recruiterId: 'user_1',
    companyId: 'co-1',
    title: 'Backend',
    description: 'Build services',
    requirements: {
      requiredSkills: [{ name: 'Go', level: 'BASIC', minimumYears: 0 }],
      preferredSkills: [],
      minimumExperienceYears: 0,
      educationLevel: 'NONE',
      acceptedFields: [],
    },
    responsibilities: [],
    employmentType: 'FULL_TIME',
    workArrangement: 'HYBRID',
    location: { country: 'Thailand', province: 'Bangkok' },
    salary: { currency: 'THB', visible: true },
    applicationSettings: { positionsAvailable: 1, requireCoverLetter: false },
    status: 'DRAFT',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

test('assertPublishable accepts a complete job', () => {
  assertPublishable(draftJob(), NOW);
});

test('assertPublishable lists every missing field', () => {
  const job = draftJob({
    description: '',
    requirements: { requiredSkills: [], preferredSkills: [], minimumExperienceYears: 0, educationLevel: 'NONE', acceptedFields: [] },
    employmentType: undefined,
    workArrangement: undefined,
    location: {},
  });
  assert.deepEqual(failingFields(() => assertPublishable(job, NOW)), [
    'description',
    'requirements.requiredSkills',
    'employmentType',
    'workArrangement',
    'location.country',
    'location.province',
  ]);
});

test('assertPublishable rejects a deadline in the past', () => {
  const job = draftJob({
    applicationSettings: { positionsAvailable: 1, requireCoverLetter: false, applicationDeadline: new Date('2026-09-01T00:00:00Z') },
  });
  assert.deepEqual(failingFields(() => assertPublishable(job, NOW)), ['applicationSettings.applicationDeadline']);
});
