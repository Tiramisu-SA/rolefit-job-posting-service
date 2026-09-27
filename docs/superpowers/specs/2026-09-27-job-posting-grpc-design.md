# Job Posting Service — gRPC CRUD Design

**Date:** 2026-09-27
**Status:** Approved in brainstorming, pending written-spec review
**Related specs:** `rolefit-frontend/docs/superpowers/specs/2026-09-27-backend-integration-design.md` (system overview, frontend), `rolefit-candidate-profile-service/docs/superpowers/specs/2026-09-27-profile-rest-crud-design.md`

## Goal

Replace the scaffold's placeholders with a working Job Posting Service. It stores job documents in MongoDB, in the agreed JSON shape, and exposes full CRUD, the lifecycle actions and resume templates over **gRPC**.

Its only caller for now is the Next.js server of the web frontend. The same API also serves Job Discovery later.

## Non-goals

- A REST API for jobs. The frontend uses gRPC, so the scaffold's REST job routes and controller are **removed**. The HTTP port serves only `GET /health`.
- Real authentication. Identity is mock gRPC metadata (see [Identity](#identity)).
- AI requirement extraction. The adapter stays a stub and isn't called.
- Updating Job Discovery's copy of the proto. Its team takes this `.proto` when they wire up.

## Job document

The MongoDB collection `jobs` stores this shape exactly. `_id` is a string: `job_<ULID>`, generated with the `ulid` package.

```json
{
  "_id": "job_01J9K7W4YV...",
  "recruiterId": "user_4a80fdb2",
  "companyId": "co-brightline",
  "title": "Backend Software Engineer",
  "description": "Develop and maintain backend services for our platform.",
  "requirements": {
    "requiredSkills": [{ "name": "Python", "level": "INTERMEDIATE", "minimumYears": 1 }],
    "preferredSkills": [{ "name": "Docker", "level": "BASIC" }],
    "minimumExperienceYears": 1,
    "educationLevel": "BACHELOR",
    "acceptedFields": ["Computer Engineering", "Computer Science"]
  },
  "responsibilities": ["Develop REST and gRPC services"],
  "employmentType": "FULL_TIME",
  "workArrangement": "HYBRID",
  "location": { "country": "Thailand", "province": "Bangkok", "district": "Pathum Wan" },
  "salary": { "minimum": 35000, "maximum": 50000, "currency": "THB", "visible": true },
  "applicationSettings": {
    "applicationDeadline": "2026-10-31T16:59:59Z",
    "positionsAvailable": 2,
    "resumeTemplateId": "template_01J9...",
    "requireCoverLetter": false
  },
  "status": "OPEN",
  "publishedAt": "2026-09-21T06:00:00Z",
  "createdAt": "2026-09-20T10:30:00Z",
  "updatedAt": "2026-09-21T06:00:00Z"
}
```

### Enums

| Field | Values |
|---|---|
| `level` | `BASIC`, `INTERMEDIATE`, `ADVANCED` |
| `employmentType` | `FULL_TIME`, `PART_TIME`, `INTERNSHIP`, `CONTRACT` |
| `workArrangement` | `ONSITE`, `HYBRID`, `REMOTE` |
| `educationLevel` | `NONE`, `HIGH_SCHOOL`, `DIPLOMA`, `BACHELOR`, `MASTER`, `DOCTORATE` |
| `status` | `DRAFT`, `OPEN`, `CLOSED` |

Level, employment type and work arrangement use the same values as the Candidate Profile Service.

### Drafts may be incomplete

In a draft, these may be unset:

- `description`
- `employmentType`
- `workArrangement`
- `location.country`
- `location.province`
- `applicationDeadline`

Publishing requires most of them (see [Lifecycle](#lifecycle)). Defaults:

- `requirements`: empty lists, `minimumExperienceYears: 0`, `educationLevel: 'NONE'`
- `salary`: `{ currency: 'THB', visible: true }`
- `positionsAvailable: 1`
- `requireCoverLetter: false`

### Indexes

- `{ companyId: 1, updatedAt: -1 }`: the recruiter's own list.
- `{ status: 1, publishedAt: -1 }`: the list of open jobs.

### Resume templates

A separate collection, `resume_templates`:

```ts
{ _id: 'template_<ULID>', jobId, companyId, fileName, contentType, sizeBytes, content: Buffer, createdAt }
```

- A job has at most one template. Attaching a new one replaces the old document.
- Accepted types:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Maximum size: 2 MB.

## Identity

- Callers send gRPC metadata `x-user-id` and `x-company-id`. `src/grpc/identity.ts` reads them into `Caller = { userId, companyId } | null`.
- **Writes** (create, update, delete, publish, close, reopen, attach or delete template):
  - A `null` caller gets `UNAUTHENTICATED`.
  - A job with `companyId !== caller.companyId` gets `PERMISSION_DENIED`.
- **Reads** also work without a caller (Job Discovery, seekers). See [Visibility](#visibility).
- The metadata is trusted only because auth is mocked. When real auth arrives, only `identity.ts` changes.

## Lifecycle

```
create ─► DRAFT ──publish──► OPEN ──close──► CLOSED
            │                  ▲                │
          delete               └────reopen──────┘
```

| Operation | Allowed from | Effect | Otherwise |
|---|---|---|---|
| `UpdateJob` | DRAFT, OPEN | Replaces all editable fields | `FAILED_PRECONDITION` |
| `DeleteJob` | DRAFT | Deletes the job and its template | `FAILED_PRECONDITION` (close it instead) |
| `PublishJob` | DRAFT | → OPEN; sets `publishedAt` if it isn't set | `FAILED_PRECONDITION` |
| `CloseJob` | OPEN | → CLOSED | `FAILED_PRECONDITION` |
| `ReopenJob` | CLOSED | → OPEN. The deadline must be unset or in the future | `FAILED_PRECONDITION` |
| Attach or delete template | DRAFT, OPEN | — | `FAILED_PRECONDITION` |

### Publish checks

Publishing requires all of these (otherwise `INVALID_ARGUMENT` with field details):

- a non-empty `description`
- at least one `requiredSkills` entry
- `employmentType` and `workArrangement`
- `location.country` and `location.province`
- a deadline that is unset or in the future
- `positionsAvailable` of at least 1

### Validation on every create and update

- `title` is required, 1–200 characters. `description` up to 10000 characters.
- `responsibilities`: up to 30 items of up to 500 characters.
- `requiredSkills` and `preferredSkills`: up to 30 each. Skill names are 1–100 characters and may not repeat (ignoring case) within or across the two lists.
- `minimumYears` and `minimumExperienceYears`: 0–50.
- `acceptedFields`: up to 20 items of up to 100 characters.
- Location parts: up to 100 characters each.
- Salary: amounts must be 0 or more, and `minimum ≤ maximum` when both are set. `currency` is 3 uppercase letters.
- `positionsAvailable`: 1–1000.
- `applicationDeadline` must be a valid ISO-8601 datetime.
- Enum values must be from the lists above.

Validation lives in `src/validation/job.validation.ts`, as pure functions.

### Visibility

A rule applied to each job: **a DRAFT job is visible only to its owner** (`caller.companyId === job.companyId`). OPEN and CLOSED jobs are visible to everyone.

- `GetJob` on a DRAFT the caller doesn't own returns `NOT_FOUND`, so its existence isn't revealed.
- `ListJobs` leaves out DRAFT jobs the caller doesn't own.
- Sorting: by `updatedAt` desc when `company_id` is given (a company's own list), otherwise by `publishedAt` desc.

`ListJobs` filters, applied together:

- `status`: `UNSPECIFIED` means no filter.
- `company_id`
- `query`: case-insensitive match on `title` or any `requiredSkills.name`, with regex characters escaped.
- `page`: default 1.
- `limit`: default 20, maximum 100.

A `page` or `limit` of `0` means "use the default".

## gRPC contract (`proto/job-posting.proto`, package `rolefit.jobposting.v1`)

The existing field numbers (`Job` 1–6, `ListJobsRequest` 1–3, `ListJobsResponse` 1–4) are kept. `JOB_STATUS_PUBLISHED = 2` becomes `JOB_STATUS_OPEN = 2`. `GetJobResponse` becomes `JobResponse`, which is the same on the wire.

```proto
service JobPostingService {
  rpc CreateJob (CreateJobRequest) returns (JobResponse);
  rpc GetJob (GetJobRequest) returns (JobResponse);
  rpc ListJobs (ListJobsRequest) returns (ListJobsResponse);
  rpc UpdateJob (UpdateJobRequest) returns (JobResponse);
  rpc DeleteJob (JobIdRequest) returns (DeleteJobResponse);
  rpc PublishJob (JobIdRequest) returns (JobResponse);
  rpc CloseJob (JobIdRequest) returns (JobResponse);
  rpc ReopenJob (JobIdRequest) returns (JobResponse);
  rpc AttachResumeTemplate (AttachResumeTemplateRequest) returns (ResumeTemplateResponse);
  rpc GetResumeTemplate (GetResumeTemplateRequest) returns (ResumeTemplateResponse);
  rpc DeleteResumeTemplate (JobIdRequest) returns (DeleteResumeTemplateResponse);
}

enum JobStatus { JOB_STATUS_UNSPECIFIED = 0; JOB_STATUS_DRAFT = 1; JOB_STATUS_OPEN = 2; JOB_STATUS_CLOSED = 3; }
enum SkillLevel { SKILL_LEVEL_UNSPECIFIED = 0; SKILL_LEVEL_BASIC = 1; SKILL_LEVEL_INTERMEDIATE = 2; SKILL_LEVEL_ADVANCED = 3; }
enum EmploymentType { EMPLOYMENT_TYPE_UNSPECIFIED = 0; EMPLOYMENT_TYPE_FULL_TIME = 1; EMPLOYMENT_TYPE_PART_TIME = 2; EMPLOYMENT_TYPE_INTERNSHIP = 3; EMPLOYMENT_TYPE_CONTRACT = 4; }
enum WorkArrangement { WORK_ARRANGEMENT_UNSPECIFIED = 0; WORK_ARRANGEMENT_ONSITE = 1; WORK_ARRANGEMENT_HYBRID = 2; WORK_ARRANGEMENT_REMOTE = 3; }
enum EducationLevel { EDUCATION_LEVEL_UNSPECIFIED = 0; EDUCATION_LEVEL_NONE = 1; EDUCATION_LEVEL_HIGH_SCHOOL = 2; EDUCATION_LEVEL_DIPLOMA = 3; EDUCATION_LEVEL_BACHELOR = 4; EDUCATION_LEVEL_MASTER = 5; EDUCATION_LEVEL_DOCTORATE = 6; }

message RequiredSkill { string name = 1; SkillLevel level = 2; int32 minimum_years = 3; }
message PreferredSkill { string name = 1; SkillLevel level = 2; }
message Requirements {
  repeated RequiredSkill required_skills = 1;
  repeated PreferredSkill preferred_skills = 2;
  int32 minimum_experience_years = 3;
  EducationLevel education_level = 4;
  repeated string accepted_fields = 5;
}
message Location { string country = 1; string province = 2; string district = 3; }
message Salary { optional double minimum = 1; optional double maximum = 2; string currency = 3; bool visible = 4; }
message ApplicationSettings {
  string application_deadline = 1;   // ISO-8601, "" = unset
  int32 positions_available = 2;
  string resume_template_id = 3;     // "" = none
  bool require_cover_letter = 4;
}

message Job {
  string id = 1;
  string title = 2;
  string description = 3;
  JobStatus status = 4;
  string created_at = 5;
  string updated_at = 6;
  string recruiter_id = 7;
  string company_id = 8;
  Requirements requirements = 9;
  repeated string responsibilities = 10;
  EmploymentType employment_type = 11;
  WorkArrangement work_arrangement = 12;
  Location location = 13;
  Salary salary = 14;
  ApplicationSettings application_settings = 15;
  string published_at = 16;          // "" = never published
}

// Editable fields. UpdateJob replaces all of them (full replace, no field mask).
message JobInput {
  string title = 1;
  string description = 2;
  Requirements requirements = 3;
  repeated string responsibilities = 4;
  EmploymentType employment_type = 5;
  WorkArrangement work_arrangement = 6;
  Location location = 7;
  Salary salary = 8;
  string application_deadline = 9;
  int32 positions_available = 10;    // 0 = default (1)
  bool require_cover_letter = 11;
}

message CreateJobRequest { JobInput job = 1; }
message UpdateJobRequest { string job_id = 1; JobInput job = 2; }
message GetJobRequest { string job_id = 1; }
message JobIdRequest { string job_id = 1; }
message JobResponse { Job job = 1; }
message DeleteJobResponse {}

message ListJobsRequest { JobStatus status = 1; int32 page = 2; int32 limit = 3; string company_id = 4; string query = 5; }
message ListJobsResponse { repeated Job jobs = 1; int32 total = 2; int32 page = 3; int32 limit = 4; }

message AttachResumeTemplateRequest { string job_id = 1; string file_name = 2; string content_type = 3; bytes content = 4; }
message GetResumeTemplateRequest { string job_id = 1; bool include_content = 2; }
message ResumeTemplate { string id = 1; string job_id = 2; string file_name = 3; string content_type = 4; int64 size_bytes = 5; bytes content = 6; string created_at = 7; }
message ResumeTemplateResponse { ResumeTemplate template = 1; }
message DeleteResumeTemplateResponse {}
```

In the proto, enum values are prefixed (`EMPLOYMENT_TYPE_FULL_TIME`). The domain and MongoDB use the bare names (`FULL_TIME`). `src/grpc/job.mapper.ts` converts between the two, as pure functions.

`GetResumeTemplate` returns `NOT_FOUND` when the job has no template. With `include_content = false` it returns only metadata.

## Errors

| Domain error | gRPC status |
|---|---|
| `ValidationError` | `INVALID_ARGUMENT`. Field errors also go in trailing metadata `x-validation-errors`, as a JSON `{ field, message }[]` |
| `NotFoundError` | `NOT_FOUND` |
| `InvalidStateError` | `FAILED_PRECONDITION` |
| `UnauthorizedError` | `UNAUTHENTICATED` |
| `ForbiddenError` | `PERMISSION_DENIED` |
| Anything else | `INTERNAL` with the message "Internal server error". The details are logged, not sent |

`NotImplementedError` and its code are removed once nothing uses them.

## Code structure

| File | Change |
|---|---|
| `src/types/job.types.ts` | Domain types above, `Caller`, `JobInput`, `ListJobsQuery` |
| `src/validation/job.validation.ts` | **New.** `validateJobInput`, `assertPublishable` |
| `src/models/job.model.ts`, `src/models/resume-template.model.ts` | Mongoose schemas with string `_id` and the indexes |
| `src/repositories/job.repository.ts` | A `JobRepository` **interface** plus `MongoJobRepository`. Maps `_id` to `id` and returns plain objects |
| `src/services/job.service.ts` | Every operation takes `(caller, ...)`. Holds the lifecycle, ownership and visibility rules |
| `src/grpc/identity.ts`, `src/grpc/job.mapper.ts` | **New** |
| `src/grpc/job-posting.grpc.ts` | All 11 handlers. Thin: read identity, map, call the service, map back |
| `src/container.ts` | Wires `MongoJobRepository` |
| `src/app.ts` | Only `/health`. REST job routes, controller and auth middleware are deleted |
| `src/config/env.ts` | Defaults `HTTP_PORT=3002`, `GRPC_PORT=50052` |
| `src/scripts/seed.ts` + `npm run seed` | Upserts about 10 sample jobs with fixed IDs (`job_seed_<slug>`). Taken from the frontend's current mock jobs; the frontend's mock applications refer to these IDs |
| `Dockerfile`, `README.md`, `TODO.md`, `.env.example` | Ports, API docs, finished TODOs |

## Testing

Everything uses the built-in Node test runner (`npm test`), with no new test dependencies.

- **Validation unit tests:** every rule, and `assertPublishable`.
- **`JobService` unit tests** against `InMemoryJobRepository` (`tests/fakes/`):
  - every lifecycle transition, allowed and rejected
  - ownership checks
  - visibility rules
  - delete only for drafts
  - `publishedAt` set only once
  - replacing a template
- **Mapper tests:** converting a domain job to proto and back gives the same job, including enum prefixes and unset optional values.
- **gRPC tests:** a server on port 0, backed by the in-memory repository, and a real client:
  - each RPC works
  - metadata identity is enforced
  - the status codes are right
  - `x-validation-errors` metadata is present
- **Optional MongoDB integration test:** runs only if `MONGODB_TEST_URI` is set.
- **Always:** `npm run typecheck` and `npm run build` pass.

## Environment

| Variable | Default | Change |
|---|---|---|
| `HTTP_PORT` | `3002` | default was 3000 |
| `GRPC_HOST` | `0.0.0.0` | — |
| `GRPC_PORT` | `50052` | default was 50051 |
| `MONGODB_URI` | `mongodb://localhost:27017/rolefit_job_posting` | — |
