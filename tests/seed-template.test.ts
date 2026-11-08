import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCX_CONTENT_TYPE, seedTemplateFile } from '../src/scripts/seed-template';

test('seed template is a real DOCX under 2 MB', () => {
  const t = seedTemplateFile('Brightline standard resume');
  assert.equal(t.fileName, 'Brightline standard resume.docx');
  assert.equal(t.contentType, DOCX_CONTENT_TYPE);
  assert.deepEqual([...t.content.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(t.sizeBytes, t.content.length);
  assert.ok(t.sizeBytes > 0 && t.sizeBytes < 2 * 1024 * 1024);
});
