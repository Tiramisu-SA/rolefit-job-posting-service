import type { JobRepository } from '../../src/repositories/job.repository';
import type { Job, ListJobsQuery, ResumeTemplate } from '../../src/types/job.types';

/** In-memory JobRepository with the same filtering, visibility and sorting as the Mongo one. */
export class InMemoryJobRepository implements JobRepository {
  jobs = new Map<string, Job>();
  templates = new Map<string, ResumeTemplate>();

  async create(job: Job) {
    this.jobs.set(job.id, structuredClone(job));
    return structuredClone(job);
  }

  async findById(id: string) {
    const job = this.jobs.get(id);
    return job ? structuredClone(job) : null;
  }

  async update(id: string, patch: Partial<Omit<Job, 'id' | 'createdAt'>>) {
    const job = this.jobs.get(id);
    if (!job) return null;
    Object.assign(job, structuredClone(patch));
    return structuredClone(job);
  }

  async delete(id: string) {
    return this.jobs.delete(id);
  }

  async list(query: ListJobsQuery, opts: { draftsVisibleTo?: string }) {
    const text = query.query?.toLowerCase();
    const matches = [...this.jobs.values()]
      .filter((j) => j.status !== 'DRAFT' || j.companyId === opts.draftsVisibleTo)
      .filter((j) => !query.status || j.status === query.status)
      .filter((j) => !query.companyId || j.companyId === query.companyId)
      .filter(
        (j) =>
          !text ||
          j.title.toLowerCase().includes(text) ||
          j.requirements.requiredSkills.some((s) => s.name.toLowerCase().includes(text)),
      );
    const time = (d?: Date) => d?.getTime() ?? 0;
    matches.sort((a, b) =>
      query.companyId ? time(b.updatedAt) - time(a.updatedAt) : time(b.publishedAt) - time(a.publishedAt),
    );
    const start = (query.page - 1) * query.limit;
    return { items: matches.slice(start, start + query.limit).map((j) => structuredClone(j)), total: matches.length };
  }

  async saveTemplate(template: ResumeTemplate) {
    this.templates.set(template.jobId, structuredClone(template));
  }

  async findTemplateByJobId(jobId: string, includeContent: boolean) {
    const t = this.templates.get(jobId);
    if (!t) return null;
    const copy = structuredClone(t);
    if (!includeContent) delete copy.content;
    else if (copy.content) copy.content = Buffer.from(copy.content);
    return copy;
  }

  async deleteTemplateByJobId(jobId: string) {
    return this.templates.delete(jobId);
  }
}
