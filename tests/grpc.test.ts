import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { startGrpcServer } from '../src/grpc/grpc.server';
import { JobService } from '../src/services/job.service';
import { StubAIModelAdapter } from '../src/adapters/ai/ai.adapter';
import { InMemoryJobRepository } from './fakes/in-memory-job.repository';

type Call = (method: string, request: object, identity?: { userId: string; companyId: string }) => Promise<any>;

const ACME = { userId: 'user_a', companyId: 'co-acme' };
const OTHER = { userId: 'user_b', companyId: 'co-other' };

const COMPLETE_INPUT = {
  title: 'Backend Engineer',
  description: 'Build services',
  requirements: { required_skills: [{ name: 'Python', level: 'SKILL_LEVEL_INTERMEDIATE', minimum_years: 1 }] },
  employment_type: 'EMPLOYMENT_TYPE_FULL_TIME',
  work_arrangement: 'WORK_ARRANGEMENT_HYBRID',
  location: { country: 'Thailand', province: 'Bangkok', district: 'Pathum Wan' },
  salary: { minimum: 0, currency: 'THB', visible: true },
  application_deadline: '2099-10-31T16:59:59Z',
  positions_available: 2,
};

async function withClient(fn: (call: Call) => Promise<void>) {
  const service = new JobService(new InMemoryJobRepository(), new StubAIModelAdapter());
  const { server, port } = await startGrpcServer(service, '127.0.0.1', 0);
  const def = protoLoader.loadSync(path.resolve(__dirname, '../proto/job-posting.proto'), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const pkg = grpc.loadPackageDefinition(def) as any;
  const client = new pkg.rolefit.jobposting.v1.JobPostingService(`127.0.0.1:${port}`, grpc.credentials.createInsecure());
  const call: Call = (method, request, identity) =>
    new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      if (identity) {
        metadata.set('x-user-id', identity.userId);
        metadata.set('x-company-id', identity.companyId);
      }
      client[method](request, metadata, (err: grpc.ServiceError | null, res: unknown) => (err ? reject(err) : resolve(res)));
    });
  try {
    await fn(call);
  } finally {
    client.close();
    server.forceShutdown();
  }
}

const hasCode = (code: grpc.status) => (err: grpc.ServiceError) => err.code === code;

test('CreateJob needs identity metadata', async () => {
  await withClient(async (call) => {
    await assert.rejects(call('CreateJob', { job: { title: 'T' } }), hasCode(grpc.status.UNAUTHENTICATED));
  });
});

test('CreateJob validation errors are INVALID_ARGUMENT with x-validation-errors', async () => {
  await withClient(async (call) => {
    await assert.rejects(call('CreateJob', { job: { title: '' } }, ACME), (err: grpc.ServiceError) => {
      assert.equal(err.code, grpc.status.INVALID_ARGUMENT);
      const [raw] = err.metadata.get('x-validation-errors');
      assert.deepEqual(JSON.parse(String(raw)).map((d: { field: string }) => d.field), ['title']);
      return true;
    });
  });
});

