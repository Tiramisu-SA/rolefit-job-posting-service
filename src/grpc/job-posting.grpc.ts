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
  status: number;
  page: number;
  limit: number;
}

interface CreateJobRequest {
  title: string;
  description: string;
  requirements: string;
}

interface UpdateJobRequest {
  job_id: string;
  title: string;
  description: string;
  requirements: string;
}

interface DeleteJobRequest {
  job_id: string;
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
    return {
      code: GRPC_STATUS[err.code],
      details: err.message,
    };
  }

  logger.error('Unhandled gRPC error', err);

  return {
    code: grpc.status.INTERNAL,
    details: 'Internal server error',
  };
}

/**
 * gRPC handlers for JobPostingService. Like the REST controller, these are a thin
 * transport layer on top of the SAME JobService - no business logic here.
 */
export function createJobPostingHandlers(
  jobService: JobService,
): grpc.UntypedServiceImplementation {
  return {
    GetJob: async (
      call: grpc.ServerUnaryCall<GetJobRequest, unknown>,
      callback: grpc.sendUnaryData<unknown>,
    ) => {
      try {
        const job = await jobService.getJob(call.request.job_id);
        // TODO: Map the domain Job to the proto Job message (status enum, timestamps, ...).
        // TODO: Decide whether DRAFT jobs should be visible to Job Discovery Service.

        callback(null, {
          job,
        });
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
        console.log('[gRPC] ListJobs called');

        const query: any = {
          page: call.request.page || 1,
          limit: call.request.limit || 10,
        };

        // 0 = JOB_STATUS_UNSPECIFIED
        if (call.request.status && call.request.status !== 0) {
          const statusMap: Record<number, string> = {
            1: 'DRAFT',
            2: 'PUBLISHED',
            3: 'CLOSED',
          };

          query.status = statusMap[call.request.status];
        }

        const result = await jobService.listJobs(query);

        callback(null, {
          jobs: result.items,
          total: result.total,
          page: result.page,
          limit: result.limit,
        });
      } catch (err) {
        callback(toGrpcError(err));
      }
    },

    CreateJob: async (
      call: grpc.ServerUnaryCall<CreateJobRequest, unknown>,
      callback: grpc.sendUnaryData<unknown>,
    ) => {
      try {
        console.log('[gRPC] CreateJob called');

        const job = await jobService.createJob({
          title: call.request.title,
          description: call.request.description,
          requirements: call.request.requirements,
        });

        callback(null, {
          job,
        });
      } catch (err) {
        callback(toGrpcError(err));
      }
    },

    UpdateJob: async (
      call: grpc.ServerUnaryCall<UpdateJobRequest, unknown>,
      callback: grpc.sendUnaryData<unknown>,
    ) => {
      try {
        console.log('[gRPC] UpdateJob called');

        const job = await jobService.updateJob(call.request.job_id, {
          title: call.request.title,
          description: call.request.description,
          requirements: call.request.requirements,
        });

        callback(null, {
          job,
        });
      } catch (err) {
        callback(toGrpcError(err));
      }
    },

    DeleteJob: async (
      call: grpc.ServerUnaryCall<DeleteJobRequest, unknown>,
      callback: grpc.sendUnaryData<unknown>,
    ) => {
      try {
        console.log('[gRPC] DeleteJob called');

        await jobService.deleteJob(call.request.job_id);

        callback(null, {
          success: true,
        });
      } catch (err) {
        callback(toGrpcError(err));
      }
    },
  };
}
