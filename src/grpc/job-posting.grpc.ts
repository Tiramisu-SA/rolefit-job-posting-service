import * as grpc from '@grpc/grpc-js';
import type { JobService } from '../services/job.service';
import { AppError, ValidationError, type ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
import { callerFrom } from './identity';
import { fromProtoJobInput, fromProtoStatus, toProtoJob, toProtoTemplate } from './job.mapper';
import type { ClaimsVerifier } from '../auth/supabase';

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
type Handler = (request: Msg, caller: Awaited<ReturnType<typeof callerFrom>>) => Promise<Msg>;

function unary(run: Handler, verifyClaims: ClaimsVerifier): grpc.handleUnaryCall<Msg, Msg> {
  return async (call, callback) => {
    try {
      const caller = await callerFrom(call.metadata, verifyClaims);
      callback(null, await run(call.request, caller));
    } catch (err) {
      callback(toGrpcError(err));
    }
  };
}

/**
 * gRPC handlers for JobPostingService: a thin transport layer on top of
 * JobService (identity, mapping, errors). No business rules here.
 */
export function createJobPostingHandlers(jobService: JobService, verifyClaims: ClaimsVerifier): grpc.UntypedServiceImplementation {
  const job = async (p: Promise<Parameters<typeof toProtoJob>[0]>) => ({ job: toProtoJob(await p) });
  const authed = (run: Handler) => unary(run, verifyClaims);

  return {
    CreateJob: authed((req, caller) => job(jobService.createJob(caller, fromProtoJobInput(req.job)))),
    GetJob: authed((req, caller) => job(jobService.getJob(caller, req.job_id))),
    UpdateJob: authed((req, caller) => job(jobService.updateJob(caller, req.job_id, fromProtoJobInput(req.job)))),
    PublishJob: authed((req, caller) => job(jobService.publishJob(caller, req.job_id))),
    CloseJob: authed((req, caller) => job(jobService.closeJob(caller, req.job_id))),
    ReopenJob: authed((req, caller) => job(jobService.reopenJob(caller, req.job_id))),

    DeleteJob: authed(async (req, caller) => {
      await jobService.deleteJob(caller, req.job_id);
      return {};
    }),

    ListJobs: authed(async (req, caller) => {
      const result = await jobService.listJobs(caller, {
        status: fromProtoStatus(req.status),
        companyId: req.company_id || undefined,
        query: req.query || undefined,
        page: req.page || undefined,
        limit: req.limit || undefined,
      });
      return { jobs: result.items.map(toProtoJob), total: result.total, page: result.page, limit: result.limit };
    }),

    AttachResumeTemplate: authed(async (req, caller) => {
      const template = await jobService.attachResumeTemplate(caller, req.job_id, {
        fileName: req.file_name ?? '',
        contentType: req.content_type ?? '',
        content: Buffer.from(req.content ?? []),
      });
      return { template: toProtoTemplate(template) };
    }),

    GetResumeTemplate: authed(async (req, caller) => ({
      template: toProtoTemplate(await jobService.getResumeTemplate(caller, req.job_id, Boolean(req.include_content))),
    })),

    DeleteResumeTemplate: authed(async (req, caller) => {
      await jobService.deleteResumeTemplate(caller, req.job_id);
      return {};
    }),
  };
}
