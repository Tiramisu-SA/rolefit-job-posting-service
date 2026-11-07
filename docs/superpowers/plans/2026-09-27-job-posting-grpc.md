# Job Posting gRPC CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (Native). This plan is deliberately minimal, as the user asked: the spec holds the full proto and the rules. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working Job Posting Service: MongoDB job documents in the agreed JSON shape, and 11 gRPC RPCs covering CRUD, the lifecycle and templates.
**Architecture:** gRPC handlers → `JobService(caller, …)` → `JobRepository` interface (Mongo implementation). Validation and the proto mapping are pure modules. REST job routes are deleted; HTTP serves `/health` only.
**Tech Stack:** Node 24, TypeScript, Mongoose 9, @grpc/grpc-js + proto-loader, `ulid`, node:test via tsx.
**Spec:** `docs/superpowers/specs/2026-09-27-job-posting-grpc-design.md`

## Global Constraints
- The only new runtime dependency is `ulid`. No new test dependencies.
- Default ports are HTTP `3002` and gRPC `50052`.
- IDs are `job_<ULID>` and `template_<ULID>`. Seed IDs are `job_seed_<slug>`.
- Proto enum values are prefixed (`EMPLOYMENT_TYPE_FULL_TIME`); the domain uses bare values (`FULL_TIME`). Proto `""` or `0` means unset.
- Never write `.env` files.

## Review Focus
- `UpdateJob` on an OPEN job must not change `status`, `publishedAt`, `recruiterId`, `companyId` or `resumeTemplateId` (Task 2 test).
- A `ListJobs` `query` with regex characters (`C++`, `.*`) is matched as literal text and doesn't crash (Task 2 test on the fake; Task 3 escapes it for Mongo).
- A `page`/`limit` of `0` or negative → defaults; a `limit` over 100 → capped at 100 (Task 2).
- Reopening a CLOSED job whose deadline has passed → `FAILED_PRECONDITION` (Task 2).
- A template over 2 MB or of the wrong type → `INVALID_ARGUMENT`, and the job is unchanged (Task 2).

---

### Task 1: Setup, types, validation
**Files:** `package.json` (add `ulid`, add `"seed": "tsx src/scripts/seed.ts"`), `src/types/job.types.ts`, `src/utils/errors.ts` (add `UnauthorizedError`, `ForbiddenError`; `ValidationError` gets `details`), `src/validation/job.validation.ts`, `tests/validation.test.ts`.
**Produces:**
- Types: `Job`, `JobInput`, `Caller = { userId, companyId } | null`, `ListJobsQuery { status?, companyId?, query?, page, limit }`, `ResumeTemplate`.
- `validateJobInput(raw): JobInput`, which applies the defaults.
- `assertPublishable(job, now)`.
- [ ] Run `npm install`, then `npm install ulid`.
- [ ] Failing tests:
  - every limit
  - a duplicate skill across required and preferred, ignoring case
  - salary minimum greater than maximum
  - bad currency
  - an invalid deadline string
  - defaults applied
  - `assertPublishable` failing for each missing field and for a past deadline
- [ ] Implement until green, then commit.

### Task 2: JobService + in-memory repository
**Files:** `src/repositories/job.repository.ts` (interface), `src/services/job.service.ts`, `tests/fakes/in-memory-job.repository.ts`, `tests/job.service.test.ts`.
**Produces:**
- The `JobRepository` interface:
  - `create(job)`, `findById(id)`, `update(id, patch)`, `delete(id)`
  - `list(query, {includeDraftsForCompany?})` → `{items, total}`
  - `saveTemplate(t)` (replaces the old one), `findTemplateByJobId(jobId)`, `deleteTemplateByJobId(jobId)`
- `JobService` methods: `createJob(caller, raw)`, `getJob(caller, id)`, `listJobs(caller, q)`, `updateJob(caller, id, raw)`, `deleteJob`, `publishJob`, `closeJob`, `reopenJob`, `attachResumeTemplate(caller, id, {fileName, contentType, content})`, `getResumeTemplate(caller, id, includeContent)`, `deleteResumeTemplate`.
- [ ] Failing tests:
  - the full lifecycle table from the spec, with allowed and rejected moves
  - `publishedAt` set only once
  - ownership: no caller → `UnauthorizedError`; another company → `ForbiddenError`
  - visibility: another company's DRAFT → not found on get and left out of list
  - delete only for drafts, and it also deletes the template
  - replacing a template
  - the Review Focus items above
- [ ] Implement until green, then commit.

### Task 3: Mongo models + repository + seed
**Files:** `src/models/job.model.ts`, `src/models/resume-template.model.ts`, `src/repositories/job.repository.ts` (`MongoJobRepository`), `src/container.ts`, `src/scripts/seed.ts`, `tests/mongo.integration.test.ts` (runs only with `MONGODB_TEST_URI`).
- [ ] Schemas with `_id: String`, `_id: false` subdocuments, and the spec's indexes.
- [ ] Map `_id` to `id` with `.lean()`.
- [ ] Escape the regex in `query`.
- [ ] Sort as the spec says.
- [ ] Seed: upsert about 10 jobs converted from the frontend's `src/lib/mock/jobs.ts`, keeping its company IDs (`co-brightline`, …). The `co-brightline` jobs get recruiter `user_4a80fdb2` and include a DRAFT and a CLOSED job.
- [ ] Write the integration test: create → list → update → delete, run against `MONGODB_TEST_URI`.
- [ ] Run `npm run typecheck`, then commit.

### Task 4: Proto, mapper, gRPC handlers, cleanup, docs
**Files:**
- `proto/job-posting.proto`: replace it with the spec's proto.
- `src/grpc/job.mapper.ts`, `src/grpc/identity.ts`, `src/grpc/job-posting.grpc.ts`.
- `src/app.ts`: `/health` only.
- Delete `src/routes/job.routes.ts`, `src/controllers/job.controller.ts`, `src/middleware/auth.middleware.ts`.
- `src/config/env.ts` (ports), `Dockerfile` (`EXPOSE 3002 50052`), `tests/health.test.ts`, `tests/mapper.test.ts`, `tests/grpc.test.ts`, `README.md`, `TODO.md`, `.env.example`.

**Steps:**
- [ ] Failing tests:
  - Mapper: a domain job → proto → domain gives the same job, including enum prefixes, `""` meaning unset, and `optional` salary values.
  - gRPC (server on port 0 + the in-memory repository + a client):
    - every RPC works
    - a write without metadata → `UNAUTHENTICATED`
    - another company → `PERMISSION_DENIED`
    - a validation failure → `INVALID_ARGUMENT` with the `x-validation-errors` trailer holding field JSON
    - a closed job updated → `FAILED_PRECONDITION`
  - Health: `/health` returns 200. The old "501" test is removed.
- [ ] Implement until green. Keep the proto-loader options `keepCase, enums: String, longs: String, defaults: true, oneofs: true`.
- [ ] Run `npm test`, `npm run typecheck` and `npm run build`. Update the docs, then commit.
