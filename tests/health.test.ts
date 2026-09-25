import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { jobService } from '../src/container';

// Smoke tests for the skeleton. No MongoDB required.
// TODO: Add unit tests for JobService (with a fake repository) as logic is implemented.
// TODO: Add integration tests for the repository (e.g. mongodb-memory-server or a test DB).
// TODO: Add gRPC tests for GetJob / ListJobs.

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const server = createApp(jobService).listen(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('GET /health returns ok', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'ok');
  });
});

test('unimplemented business operations return 501', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/jobs/123`);
    assert.equal(res.status, 501);
  });
});
