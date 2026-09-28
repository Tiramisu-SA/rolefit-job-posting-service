import mongoose from 'mongoose';
import { env } from '../config/env';
import { JobModel } from '../models/job.model';
import { ResumeTemplateModel } from '../models/resume-template.model';
import { logger } from '../utils/logger';
import seedJobs from './seed-jobs.json';

// Sample jobs for local development: `npm run seed`. Safe to re-run (upserts by id).
// The data mirrors the web frontend's former mock jobs; its mock applications
// refer to these ids (job_seed_<slug>). Brightline jobs belong to the dev
// recruiter user_4a80fdb2 / company co-brightline.

// A tiny valid PDF, standing in for the company resume templates.
const PLACEHOLDER_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function main(): Promise<void> {
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  for (const seed of seedJobs) {
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
        fileName: `${resumeTemplateName}.pdf`,
        contentType: 'application/pdf',
        sizeBytes: PLACEHOLDER_PDF.length,
        content: PLACEHOLDER_PDF,
        createdAt: new Date(seed.createdAt),
      });
    }
  }
  logger.info(`Seeded ${seedJobs.length} jobs into ${env.mongodbUri}`);
}

main()
  .catch((err) => {
    logger.error('Seeding failed', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
