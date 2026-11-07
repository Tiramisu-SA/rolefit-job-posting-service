import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromProtoJob, fromProtoJobInput, fromProtoStatus, toProtoJob } from '../src/grpc/job.mapper';
import type { Job } from '../src/types/job.types';

const JOB: Job = {
  id: 'job_1',
  recruiterId: 'user_1',
  companyId: 'co-1',
  title: 'Backend',
  description: 'Build services',
  requirements: {
    requiredSkills: [{ name: 'Go', level: 'INTERMEDIATE', minimumYears: 2 }],
    preferredSkills: [{ name: 'Docker', level: 'BASIC' }],
    minimumExperienceYears: 1,
    educationLevel: 'BACHELOR',
    acceptedFields: ['Computer Science'],
  },
  responsibilities: ['Ship code'],
  employmentType: 'FULL_TIME',
  workArrangement: 'HYBRID',
  location: { country: 'Thailand', province: 'Bangkok', district: 'Pathum Wan' },
  salary: { minimum: 0, maximum: 50000, currency: 'THB', visible: true },
  applicationSettings: {
    applicationDeadline: new Date('2026-10-31T16:59:59.000Z'),
    positionsAvailable: 2,
    resumeTemplateId: 'template_1',
    requireCoverLetter: true,
  },
  status: 'OPEN',
  publishedAt: new Date('2026-09-21T06:00:00.000Z'),
  createdAt: new Date('2026-09-20T10:30:00.000Z'),
  updatedAt: new Date('2026-09-21T06:00:00.000Z'),
};

test('toProtoJob prefixes enums and writes ISO strings', () => {
  const msg = toProtoJob(JOB);
  assert.equal(msg.status, 'JOB_STATUS_OPEN');
  assert.equal(msg.employment_type, 'EMPLOYMENT_TYPE_FULL_TIME');
  assert.equal(msg.work_arrangement, 'WORK_ARRANGEMENT_HYBRID');
  assert.equal(msg.requirements.education_level, 'EDUCATION_LEVEL_BACHELOR');
  assert.equal(msg.requirements.required_skills[0].level, 'SKILL_LEVEL_INTERMEDIATE');
  assert.equal(msg.application_settings.application_deadline, '2026-10-31T16:59:59.000Z');
  assert.equal(msg.published_at, '2026-09-21T06:00:00.000Z');
  assert.equal(msg.salary.minimum, 0);
});

test('a domain job survives the trip to proto and back', () => {
  assert.deepEqual(fromProtoJob(toProtoJob(JOB)), JOB);
});

test('unset values become "" / UNSPECIFIED in proto and undefined again on the way back', () => {
  const sparse: Job = {
    ...JOB,
    employmentType: undefined,
    workArrangement: undefined,
    location: {},
    salary: { currency: 'THB', visible: false },
    applicationSettings: { positionsAvailable: 1, requireCoverLetter: false },
    status: 'DRAFT',
    publishedAt: undefined,
  };
  const msg = toProtoJob(sparse);
  assert.equal(msg.employment_type, 'EMPLOYMENT_TYPE_UNSPECIFIED');
  assert.equal(msg.published_at, '');
  assert.equal('minimum' in msg.salary, false);
  assert.deepEqual(fromProtoJob(msg), sparse);
});

test('fromProtoJobInput strips prefixes and turns UNSPECIFIED / "" into undefined', () => {
  const input = fromProtoJobInput({
    title: 'T',
    description: '',
    requirements: {
      required_skills: [{ name: 'Go', level: 'SKILL_LEVEL_UNSPECIFIED', minimum_years: 0 }],
      preferred_skills: [],
      minimum_experience_years: 0,
      education_level: 'EDUCATION_LEVEL_MASTER',
      accepted_fields: [],
    },
    responsibilities: [],
    employment_type: 'EMPLOYMENT_TYPE_UNSPECIFIED',
    work_arrangement: 'WORK_ARRANGEMENT_REMOTE',
    location: { country: 'Thailand', province: '', district: '' },
    salary: { maximum: 1000, currency: 'THB', visible: true },
    application_deadline: '',
    positions_available: 0,
    require_cover_letter: false,
  });
  assert.deepEqual(input, {
    title: 'T',
    description: '',
    requirements: {
      requiredSkills: [{ name: 'Go', level: undefined, minimumYears: 0 }],
      preferredSkills: [],
      minimumExperienceYears: 0,
      educationLevel: 'MASTER',
      acceptedFields: [],
    },
    responsibilities: [],
    employmentType: undefined,
    workArrangement: 'REMOTE',
    location: { country: 'Thailand', province: undefined, district: undefined },
    salary: { minimum: undefined, maximum: 1000, currency: 'THB', visible: true },
    applicationDeadline: undefined,
    positionsAvailable: 0,
    requireCoverLetter: false,
  });
});

test('fromProtoStatus maps UNSPECIFIED and "" to undefined', () => {
  assert.equal(fromProtoStatus('JOB_STATUS_UNSPECIFIED'), undefined);
  assert.equal(fromProtoStatus(''), undefined);
  assert.equal(fromProtoStatus('JOB_STATUS_CLOSED'), 'CLOSED');
});
