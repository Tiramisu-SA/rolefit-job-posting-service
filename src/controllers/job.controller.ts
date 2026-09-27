import type { Request, Response } from 'express';
import type { JobService } from '../services/job.service';
import { jobPostingGrpcClient } from '../container';

/**
 * REST controller: translates HTTP <-> JobService calls.
 * Keep it thin - no business rules here. Errors thrown by the service are
 * forwarded to the error-handler middleware automatically (Express 5).
 *
 * TODO: Validate/parse request bodies and query strings before calling the service.
 * TODO: Map domain objects to response DTOs if the API shape differs from Job.
 */
export class JobController {
  constructor(private readonly jobService: JobService) {}

  createJob = async (req: Request, res: Response) => {
    jobPostingGrpcClient.CreateJob(
      {
        title: req.body.title,
        description: req.body.description,
        requirements: req.body.requirements,
      },
      (err: any, response: any) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        return res.status(201).json(response.job);
      },
    );
  };
  // createJob = async (req: Request, res: Response) => {
  //   const job = await this.jobService.createJob(req.body);
  //   res.status(201).json(job);
  // };

  updateJob = async (req: Request<{ jobId: string }>, res: Response) => {
    jobPostingGrpcClient.UpdateJob(
      {
        job_id: req.params.jobId,
        title: req.body.title,
        description: req.body.description,
        requirements: req.body.requirements,
      },
      (err: any, response: any) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        return res.json(response.job);
      },
    );
  };
  // updateJob = async (req: Request<{ jobId: string }>, res: Response) => {
  //   const job = await this.jobService.updateJob(req.params.jobId, req.body);
  //   res.json(job);
  // };

  publishJob = async (req: Request<{ jobId: string }>, res: Response) => {
    const job = await this.jobService.publishJob(req.params.jobId);
    res.json(job);
  };

  closeJob = async (req: Request<{ jobId: string }>, res: Response) => {
    const job = await this.jobService.closeJob(req.params.jobId);
    res.json(job);
  };

  reopenJob = async (req: Request<{ jobId: string }>, res: Response) => {
    const job = await this.jobService.reopenJob(req.params.jobId);
    res.json(job);
  };

  getJob = async (req: Request<{ jobId: string }>, res: Response) => {
    const job = await this.jobService.getJob(req.params.jobId);
    res.json(job);
  };

  deleteJob = async (req: Request<{ jobId: string }>, res: Response) => {
    jobPostingGrpcClient.DeleteJob(
      {
        job_id: req.params.jobId,
      },
      (err: any, response: any) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        return res.status(204).send();
      },
    );
  };

  listJobs = async (req: Request, res: Response) => {
    const request = {
      status: 0,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 10),
    };

    jobPostingGrpcClient.ListJobs(request, (err: any, response: any) => {
      if (err) {
        return res.status(500).json({
          error: err.message,
        });
      }

      return res.json(response);
    });
  };
  // listJobs = async (req: Request, res: Response) => {
  //   // TODO: Parse and validate query params (status, page, limit, ...).
  //   const result = await this.jobService.listJobs(req.query as never);
  //   res.json(result);
  // };

  attachResumeTemplate = async (
    req: Request<{ jobId: string }>,
    res: Response,
  ) => {
    const template = await this.jobService.attachResumeTemplate(
      req.params.jobId,
      req.body,
    );
    res.status(201).json(template);
  };

  getResumeTemplate = async (
    req: Request<{ jobId: string }>,
    res: Response,
  ) => {
    const template = await this.jobService.getResumeTemplate(req.params.jobId);
    res.json(template);
  };
}
