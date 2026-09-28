import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobService } from '../src/services/job.service';
import { InMemoryJobRepository } from './fakes/in-memory-job.repository';
import { StubAIModelAdapter } from '../src/adapters/ai/ai.adapter';
import { AppError, type ErrorCode } from '../src/utils/errors';
import type { Caller } from '../src/types/job.types';

const ACME: Caller = { userId: 'user_a', role: 'recruiter', companyId: 'co-acme' };
const OTHER: Caller = { userId: 'user_b', role: 'recruiter', companyId: 'co-other' };

const COMPLETE = {
  title: 'Backend Engineer',
  description: 'Build services',
  requirements: { requiredSkills: [{ name: 'Go', level: 'INTERMEDIATE', minimumYears: 1 }] },
  employmentType: 'FULL_TIME',
  workArrangement: 'HYBRID',
  location: { country: 'Thailand', province: 'Bangkok' },
  applicationDeadline: '2026-12-31T00:00:00Z',
};

function setup(start = '2026-09-27T00:00:00Z') {
  const clock = { now: new Date(start) };
  const repo = new InMemoryJobRepository();
  let seq = 0;
  const service = new JobService(repo, new StubAIModelAdapter(), () => clock.now, (prefix) => `${prefix}_${++seq}`);
  const tick = (ms = 1000) => (clock.now = new Date(clock.now.getTime() + ms));
  return { service, repo, clock, tick };
}

async function rejectsWith(promise: Promise<unknown>, code: ErrorCode) {
  await assert.rejects(promise, (err: unknown) => err instanceof AppError && err.code === code);
}

test('createJob makes a DRAFT owned by the caller; no caller is UNAUTHORIZED', async () => {
  const { service } = setup();
  const job = await service.createJob(ACME, { title: 'Backend' });
  assert.equal(job.id, 'job_1');
  assert.equal(job.status, 'DRAFT');
  assert.equal(job.recruiterId, 'user_a');
  assert.equal(job.companyId, 'co-acme');
  await rejectsWith(service.createJob(null, { title: 'Backend' }), 'UNAUTHORIZED');
});

test('lifecycle: publish, close, reopen; publishedAt is set only the first time', async () => {
  const { service, tick } = setup();
  const job = await service.createJob(ACME, COMPLETE);
  const open = await service.publishJob(ACME, job.id);
  assert.equal(open.status, 'OPEN');
  const firstPublishedAt = open.publishedAt;
  tick();
  assert.equal((await service.closeJob(ACME, job.id)).status, 'CLOSED');
  tick();
  const reopened = await service.reopenJob(ACME, job.id);
  assert.equal(reopened.status, 'OPEN');
  assert.deepEqual(reopened.publishedAt, firstPublishedAt);
});

test('lifecycle: illegal transitions are INVALID_STATE', async () => {
  const { service } = setup();
  const job = await service.createJob(ACME, COMPLETE);
  await rejectsWith(service.closeJob(ACME, job.id), 'INVALID_STATE');
  await rejectsWith(service.reopenJob(ACME, job.id), 'INVALID_STATE');
  await service.publishJob(ACME, job.id);
  await rejectsWith(service.publishJob(ACME, job.id), 'INVALID_STATE');
  await rejectsWith(service.reopenJob(ACME, job.id), 'INVALID_STATE');
});

test('publish needs a complete job', async () => {
  const { service } = setup();
  const job = await service.createJob(ACME, { title: 'Backend' });
  await rejectsWith(service.publishJob(ACME, job.id), 'VALIDATION_ERROR');
});

test('reopen with a past deadline is INVALID_STATE; updating the deadline fixes it', async () => {
  const { service, clock } = setup();
  const job = await service.createJob(ACME, COMPLETE);
  await service.publishJob(ACME, job.id);
  await service.closeJob(ACME, job.id);
  clock.now = new Date('2027-01-15T00:00:00Z');
  await rejectsWith(service.reopenJob(ACME, job.id), 'INVALID_STATE');
  await service.updateJob(ACME, job.id, { ...COMPLETE, applicationDeadline: '2027-03-01T00:00:00Z' });
  assert.equal((await service.reopenJob(ACME, job.id)).status, 'OPEN');
});

test('updateJob on an OPEN job keeps status, publishedAt, owner and template', async () => {
  const { service } = setup();
  const job = await service.createJob(ACME, COMPLETE);
  await service.attachResumeTemplate(ACME, job.id, { fileName: 't.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF') });
  const open = await service.publishJob(ACME, job.id);
  const updated = await service.updateJob(ACME, job.id, { ...COMPLETE, title: 'Senior Backend Engineer' });
  assert.equal(updated.title, 'Senior Backend Engineer');
  assert.equal(updated.status, 'OPEN');
  assert.deepEqual(updated.publishedAt, open.publishedAt);
  assert.equal(updated.recruiterId, 'user_a');
  assert.equal(updated.companyId, 'co-acme');
  assert.equal(updated.applicationSettings.resumeTemplateId, open.applicationSettings.resumeTemplateId);
});

test('ownership: another company gets FORBIDDEN on a visible job and NOT_FOUND on a draft', async () => {
  const { service } = setup();
  const draft = await service.createJob(ACME, COMPLETE);
  await rejectsWith(service.updateJob(OTHER, draft.id, COMPLETE), 'NOT_FOUND');
  await rejectsWith(service.getJob(OTHER, draft.id), 'NOT_FOUND');
  await rejectsWith(service.getJob(null, draft.id), 'NOT_FOUND');
  await service.publishJob(ACME, draft.id);
  await rejectsWith(service.closeJob(OTHER, draft.id), 'FORBIDDEN');
  await rejectsWith(service.closeJob(null, draft.id), 'UNAUTHORIZED');
  assert.equal((await service.getJob(null, draft.id)).status, 'OPEN');
});

