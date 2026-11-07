import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactMongoUri } from '../src/utils/redact-uri';

test('hides the user and password of an Atlas URI', () => {
  assert.equal(
    redactMongoUri('mongodb+srv://rolefit:S3cret%40pw@cluster0.abc.mongodb.net/rolefit_job_posting?retryWrites=true'),
    'mongodb+srv://***@cluster0.abc.mongodb.net/rolefit_job_posting?retryWrites=true',
  );
});

test('hides a user without a password', () => {
  assert.equal(redactMongoUri('mongodb://admin@localhost:27017/db'), 'mongodb://***@localhost:27017/db');
});

test('leaves a URI without credentials unchanged', () => {
  assert.equal(redactMongoUri('mongodb://localhost:27017/rolefit_job_posting'), 'mongodb://localhost:27017/rolefit_job_posting');
});

test('never returns the password, even for a malformed URI', () => {
  const out = redactMongoUri('not a uri user:topsecret@host');
  assert.ok(!out.includes('topsecret'));
});
