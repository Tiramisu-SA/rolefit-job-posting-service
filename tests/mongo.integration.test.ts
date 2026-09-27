import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoJobRepository } from '../src/repositories/mongo-job.repository';
import { JobService } from '../src/services/job.service';
import { StubAIModelAdapter } from '../src/adapters/ai/ai.adapter';
import type { Caller } from '../src/types/job.types';

// Runs only against a real MongoDB (the database is dropped first):
//   MONGODB_TEST_URI=mongodb://localhost:27017/rolefit_job_posting_test npm test
const uri = process.env.MONGODB_TEST_URI;
const ACME: Caller = { userId: 'user_a', role: 'recruiter', companyId: 'co-acme' };

test('MongoJobRepository: CRUD, lifecycle, list and templates', { skip: !uri && 'MONGODB_TEST_URI not set' }, async () => {
  await mongoose.connect(uri!, { serverSelectionTimeoutMS: 5000 });
  try {
    await mongoose.connection.dropDatabase();
    const service = new JobService(new MongoJobRepository(), new StubAIModelAdapter());

    const job = await service.createJob(ACME, {
      title: 'C++ Engineer',
      description: 'Systems work',
      requirements: { requiredSkills: [{ name: 'C++', level: 'ADVANCED', minimumYears: 3 }], preferredSkills: [{ name: 'Rust' }] },
      employmentType: 'FULL_TIME',
      workArrangement: 'ONSITE',
      location: { country: 'Thailand', province: 'Bangkok', district: 'Pathum Wan' },
      salary: { minimum: 50000, maximum: 80000 },
      applicationDeadline: '2099-01-01T00:00:00Z',
    });
    assert.match(job.id, /^job_[0-9A-Z]{26}$/);
    assert.equal(job.location.district, 'Pathum Wan');
    assert.ok(job.applicationSettings.applicationDeadline instanceof Date);

    // Unset a field through update.
    const updated = await service.updateJob(ACME, job.id, { title: 'C++ Engineer', description: 'Systems work' });
    assert.equal(updated.employmentType, undefined);
    assert.equal(updated.location.district, undefined);
    assert.equal(updated.salary.currency, 'THB');

    await service.updateJob(ACME, job.id, {
      title: 'C++ Engineer',
      description: 'Systems work',
      requirements: { requiredSkills: [{ name: 'C++' }] },
      employmentType: 'FULL_TIME',
      workArrangement: 'ONSITE',
      location: { country: 'Thailand', province: 'Bangkok' },
    });
    const open = await service.publishJob(ACME, job.id);
    assert.equal(open.status, 'OPEN');
    assert.ok(open.publishedAt instanceof Date);

    assert.deepEqual((await service.listJobs(null, { query: 'c++' })).items.map((j) => j.id), [job.id]);
    assert.equal((await service.listJobs(null, { query: '.*' })).total, 0);

    const template = await service.attachResumeTemplate(ACME, job.id, {
      fileName: 'template.pdf',
      contentType: 'application/pdf',
      content: Buffer.from('%PDF-1.7 test'),
    });
    const withContent = await service.getResumeTemplate(null, job.id, true);
    assert.equal(withContent.id, template.id);
    assert.equal(withContent.content?.toString(), '%PDF-1.7 test');
    assert.equal((await service.getResumeTemplate(null, job.id, false)).content, undefined);

    const draft = await service.createJob(ACME, { title: 'Draft only' });
    // Empty sub-documents must survive the round trip (Mongoose minimizes them by default).
    const reread = await service.getJob(ACME, draft.id);
    assert.deepEqual(reread.location, {});
    assert.deepEqual(reread.salary, { currency: 'THB', visible: true });
    assert.equal((await service.listJobs(null, {})).total, 1);
    assert.equal((await service.listJobs(ACME, { companyId: 'co-acme' })).total, 2);
    await service.deleteJob(ACME, draft.id);
    assert.equal((await service.listJobs(ACME, { companyId: 'co-acme' })).total, 1);
  } finally {
    await mongoose.disconnect();
  }
});