test('deleteJob works only for drafts and removes the template', async () => {
  const { service, repo } = setup();
  const job = await service.createJob(ACME, COMPLETE);
  await service.attachResumeTemplate(ACME, job.id, { fileName: 't.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF') });
  await service.deleteJob(ACME, job.id);
  await rejectsWith(service.getJob(ACME, job.id), 'NOT_FOUND');
  assert.equal(repo.templates.size, 0);

  const open = await service.createJob(ACME, COMPLETE);
  await service.publishJob(ACME, open.id);
  await rejectsWith(service.deleteJob(ACME, open.id), 'INVALID_STATE');
});

test('listJobs: other companies never see drafts; owner sees own drafts', async () => {
  const { service, tick } = setup();
  const a = await service.createJob(ACME, COMPLETE);
  tick();
  const b = await service.createJob(ACME, { ...COMPLETE, title: 'Frontend Engineer' });
  await service.publishJob(ACME, b.id);

  const mine = await service.listJobs(ACME, { companyId: 'co-acme' });
  assert.deepEqual(mine.items.map((j) => j.id).sort(), [a.id, b.id].sort());
  const theirs = await service.listJobs(OTHER, { companyId: 'co-acme' });
  assert.deepEqual(theirs.items.map((j) => j.id), [b.id]);
  const anon = await service.listJobs(null, {});
  assert.deepEqual(anon.items.map((j) => j.id), [b.id]);
});

test('listJobs: status filter, literal text query, and page/limit normalization', async () => {
  const { service } = setup();
  const cpp = await service.createJob(ACME, { ...COMPLETE, title: 'C++ Developer', requirements: { requiredSkills: [{ name: 'C++' }] } });
  await service.publishJob(ACME, cpp.id);
  const go = await service.createJob(ACME, COMPLETE);
  await service.publishJob(ACME, go.id);

  assert.deepEqual((await service.listJobs(null, { query: 'c++' })).items.map((j) => j.id), [cpp.id]);
  assert.deepEqual((await service.listJobs(null, { query: '.*' })).items, []);
  assert.deepEqual((await service.listJobs(null, { query: 'go' })).items.map((j) => j.id), [go.id]);
  assert.equal((await service.listJobs(ACME, { companyId: 'co-acme', status: 'DRAFT' })).total, 0);

  const defaults = await service.listJobs(null, { page: 0, limit: -5 });
  assert.equal(defaults.page, 1);
  assert.equal(defaults.limit, 20);
  assert.equal((await service.listJobs(null, { limit: 500 })).limit, 100);
  const page2 = await service.listJobs(null, { page: 2, limit: 1 });
  assert.equal(page2.items.length, 1);
  assert.equal(page2.total, 2);
});

test('resume template: attach sets the id, replaces the old one, get and delete', async () => {
  const { service, repo } = setup();
  const job = await service.createJob(ACME, COMPLETE);
  const first = await service.attachResumeTemplate(ACME, job.id, { fileName: 'a.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF') });
  const second = await service.attachResumeTemplate(ACME, job.id, {
    fileName: 'b.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    content: Buffer.from('PK'),
  });
  assert.notEqual(first.id, second.id);
  assert.equal(repo.templates.size, 1);
  assert.equal((await service.getJob(ACME, job.id)).applicationSettings.resumeTemplateId, second.id);

  const meta = await service.getResumeTemplate(null, job.id, false).catch((e) => e);
  assert.ok(meta instanceof AppError && meta.code === 'NOT_FOUND', 'draft template hidden from others');
  const own = await service.getResumeTemplate(ACME, job.id, true);
  assert.equal(own.fileName, 'b.docx');
  assert.deepEqual(own.content, Buffer.from('PK'));
  assert.equal((await service.getResumeTemplate(ACME, job.id, false)).content, undefined);

  await service.deleteResumeTemplate(ACME, job.id);
  assert.equal((await service.getJob(ACME, job.id)).applicationSettings.resumeTemplateId, undefined);
  await rejectsWith(service.getResumeTemplate(ACME, job.id, false), 'NOT_FOUND');
  await rejectsWith(service.deleteResumeTemplate(ACME, job.id), 'NOT_FOUND');
});

test('resume template: wrong type, empty or over 2 MB is VALIDATION_ERROR and the job is unchanged', async () => {
  const { service } = setup();
  const job = await service.createJob(ACME, COMPLETE);
  await rejectsWith(
    service.attachResumeTemplate(ACME, job.id, { fileName: 'a.png', contentType: 'image/png', content: Buffer.from('x') }),
    'VALIDATION_ERROR',
  );
  await rejectsWith(
    service.attachResumeTemplate(ACME, job.id, { fileName: 'a.pdf', contentType: 'application/pdf', content: Buffer.alloc(0) }),
    'VALIDATION_ERROR',
  );
  await rejectsWith(
    service.attachResumeTemplate(ACME, job.id, {
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      content: Buffer.alloc(2 * 1024 * 1024 + 1),
    }),
    'VALIDATION_ERROR',
  );
  assert.equal((await service.getJob(ACME, job.id)).applicationSettings.resumeTemplateId, undefined);
});
