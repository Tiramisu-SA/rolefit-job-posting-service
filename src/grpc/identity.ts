import type { Metadata } from '@grpc/grpc-js';
import type { Caller } from '../types/job.types';

/**
 * Mock identity: trusts the `x-user-id` / `x-company-id` metadata because real
 * auth is not wired yet. The web frontend's Next.js server sets them for
 * recruiter calls. When real auth arrives, only this function changes.
 */
export function callerFrom(metadata: Metadata): Caller {
  const read = (key: string) => {
    const [value] = metadata.get(key);
    return typeof value === 'string' ? value.trim().slice(0, 100) : '';
  };
  const userId = read('x-user-id');
  const companyId = read('x-company-id');
  return userId && companyId ? { userId, companyId } : null;
}
