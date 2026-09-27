# RoleFit – Job Posting Service

Owns the **authoritative job documents** for RoleFit.

- Exposes a **public REST/JSON API** for the web frontend.
- Exposes an **internal gRPC API** for other microservices (Job Discovery Service).
- Persists jobs in its **own MongoDB database**. No other service may query this database directly; they must go through the gRPC API.

> **Status:** scaffolding only. All business operations return `501 Not Implemented` (REST) / `UNIMPLEMENTED` (gRPC). See [TODO.md](TODO.md).

## Requirements

- Node.js ≥ 20 (Docker image uses Node 22)
- MongoDB (local or container)

## Install

```bash
npm install
cp .env.example .env   # then adjust values
```

## Commands

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start in watch mode with `tsx` (REST + gRPC)     |
| `npm run build`     | Compile TypeScript to `dist/`                    |
| `npm start`         | Run the compiled service (`dist/server.js`)      |
| `npm run typecheck` | Type-check without emitting                      |
| `npm test`          | Run tests in `tests/` (Node test runner via tsx) |

## Ports & environment variables

| Variable      | Default                                         | Purpose                                |
| ------------- | ----------------------------------------------- | -------------------------------------- |
| `HTTP_PORT`   | `3000`                                          | Public REST API port                   |
| `GRPC_HOST`   | `0.0.0.0`                                       | gRPC bind address                      |
| `GRPC_PORT`   | `50051`                                         | Internal gRPC API port                 |
| `MONGODB_URI` | `mongodb://localhost:27017/rolefit_job_posting` | MongoDB connection string              |
| `AI_PROVIDER` | `none`                                          | AI Model Adapter implementation (stub) |
| `AI_API_KEY`  | _(empty)_                                       | Reserved for a future AI provider      |

If MongoDB is unreachable at startup the skeleton logs an error and keeps running, so REST/gRPC can still be smoke-tested. `GET /health` reports the DB state.

## Docker

```bash
docker build -t rolefit-job-posting-service .
docker run --rm -p 3000:3000 -p 50051:50051 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/rolefit_job_posting \
  rolefit-job-posting-service
```

## Architecture

```
Web frontend                         Job Discovery Service
     │ REST/JSON (:3000)                   │ gRPC (:50051)
     ▼                                     ▼
┌──────────────────────────────────────────────────────────┐
│ Job Posting Service                                      │
│                                                          │
│  JobController (REST) ──┐                                │
│                         ├──► JobService ──► JobRepository ──► MongoDB
│  gRPC handlers ─────────┘        │                       │   (owned by this
│                                  └──► AIModelAdapter     │    service only)
│                                       (internal interface,│
│                                        stub for now)     │
└──────────────────────────────────────────────────────────┘
```

- **Controllers / gRPC handlers** — transport only: parse input, call `JobService`, map output/errors. No business rules.
- **JobService** — the single home of business logic (lifecycle rules, validation). Shared by REST and gRPC via `src/container.ts`.
- **JobRepository** — the only code that touches Mongoose/MongoDB. Returns plain domain objects.
- **AIModelAdapter** — internal interface (Adapter pattern), **not** a microservice. Current implementation is a stub; no external AI calls are made.
- **Errors** — `src/utils/errors.ts` defines domain errors; REST maps them to HTTP status codes, gRPC to gRPC status codes.

## REST API

| Method | Path                               | Operation              |
| ------ | ---------------------------------- | ---------------------- |
| GET    | `/health`                          | Health check           |
| POST   | `/api/jobs`                        | `createJob`            |
| GET    | `/api/jobs`                        | `listJobs`             |
| GET    | `/api/jobs/:jobId`                 | `getJob`               |
| PUT    | `/api/jobs/:jobId`                 | `updateJob`            |
| POST   | `/api/jobs/:jobId/publish`         | `publishJob`           |
| POST   | `/api/jobs/:jobId/close`           | `closeJob`             |
| POST   | `/api/jobs/:jobId/reopen`          | `reopenJob`            |
| POST   | `/api/jobs/:jobId/resume-template` | `attachResumeTemplate` |
| GET    | `/api/jobs/:jobId/resume-template` | `getResumeTemplate`    |

Lifecycle changes use explicit action endpoints instead of a writable `status` field, so `JobService` controls the state rules.

## gRPC API

Defined in [proto/job-posting.proto](proto/job-posting.proto) (package `rolefit.jobposting.v1`):

```proto
service JobPostingService {
  rpc GetJob (GetJobRequest) returns (GetJobResponse);
  rpc ListJobs (ListJobsRequest) returns (ListJobsResponse);
}
```

The proto is loaded at runtime with `@grpc/proto-loader`. Job Discovery Service should use a copy of this same file.

## Folder structure

```
proto/                  gRPC contract (.proto)
src/
  app.ts                Express app (routes, middleware, /health)
  server.ts             Entrypoint: connect MongoDB, start REST + gRPC
  container.ts          Composition root – wires repository, AI adapter, JobService
  config/               env.ts (environment), database.ts (Mongoose connection)
  routes/               REST route definitions
  controllers/          REST controllers (thin)
  services/             JobService – business logic
  repositories/         JobRepository – MongoDB access
  models/               Mongoose schema/model (placeholder)
  adapters/ai/          AIModelAdapter interface + stub
  grpc/                 gRPC server bootstrap + handlers
  types/                Shared domain types / DTOs
  middleware/           Error handling, auth placeholder
  utils/                Errors, logger
tests/                  Tests (node:test)
```
