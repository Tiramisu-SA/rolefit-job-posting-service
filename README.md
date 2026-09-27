# RoleFit – Job Posting Service

Owns the **authoritative job documents** for RoleFit.

- Exposes a **gRPC API** (`proto/job-posting.proto`): full CRUD, lifecycle and resume templates. The web frontend calls it from its Next.js server; Job Discovery and other services use the same API.
- The HTTP port only serves `GET /health`.
- Persists jobs in its **own MongoDB database**. No other service may query this database directly; they must go through the gRPC API.

> **Status:** implemented. Design: [docs/superpowers/specs/2026-09-27-job-posting-grpc-design.md](docs/superpowers/specs/2026-09-27-job-posting-grpc-design.md).

## Requirements

- Node.js ≥ 20 (Docker image uses Node 22)
- MongoDB (local or container)

## Install

```bash
npm install
cp .env.example .env   # or .env.local (loaded first); then adjust values
npm run seed           # optional: 12 sample jobs (company co-brightline = dev recruiter)
```

## Commands

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start in watch mode with `tsx` (gRPC + /health)   |
| `npm run build`     | Compile TypeScript to `dist/`                     |
| `npm start`         | Run the compiled service (`dist/server.js`)       |
| `npm run typecheck` | Type-check without emitting                       |
| `npm test`          | Run tests in `tests/` (Node test runner via tsx)  |

## Ports & environment variables

| Variable      | Default                                            | Purpose                                  |
| ------------- | -------------------------------------------------- | ---------------------------------------- |
| `HTTP_PORT`   | `3002`                                             | Health check port (`/health`)            |
| `GRPC_HOST`   | `0.0.0.0`                                          | gRPC bind address                        |
| `GRPC_PORT`   | `50052`                                            | gRPC API port                            |
| `MONGODB_URI` | `mongodb://localhost:27017/rolefit_job_posting`    | MongoDB connection string                |
| `AI_PROVIDER` | `none`                                             | AI Model Adapter implementation (stub)   |
| `AI_API_KEY`  | *(empty)*                                          | Reserved for a future AI provider        |

If MongoDB is unreachable at startup the skeleton logs an error and keeps running, so gRPC can still be smoke-tested. `GET /health` reports the DB state.

## Docker

```bash
docker build -t rolefit-job-posting-service .
docker run --rm -p 3002:3002 -p 50052:50052 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/rolefit_job_posting \
  rolefit-job-posting-service
```

## Architecture

```
Web frontend (Next.js server)        Job Discovery Service (later)
            │ gRPC (:50052)                    │ gRPC (:50052)
            ▼                                  ▼
┌──────────────────────────────────────────────────────────┐
│ Job Posting Service                                      │
│                                                          │
│  gRPC handlers (identity, mapping, errors)               │
│        │                                                 │
│        ▼                                                 │
│  JobService ──► JobRepository ──► MongoDB (jobs,         │
│      │          (MongoJobRepository)   resume_templates) │
│      └──► AIModelAdapter (internal interface, stub)      │
└──────────────────────────────────────────────────────────┘
```

- **gRPC handlers** — transport only: read identity metadata, map proto ↔ domain (`src/grpc/job.mapper.ts`), call `JobService`, map errors. No business rules.
- **JobService** — the single home of business logic: lifecycle, ownership, visibility, template rules. Validation is in `src/validation/job.validation.ts`.
- **JobRepository** — interface; `MongoJobRepository` is the only code that touches Mongoose/MongoDB. Returns plain domain objects.
- **AIModelAdapter** — internal interface (Adapter pattern), **not** a microservice. Stub only; no external AI calls are made.

## gRPC API

Defined in [proto/job-posting.proto](proto/job-posting.proto) (package `rolefit.jobposting.v1`):

| RPC | What it does |
| --- | --- |
| `CreateJob`, `UpdateJob` | Create a DRAFT / replace all editable fields |
| `GetJob`, `ListJobs` | Read; filters `status`, `company_id`, `query`; pages `page` / `limit` (max 100) |
| `DeleteJob` | Drafts only |
| `PublishJob`, `CloseJob`, `ReopenJob` | DRAFT → OPEN → CLOSED → OPEN |
| `AttachResumeTemplate`, `GetResumeTemplate`, `DeleteResumeTemplate` | One PDF/DOCX template per job, up to 2 MB |

- **Identity (mock auth):** writes need metadata `x-user-id` and `x-company-id`. The caller's company must own the job.
- **Visibility:** a DRAFT job is only returned to its own company.
- **Errors:** `INVALID_ARGUMENT` (with trailing metadata `x-validation-errors`, a JSON array of `{ field, message }`), `NOT_FOUND`, `FAILED_PRECONDITION` (illegal lifecycle step), `UNAUTHENTICATED`, `PERMISSION_DENIED`.

The proto is loaded at runtime with `@grpc/proto-loader` (`keepCase`, `enums: String`). Clients should use a copy of this same file.

## Folder structure

```
proto/                  gRPC contract (.proto)
src/
  app.ts                Express app (routes, middleware, /health)
  server.ts             Entrypoint: connect MongoDB, start gRPC + /health
  container.ts          Composition root – wires repository, AI adapter, JobService
  config/               env.ts (environment), database.ts (Mongoose connection)
  services/             JobService – business logic
  repositories/         JobRepository – MongoDB access
  models/               Mongoose schema/model (placeholder)
  adapters/ai/          AIModelAdapter interface + stub
  grpc/                 gRPC server bootstrap + handlers
  types/                Shared domain types / DTOs
  middleware/           Error handling for /health
  validation/           Pure input and publish checks
  scripts/              seed.ts + seed-jobs.json (npm run seed)
  utils/                Errors, logger
tests/                  Tests (node:test)
```
