import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { StubAIModelAdapter } from '../src/adapters/ai/ai.adapter';
import { startGrpcServer } from '../src/grpc/grpc.server';
import { JobService } from '../src/services/job.service';
import { logger } from '../src/utils/logger';
import { withCapturedLogs } from './fakes/capture-logs';
import { InMemoryJobRepository } from './fakes/in-memory-job.repository';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACME = { userId: 'user_a', companyId: 'co-acme' };

type Call = (
  method: string,
  request: object,
  requestId?: string,
) => Promise<unknown>;
const newService = () =>
  new JobService(new InMemoryJobRepository(), new StubAIModelAdapter());
const errorMessage = (line: Record<string, unknown>) =>
  (line.error as { message?: string } | undefined)?.message;

async function withClient(
  fn: (call: Call) => Promise<void>,
  service = newService(),
) {
  const { server, port } = await startGrpcServer(service, '127.0.0.1', 0);
  const definition = protoLoader.loadSync(
    path.resolve(__dirname, '../proto/job-posting.proto'),
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  );
  const pkg = grpc.loadPackageDefinition(definition) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const client = new pkg.rolefit.jobposting.v1.JobPostingService(
    `127.0.0.1:${port}`,
    grpc.credentials.createInsecure(),
  );
  const call: Call = (method, request, requestId) =>
    new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      metadata.set('x-user-id', ACME.userId);
      metadata.set('x-company-id', ACME.companyId);
      if (requestId) metadata.set('x-request-id', requestId);
      client[method](
        request,
        metadata,
        (err: grpc.ServiceError | null, res: unknown) =>
          err ? reject(err) : resolve(res),
      );
    });
  try {
    await fn(call);
  } finally {
    client.close();
    server.forceShutdown();
  }
}

test('a gRPC call logs one JSON line with the caller id, the RPC and its status', async () => {
  await withCapturedLogs(async (logs) => {
    await withClient(async (call) => {
      await call('ListJobs', {}, 'req-abc_1.2');
      await assert.rejects(
        call('GetJob', { job_id: 'job_unknown' }, 'req-missing'),
      );

      const ok = await logs.waitFor((l) => l.requestId === 'req-abc_1.2');
      assert.equal(ok.rpc, 'ListJobs');
      assert.equal(ok.grpcStatus, 'OK');
      assert.equal(ok.service, 'job-posting');
      assert.equal(ok.level, 'info');
      assert.equal(typeof ok.durationMs, 'number');

      const missing = await logs.waitFor((l) => l.requestId === 'req-missing');
      assert.equal(missing.rpc, 'GetJob');
      assert.equal(missing.grpcStatus, 'NOT_FOUND');
    });
  });
});

test('every RPC is logged', async () => {
  const rpcs = [
    'CreateJob',
    'GetJob',
    'UpdateJob',
    'PublishJob',
    'CloseJob',
    'ReopenJob',
    'DeleteJob',
    'ListJobs',
    'AttachResumeTemplate',
    'GetResumeTemplate',
    'DeleteResumeTemplate',
  ];
  await withCapturedLogs(async (logs) => {
    await withClient(async (call) => {
      for (const rpc of rpcs) {
        await call(rpc, { job_id: 'job_unknown' }, `req-${rpc}`).catch(
          () => undefined,
        );
        assert.equal(
          (await logs.waitFor((l) => l.requestId === `req-${rpc}`)).rpc,
          rpc,
        );
      }
    });
  });
});

test('a call without a safe id gets a generated one', async () => {
  await withCapturedLogs(async (logs) => {
    await withClient(async (call) => {
      await call('ListJobs', {});
      await call('ListJobs', {}, 'has spaces');
      await call('ListJobs', {}, 'x'.repeat(129));
      await logs.waitFor((l) => l.rpc === 'ListJobs');
      const ids = logs
        .lines()
        .filter((l) => l.rpc === 'ListJobs')
        .map((l) => l.requestId);
      assert.equal(ids.length, 3);
      for (const id of ids) assert.match(String(id), UUID);
    });
  });
});

test('overlapping calls keep their own ids in error logs', async () => {
  const service = newService();
  service.getJob = async (_caller, jobId) => {
    await new Promise((resolve) =>
      setTimeout(resolve, jobId === 'job_slow' ? 40 : 5),
    );
    throw new Error(`boom-${jobId}`);
  };
  await withCapturedLogs(async (logs) => {
    await withClient(async (call) => {
      await Promise.all([
        call('GetJob', { job_id: 'job_slow' }, 'req-slow').catch(
          () => undefined,
        ),
        call('GetJob', { job_id: 'job_fast' }, 'req-fast').catch(
          () => undefined,
        ),
      ]);
      assert.equal(
        (await logs.waitFor((l) => errorMessage(l) === 'boom-job_slow'))
          .requestId,
        'req-slow',
      );
      assert.equal(
        (await logs.waitFor((l) => errorMessage(l) === 'boom-job_fast'))
          .requestId,
        'req-fast',
      );
    }, service);
  });
});

test('the logger writes an Error as JSON and survives values JSON cannot represent', async () => {
  await withCapturedLogs(async (logs) => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    logger.error('It failed', new TypeError('bad input'));
    logger.error('Circular detail', circular);
    const error = (await logs.waitFor((l) => l.message === 'It failed'))
      .error as { name: string; message: string };
    assert.equal(error.name, 'TypeError');
    assert.equal(error.message, 'bad input');
    await logs.waitFor((l) => l.message === 'Circular detail');
  });
});
