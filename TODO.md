# Job Posting Service – TODO

Scaffolding is done. Everything below is for the team to implement.
Search the code for `TODO` to find the matching spots.

Suggested order: 1 → 2 → 3 → 4 → 5, then the rest in parallel.

---

## A. Domain & data model

### TODO 1 – Define the job lifecycle

- Confirm the states in `src/types/job.types.ts` (`DRAFT`, `PUBLISHED`, `CLOSED`) or change them.
- Draw the state diagram and allowed transitions (publish, close, reopen). What does reopen return to: `PUBLISHED` or `DRAFT`?
- Keep `proto/job-posting.proto` `JobStatus` in sync.
- Put the diagram in the project report / architecture docs.

### TODO 2 – Finalize the Job schema

- File: `src/models/job.model.ts` (and `Job` in `src/types/job.types.ts`).
- Decide the fields: owner/company, location, employment type, salary range, skills/requirements, deadlines, etc.
- Decide required fields, defaults, max lengths, and enums.
- Decide whether to add `publishedAt` / `closedAt` or a status history.

### TODO 3 – Decide resume template storage

- Embedded in the job document or in a separate collection?
- Decide the format (text, structured sections, file reference) and update `ResumeTemplate` in `job.types.ts`.
- Decide whether a job has one template or many (this affects POST vs. PUT on `/resume-template`).

### TODO 4 – Create MongoDB indexes

- File: `src/models/job.model.ts`.
- Base them on the real queries from `listJobs` and Job Discovery Service (e.g. `status + createdAt`, owner).
- Consider a text index if keyword search is needed.

---

## B. Persistence

### TODO 5 – Implement JobRepository

- File: `src/repositories/job.repository.ts`.
- Implement `create`, `findById`, `update`, `list`, `saveResumeTemplate`, `findResumeTemplate` using `JobModel`.
- Map Mongoose documents to plain `Job` objects (`_id` → `id`). Don't leak Mongoose types upward.
- Handle invalid ObjectIds (return `null` instead of throwing a CastError).
- The repository stays the only place that imports `JobModel`.

---

## C. Business logic (`src/services/job.service.ts`)

### TODO 6 – Implement createJob

- Validate input, set the initial status, and persist.
- Decide who the owner is (from the auth context, see TODO 17).

### TODO 7 – Implement updateJob

- Throw `NotFoundError` for unknown jobs.
- Decide which fields can still be edited after a job is published or closed.
- Don't let clients change `status` through update. Status changes go only through the lifecycle operations.

### TODO 8 – Implement publishing rules (publishJob)

- Enforce the allowed source states from TODO 1 and throw `InvalidStateError` (→ HTTP 409) otherwise.
- Check that required fields are present before publishing.
- Decide whether publishing twice is an error or a no-op.

### TODO 9 – Implement closeJob and reopenJob

- Enforce the transitions from TODO 1.
- Decide what reopen does to timestamps and whether a closed job can be edited.

### TODO 10 – Implement getJob and listJobs

- `getJob`: throw `NotFoundError` when the job doesn't exist.
- `listJobs`: normalize filters and pagination (defaults, max `limit`).
- Decide visibility: should public/discovery callers see `DRAFT` jobs?

### TODO 11 – Implement resume template handling

- `attachResumeTemplate`: make sure the job exists, validate the template, persist it.
- `getResumeTemplate`: return it or throw `NotFoundError`.
- Decide whether templates can change after publishing.

---

## D. Interfaces

### TODO 12 – Implement input validation (REST)

- Validate bodies, params and query strings before they reach `JobService`. Pick an approach (e.g. zod, express-validator, or hand-written).
- Return `ValidationError` (→ HTTP 400) with helpful messages.
- Parse `GET /api/jobs` query params (`status`, `page`, `limit`) in `job.controller.ts`.

### TODO 13 – Finalize the REST response format

- Decide on the response DTOs and whether to wrap them (`{ data: ... }`).
- Map Mongoose errors in `src/middleware/error.middleware.ts` (CastError, ValidationError, duplicate key).
- Configure CORS for the web frontend origin in `src/app.ts`.

### TODO 14 – Finalize the gRPC contract

- File: `proto/job-posting.proto`.
- Add the final `Job` fields (to match TODO 2).
- Decide on timestamps: ISO strings or `google.protobuf.Timestamp`.
- Agree with the Job Discovery Service team on which filters `ListJobsRequest` needs, and whether more RPCs are needed (e.g. `GetResumeTemplate`, `BatchGetJobs`).
- Share the `.proto` file with Job Discovery Service.

### TODO 15 – Implement gRPC GetJob

- File: `src/grpc/job-posting.grpc.ts`.
- Call `jobService.getJob` and map the domain `Job` to the proto `Job` (status enum names, timestamps, `id`).
- Return `NOT_FOUND` / `INVALID_ARGUMENT` correctly (the error mapping already exists).

### TODO 16 – Implement gRPC ListJobs

- Map `ListJobsRequest` to `ListJobsQuery`. Proto3 sends `0` / `JOB_STATUS_UNSPECIFIED` for unset fields, so treat those as "no filter" or "use the default".
- Map the paginated result to `ListJobsResponse`.
- Optional: generate TS types with `proto-loader-gen-types` instead of the hand-written interfaces.

---

## E. Cross-cutting

### TODO 17 – Authentication and authorization (later)

- File: `src/middleware/auth.middleware.ts` (currently lets everything through).
- Decide how identity arrives (API gateway header, JWT, ...).
- Only recruiters/owners may create, update, publish, close, reopen, or attach templates.
- Secure the internal gRPC port (network isolation, and mTLS/TLS in `grpc.server.ts`).

### TODO 18 – Configuration and startup

- Validate env vars in `src/config/env.ts` (fail fast in production).
- Decide whether the service should exit when MongoDB is unreachable (`src/server.ts`).
- Tune Mongoose connection options in `src/config/database.ts`.

### TODO 19 – Tests

- Unit tests for `JobService` with a fake `JobRepository` and fake `AIModelAdapter`, especially the lifecycle rules.
- Repository integration tests (e.g. `mongodb-memory-server` or a test DB).
- REST tests for every route, and gRPC tests for `GetJob` / `ListJobs`.
- Update `tests/health.test.ts` once operations stop returning 501.

### TODO 20 – Deployment

- Add a `docker-compose.yml` (service + MongoDB) if the course setup needs one.
- Add a Docker `HEALTHCHECK` that uses `/health`.
- Add structured logging (replace `src/utils/logger.ts`).

---

## F. Optional

### TODO 21 – AI requirement extraction (optional)

- Files: `src/adapters/ai/ai.adapter.ts`, `src/adapters/ai/ai.types.ts`.
- Finalize `ExtractedJobRequirements`.
- Implement a real adapter class (e.g. `OpenAIModelAdapter implements AIModelAdapter`) and register it in `createAIModelAdapter()`.
- Decide when it runs (on create? on publish? asynchronously?) and what happens when it fails. Job creation must not fail because of AI.
- Keep it an internal adapter. It must not become a separate microservice.
- Store extracted requirements in the job document (to match TODO 2).
