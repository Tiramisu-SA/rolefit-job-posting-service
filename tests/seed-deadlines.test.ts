import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFutureDeadlines } from '../src/scripts/seed-deadlines';
import seedJobs from '../src/scripts/seed-jobs.json';

const NOW = new Date('2026-11-04T00:00:00.000Z');

const job = (status: string, applicationDeadline?: string | null) => ({
  status,
  applicationSettings: { applicationDeadline },
});
const deadlineOf = (seed: {
  applicationSettings: { applicationDeadline?: string | null };
}) => seed.applicationSettings.applicationDeadline;

test('open jobs move so the earliest deadline is 30 days away, keeping their spacing', () => {
  const [first, second] = withFutureDeadlines(
    [
      job('OPEN', '2026-10-05T00:00:00.000Z'),
      job('OPEN', '2026-10-25T00:00:00.000Z'),
    ],
    NOW,
  );
  assert.equal(deadlineOf(first), '2026-12-04T00:00:00.000Z');
  assert.equal(deadlineOf(second), '2026-12-24T00:00:00.000Z');
});

test('closed and draft jobs keep their dates, and do not affect the shift', () => {
  const [closed, draft, open] = withFutureDeadlines(
    [
      job('CLOSED', '2026-01-01T00:00:00.000Z'),
      job('DRAFT', '2026-02-01T00:00:00.000Z'),
      job('OPEN', '2026-10-05T00:00:00.000Z'),
    ],
    NOW,
  );
  assert.equal(deadlineOf(closed), '2026-01-01T00:00:00.000Z');
  assert.equal(deadlineOf(draft), '2026-02-01T00:00:00.000Z');
  assert.equal(deadlineOf(open), '2026-12-04T00:00:00.000Z');
});

test('an open job without a deadline stays without one', () => {
  const [none, nullish, open] = withFutureDeadlines(
    [job('OPEN'), job('OPEN', null), job('OPEN', '2026-10-05T00:00:00.000Z')],
    NOW,
  );
  assert.equal(deadlineOf(none), undefined);
  assert.equal(deadlineOf(nullish), null);
  assert.equal(deadlineOf(open), '2026-12-04T00:00:00.000Z');
});

test('other job fields and the input are left alone', () => {
  const input = [
    { ...job('OPEN', '2026-10-05T00:00:00.000Z'), title: 'Developer' },
  ];
  const [output] = withFutureDeadlines(input, NOW);
  assert.equal(output.title, 'Developer');
  assert.equal(deadlineOf(input[0]), '2026-10-05T00:00:00.000Z');
});

test('every open job in the real seed file can be applied to, whenever it is seeded', () => {
  for (const seededAt of [NOW, new Date('2030-06-15T12:00:00.000Z')]) {
    const seeded = withFutureDeadlines(seedJobs, seededAt);
    const open = seeded.filter((s) => s.status === 'OPEN');
    assert.ok(open.length > 0);
    for (const s of open) {
      const deadline = deadlineOf(s);
      assert.ok(deadline, `${s.title} has no deadline`);
      assert.ok(
        Date.parse(deadline) > seededAt.getTime(),
        `${s.title}: ${deadline}`,
      );
    }
  }
});
