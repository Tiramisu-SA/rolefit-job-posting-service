import { Schema, model, type InferSchemaType } from 'mongoose';
import { JobStatus } from '../types/job.types';

// MINIMAL PLACEHOLDER SCHEMA.
// This service owns the authoritative job documents. Other services must read
// jobs through the gRPC API, never by querying this collection directly.
//
// TODO: Finalize the schema (see TODO.md). Open questions:
//   - Which fields are required? Max lengths?
//   - Who owns a job (companyId / recruiterId)?
//   - How are requirements/skills stored (free text vs. structured list)?
//   - Is the resume template embedded here or stored in its own collection?
//   - Do we need publishedAt / closedAt timestamps or a status history?
const jobSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.DRAFT,
    },
    // TODO: Add remaining fields.
    // TODO: Decide resume template storage (embedded sub-document or separate collection).
  },
  {
    timestamps: true,
    collection: 'jobs',
  },
);

// TODO: Create indexes based on the real query patterns of listJobs / Job Discovery Service,
// e.g. jobSchema.index({ status: 1, createdAt: -1 });

export type JobDocument = InferSchemaType<typeof jobSchema>;

export const JobModel = model('Job', jobSchema);
