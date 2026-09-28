import * as grpc from '@grpc/grpc-js';
import type { JobService } from '../services/job.service';
import { AppError, ValidationError, type ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
import { callerFrom } from './identity';
import { fromProtoJobInput, fromProtoStatus, toProtoJob, toProtoTemplate } from './job.mapper';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Msg = Record<string, any>;

const GRPC_STATUS: Record<ErrorCode, grpc.status> = {
  NOT_IMPLEMENTED: grpc.status.UNIMPLEMENTED,
  NOT_FOUND: grpc.status.NOT_FOUND,
  VALIDATION_ERROR: grpc.status.INVALID_ARGUMENT,
  INVALID_STATE: grpc.status.FAILED_PRECONDITION,
  UNAUTHORIZED: grpc.status.UNAUTHENTICATED,
  FORBIDDEN: grpc.status.PERMISSION_DENIED,
};

/**
 * ASCII metadata values may only hold printable ASCII, so non-ASCII characters
 * (e.g. Thai skill names in messages) are written as \uXXXX JSON escapes.
 * JSON.parse on the client restores them.
 */
function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(/[^\x20-\x7e]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function toGrpcError(err: unknown): Partial<grpc.ServiceError> {
  if (err instanceof AppError) {
    const metadata = new grpc.Metadata();
    if (err instanceof ValidationError) metadata.set('x-validation-errors', asciiJson(err.details));
    return { code: GRPC_STATUS[err.code], details: err.message, metadata };
  }
  logger.error('Unhandled gRPC error', err);
  return { code: grpc.status.INTERNAL, details: 'Internal server error' };
}

/** Wraps a handler: reads identity, runs it, maps the result or error. */
function unary(run: (request: Msg, caller: ReturnType<typeof callerFrom>) => Promise<Msg>): grpc.handleUnaryCall<Msg, Msg> {
  return async (call, callback) => {
    try {
      callback(null, await run(call.request, callerFrom(call.metadata)));
    } catch (err) {
      callback(toGrpcError(err));
    }
  };
}

/**
 * gRPC handlers for JobPostingService: a thin transport layer on top of
 * JobService (identity, mapping, errors). No business rules here.
 */
export function createJobPostingHandlers(jobService: JobService): grpc.UntypedServiceImplementation {
  const job = async (p: Promise<Parameters<typeof toProtoJob>[0]>) => ({ job: toProtoJob(await p) });

  return {
    CreateJob: unary((req, caller) => job(jobService.createJob(caller, fromProtoJobInput(req.job)))),
    GetJob: unary((req, caller) => job(jobService.getJob(caller, req.job_id))),
    UpdateJob: unary((req, caller) => job(jobService.updateJob(caller, req.job_id, fromProtoJobInput(req.job)))),
    PublishJob: unary((req, caller) => job(jobService.publishJob(caller, req.job_id))),
    CloseJob: unary((req, caller) => job(jobService.closeJob(caller, req.job_id))),
    ReopenJob: unary((req, caller) => job(jobService.reopenJob(caller, req.job_id))),

    DeleteJob: unary(async (req, caller) => {
      await jobService.deleteJob(caller, req.job_id);
      return {};
    }),

    ListJobs: unary(async (req, caller) => {
      const result = await jobService.listJobs(caller, {
        status: fromProtoStatus(req.status),
        companyId: req.company_id || undefined,
        query: req.query || undefined,
        page: req.page || undefined,
        limit: req.limit || undefined,
      });
      return { jobs: result.items.map(toProtoJob), total: result.total, page: result.page, limit: result.limit };
    }),

    AttachResumeTemplate: unary(async (req, caller) => {
      const template = await jobService.attachResumeTemplate(caller, req.job_id, {
        fileName: req.file_name ?? '',
        contentType: req.content_type ?? '',
        content: Buffer.from(req.content ?? []),
      });
      return { template: toProtoTemplate(template) };
    }),

    GetResumeTemplate: unary(async (req, caller) => ({
      template: toProtoTemplate(await jobService.getResumeTemplate(caller, req.job_id, Boolean(req.include_content))),
    })),

    DeleteResumeTemplate: unary(async (req, caller) => {
      await jobService.deleteResumeTemplate(caller, req.job_id);
      return {};
    }),
  };
}
