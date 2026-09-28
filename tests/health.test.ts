import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';

// The HTTP port only serves /health; the job API is gRPC (see grpc.test.ts).

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const server = createApp().listen(0);
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

test('the old REST job routes are gone', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/jobs`);
    assert.equal(res.status, 404);
  });
});
