const DAY_MS = 24 * 60 * 60 * 1000;
const EARLIEST_DEADLINE_DAYS = 30;

interface SeedJob {
  status: string;
  applicationSettings: { applicationDeadline?: string | null };
}

const isOpenWithDeadline = (job: SeedJob) =>
  job.status === 'OPEN' && Boolean(job.applicationSettings.applicationDeadline);

/**
 * The seed file has fixed dates, which pass as time goes on, and the Application
 * Service refuses applications after a job's deadline. This moves the open jobs'
 * deadlines so the earliest is 30 days from now, keeping the gaps between them.
 */
export function withFutureDeadlines<T extends SeedJob>(
  jobs: readonly T[],
  now: Date,
): T[] {
  const deadlines = jobs
    .filter(isOpenWithDeadline)
    .map((job) => Date.parse(job.applicationSettings.applicationDeadline!));
  if (deadlines.length === 0) return [...jobs];

  const shift =
    now.getTime() + EARLIEST_DEADLINE_DAYS * DAY_MS - Math.min(...deadlines);
  return jobs.map((job) =>
    isOpenWithDeadline(job)
      ? {
          ...job,
          applicationSettings: {
            ...job.applicationSettings,
            applicationDeadline: new Date(
              Date.parse(job.applicationSettings.applicationDeadline!) + shift,
            ).toISOString(),
          },
        }
      : job,
  );
}
