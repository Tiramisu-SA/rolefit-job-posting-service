import mongoose from 'mongoose';
import { env } from '../config/env';
import { JobModel } from '../models/job.model';
import { ResumeTemplateModel } from '../models/resume-template.model';
import { logger } from '../utils/logger';
import { redactMongoUri } from '../utils/redact-uri';
import { withFutureDeadlines } from './seed-deadlines';
import seedJobs from './seed-jobs.json';
import { seedTemplateFile } from './seed-template';

// Sample jobs for local development: `npm run seed`. Safe to re-run (upserts by id).
// The data mirrors the web frontend's former mock jobs; its mock applications
// refer to these ids (job_seed_<slug>). Brightline jobs belong to the dev
// recruiter user_4a80fdb2 / company co-brightline.

async function main(): Promise<void> {
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  for (const seed of withFutureDeadlines(seedJobs, new Date())) {
    const { resumeTemplateName, ...applicationSettings } = seed.applicationSettings as typeof seed.applicationSettings & {
      resumeTemplateName?: string;
    };
    await JobModel.replaceOne({ _id: seed._id }, { ...seed, applicationSettings }, { upsert: true });

    await ResumeTemplateModel.deleteMany({ jobId: seed._id });
    if (applicationSettings.resumeTemplateId && resumeTemplateName) {
      await ResumeTemplateModel.create({
        _id: applicationSettings.resumeTemplateId,
        jobId: seed._id,
        companyId: seed.companyId,
        ...seedTemplateFile(resumeTemplateName),
        createdAt: new Date(seed.createdAt),
      });
    }
  }
  logger.info(`Seeded ${seedJobs.length} jobs into ${redactMongoUri(env.mongodbUri)}`);
}

main()
  .catch((err) => {
    logger.error('Seeding failed', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
