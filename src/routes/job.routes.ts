import { Router } from 'express';
import { JobController } from '../controllers/job.controller';
import type { JobService } from '../services/job.service';

// Public REST API consumed by the web frontend. Mounted at /api/jobs.
//
// Lifecycle transitions are modelled as explicit action endpoints
// (POST /:jobId/publish etc.) rather than letting clients PUT a raw `status`,
// so JobService stays in control of the state rules.
//
// TODO: Add request validation middleware per route.
// TODO: Add authentication/authorization middleware (e.g. only the job owner may update).
export function createJobRouter(jobService: JobService): Router {
  const router = Router();
  const controller = new JobController(jobService);

  router.post('/', controller.createJob);
  router.get('/', controller.listJobs);
  router.get('/:jobId', controller.getJob);
  router.put('/:jobId', controller.updateJob);
  router.delete('/:jobId', controller.deleteJob);

  router.post('/:jobId/publish', controller.publishJob);
  router.post('/:jobId/close', controller.closeJob);
  router.post('/:jobId/reopen', controller.reopenJob);

  // TODO: Consider PUT instead of POST if a job has exactly one template (idempotent replace).
  router.post('/:jobId/resume-template', controller.attachResumeTemplate);
  router.get('/:jobId/resume-template', controller.getResumeTemplate);

  return router;
}
