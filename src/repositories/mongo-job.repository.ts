import type { QueryFilter, SortOrder } from 'mongoose';
import { JobModel } from '../models/job.model';
import { ResumeTemplateModel } from '../models/resume-template.model';
import type { Job, ListJobsQuery, ResumeTemplate } from '../types/job.types';
import type { JobRepository } from './job.repository';

type JobDoc = Record<string, unknown> & { _id: string };

/** Turns a lean Mongo document into a plain Job: `_id` -> `id`, nulls -> undefined. */
function toJob(doc: JobDoc): Job {
  const { _id, ...rest } = doc;
  const job = JSON.parse(JSON.stringify({ id: _id, ...rest }), reviveDates) as Job;
  // Documents written before minimize was turned off may lack empty sub-documents.
  job.location ??= {};
  return job;
}

const DATE_KEYS = new Set(['createdAt', 'updatedAt', 'publishedAt', 'applicationDeadline']);

function reviveDates(key: string, value: unknown): unknown {
  if (value === null) return undefined;
  if (DATE_KEYS.has(key) && typeof value === 'string') return new Date(value);
  return value;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mongo stores Buffers as BSON Binary; lean() hands those back as Binary. */
function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  const binary = value as { buffer?: Uint8Array };
  return Buffer.from(binary.buffer ?? new Uint8Array());
}

/**
 * MongoDB implementation of JobRepository. The only code that imports the
 * Mongoose models.
 */
export class MongoJobRepository implements JobRepository {
  async create(job: Job): Promise<Job> {
    const { id, ...rest } = job;
    await JobModel.create({ _id: id, ...rest });
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<Job | null> {
    const doc = await JobModel.findById(id).lean<JobDoc>();
    return doc ? toJob(doc) : null;
  }

  async update(id: string, patch: Partial<Omit<Job, 'id' | 'createdAt'>>): Promise<Job | null> {
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) $unset[key] = 1;
      else $set[key] = value;
    }
    const update = Object.keys($unset).length > 0 ? { $set, $unset } : { $set };
    const doc = await JobModel.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true }).lean<JobDoc>();
    return doc ? toJob(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await JobModel.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async list(query: ListJobsQuery, opts: { draftsVisibleTo?: string }): Promise<{ items: Job[]; total: number }> {
    const conditions: Record<string, unknown>[] = [
      opts.draftsVisibleTo
        ? { $or: [{ status: { $ne: 'DRAFT' } }, { companyId: opts.draftsVisibleTo }] }
        : { status: { $ne: 'DRAFT' } },
    ];
    if (query.status) conditions.push({ status: query.status });
    if (query.companyId) conditions.push({ companyId: query.companyId });
    if (query.query) {
      const pattern = new RegExp(escapeRegex(query.query), 'i');
      conditions.push({ $or: [{ title: pattern }, { 'requirements.requiredSkills.name': pattern }] });
    }
    // Conditions are built dynamically, so the filter is typed loosely.
    const filter: QueryFilter<any> = { $and: conditions };
    const sort: Record<string, SortOrder> = query.companyId ? { updatedAt: -1, _id: 1 } : { publishedAt: -1, _id: 1 };

    const [docs, total] = await Promise.all([
      JobModel.find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<JobDoc[]>(),
      JobModel.countDocuments(filter),
    ]);
    return { items: docs.map(toJob), total };
  }

  async saveTemplate(template: ResumeTemplate): Promise<void> {
    const { id, ...rest } = template;
    await ResumeTemplateModel.deleteMany({ jobId: template.jobId });
    await ResumeTemplateModel.create({ _id: id, ...rest });
  }

  async findTemplateByJobId(jobId: string, includeContent: boolean): Promise<ResumeTemplate | null> {
    const query = ResumeTemplateModel.findOne({ jobId });
    if (!includeContent) query.select({ content: 0 });
    const doc = await query.lean<Record<string, unknown> & { _id: string }>();
    if (!doc) return null;
    return {
      id: doc._id,
      jobId: doc.jobId as string,
      companyId: doc.companyId as string,
      fileName: doc.fileName as string,
      contentType: doc.contentType as string,
      sizeBytes: doc.sizeBytes as number,
      content: includeContent ? toBuffer(doc.content) : undefined,
      createdAt: new Date(doc.createdAt as Date),
    };
  }

  async deleteTemplateByJobId(jobId: string): Promise<boolean> {
    const result = await ResumeTemplateModel.deleteMany({ jobId });
    return result.deletedCount > 0;
  }
}