test('full lifecycle over gRPC with visibility and ownership', async () => {
  await withClient(async (call) => {
    const { job } = await call('CreateJob', { job: COMPLETE_INPUT }, ACME);
    assert.match(job.id, /^job_/);
    assert.equal(job.status, 'JOB_STATUS_DRAFT');
    assert.equal(job.company_id, 'co-acme');
    assert.equal(job.salary.minimum, 0);
    assert.equal(job.salary.maximum, undefined);
    assert.equal(job.application_settings.positions_available, 2);

    await assert.rejects(call('GetJob', { job_id: job.id }), hasCode(grpc.status.NOT_FOUND));
    await assert.rejects(call('UpdateJob', { job_id: job.id, job: COMPLETE_INPUT }, OTHER), hasCode(grpc.status.NOT_FOUND));

    const published = await call('PublishJob', { job_id: job.id }, ACME);
    assert.equal(published.job.status, 'JOB_STATUS_OPEN');
    assert.notEqual(published.job.published_at, '');

    const read = await call('GetJob', { job_id: job.id });
    assert.equal(read.job.requirements.required_skills[0].level, 'SKILL_LEVEL_INTERMEDIATE');
    assert.equal(read.job.location.district, 'Pathum Wan');

    const list = await call('ListJobs', { query: 'python' });
    assert.equal(list.total, 1);
    assert.equal(list.page, 1);
    assert.equal(list.limit, 20);

    await assert.rejects(call('CloseJob', { job_id: job.id }, OTHER), hasCode(grpc.status.PERMISSION_DENIED));
    await assert.rejects(call('DeleteJob', { job_id: job.id }, ACME), hasCode(grpc.status.FAILED_PRECONDITION));
    assert.equal((await call('CloseJob', { job_id: job.id }, ACME)).job.status, 'JOB_STATUS_CLOSED');
    assert.equal((await call('ReopenJob', { job_id: job.id }, ACME)).job.status, 'JOB_STATUS_OPEN');
  });
});

test('ListJobs filters by status and company; drafts only for the owner', async () => {
  await withClient(async (call) => {
    await call('CreateJob', { job: { title: 'Draft' } }, ACME);
    const mine = await call('ListJobs', { company_id: 'co-acme', status: 'JOB_STATUS_DRAFT' }, ACME);
    assert.equal(mine.total, 1);
    const theirs = await call('ListJobs', { company_id: 'co-acme' }, OTHER);
    assert.equal(theirs.total, 0);
  });
});

test('DeleteJob removes a draft', async () => {
  await withClient(async (call) => {
    const { job } = await call('CreateJob', { job: { title: 'Draft' } }, ACME);
    await call('DeleteJob', { job_id: job.id }, ACME);
    await assert.rejects(call('GetJob', { job_id: job.id }, ACME), hasCode(grpc.status.NOT_FOUND));
  });
});

test('resume template: attach, get with and without content, delete', async () => {
  await withClient(async (call) => {
    const { job } = await call('CreateJob', { job: COMPLETE_INPUT }, ACME);
    const bytes = Buffer.from('%PDF-1.7 template');
    const attached = await call(
      'AttachResumeTemplate',
      { job_id: job.id, file_name: 'Standard.pdf', content_type: 'application/pdf', content: bytes },
      ACME,
    );
    assert.match(attached.template.id, /^template_/);
    assert.equal(attached.template.size_bytes, String(bytes.length));
    assert.equal(attached.template.content.length, 0);

    const withContent = await call('GetResumeTemplate', { job_id: job.id, include_content: true }, ACME);
    assert.deepEqual(Buffer.from(withContent.template.content), bytes);
    assert.equal((await call('GetJob', { job_id: job.id }, ACME)).job.application_settings.resume_template_id, attached.template.id);

    await assert.rejects(
      call('AttachResumeTemplate', { job_id: job.id, file_name: 'x.png', content_type: 'image/png', content: bytes }, ACME),
      hasCode(grpc.status.INVALID_ARGUMENT),
    );

    await call('DeleteResumeTemplate', { job_id: job.id }, ACME);
    await assert.rejects(call('GetResumeTemplate', { job_id: job.id }, ACME), hasCode(grpc.status.NOT_FOUND));
  });
});

test('validation errors that mention Thai text still come back as INVALID_ARGUMENT with readable details', async () => {
  await withClient(async (call) => {
    const input = { title: 'ครู', requirements: { required_skills: [{ name: 'ภาษาไทย' }, { name: 'ภาษาไทย' }] } };
    await assert.rejects(call('CreateJob', { job: input }, ACME), (err: grpc.ServiceError) => {
      assert.equal(err.code, grpc.status.INVALID_ARGUMENT);
      const [raw] = err.metadata.get('x-validation-errors');
      const details = JSON.parse(String(raw));
      assert.equal(details[0].field, 'requirements.requiredSkills[1].name');
      assert.match(details[0].message, /ภาษาไทย/);
      return true;
    });
  });
});
