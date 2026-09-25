import * as grpc from '@grpc/grpc-js';
import type { JobService } from '../services/job.service';
import { AppError, type ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

// Plain TS shapes of the proto messages (proto-loader uses keepCase: true, so snake_case).
// TODO: Optionally generate these types with `proto-loader-gen-types` instead of hand-writing them.
interface GetJobRequest {
  job_id: string;
}
interface ListJobsRequest {
  status: string;
  page: number;
  limit: number;
}

const GRPC_STATUS: Record<ErrorCode, grpc.status> = {
  NOT_IMPLEMENTED: grpc.status.UNIMPLEMENTED,
  NOT_FOUND: grpc.status.NOT_FOUND,
  VALIDATION_ERROR: grpc.status.INVALID_ARGUMENT,
  INVALID_STATE: grpc.status.FAILED_PRECONDITION,
  UNAUTHORIZED: grpc.status.UNAUTHENTICATED,
  FORBIDDEN: grpc.status.PERMISSION_DENIED,
};

function toGrpcError(err: unknown): Partial<grpc.ServiceError> {
  if (err instanceof AppError) {
    return { code: GRPC_STATUS[err.code], details: err.message };
  }
  logger.error('Unhandled gRPC error', err);
  return { code: grpc.status.INTERNAL, details: 'Internal server error' };
}

/**
 * gRPC handlers for JobPostingService. Like the REST controller, these are a thin
 * transport layer on top of the SAME JobService - no business logic here.
 */
export function createJobPostingHandlers(jobService: JobService): grpc.UntypedServiceImplementation {
  return {
    GetJob: async (
      call: grpc.ServerUnaryCall<GetJobRequest, unknown>,
      callback: grpc.sendUnaryData<unknown>,
    ) => {
      try {
        const job = await jobService.getJob(call.request.job_id);
        // TODO: Map the domain Job to the proto Job message (status enum, timestamps, ...).
        // TODO: Decide whether DRAFT jobs should be visible to Job Discovery Service.
        callback(null, { job });
      } catch (err) {
        callback(toGrpcError(err));
      }
    },

    ListJobs: async (
      call: grpc.ServerUnaryCall<ListJobsRequest, unknown>,
      callback: grpc.sendUnaryData<unknown>,
    ) => {
      try {
        // TODO: Map proto request (enum status, zero-valued page/limit) to ListJobsQuery.
        const result = await jobService.listJobs({});
        // TODO: Map domain result to ListJobsResponse.
        callback(null, { jobs: result.items, total: result.total, page: result.page, limit: result.limit });
      } catch (err) {
        callback(toGrpcError(err));
      }
    },
  };
}
