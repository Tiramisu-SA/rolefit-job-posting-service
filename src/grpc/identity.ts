import type { Metadata } from '@grpc/grpc-js';
import { UnauthorizedError } from '../utils/errors';
import type { ClaimsVerifier } from '../auth/supabase';
import type { Caller } from '../types/job.types';

/** Verify gRPC bearer metadata and derive identity only from signed claims. */
export async function callerFrom(metadata: Metadata, verifyClaims: ClaimsVerifier): Promise<Caller> {
  const values = metadata.get('authorization');
  if (values.length !== 1 || typeof values[0] !== 'string') throw new UnauthorizedError();
  const match = /^Bearer\s+([^\s]+)$/i.exec(values[0]);
  if (!match) throw new UnauthorizedError();

  let claims;
  try {
    claims = await verifyClaims(match[1]);
  } catch {
    throw new UnauthorizedError();
  }
  if (!claims || typeof claims.sub !== 'string' || !claims.sub.trim()) throw new UnauthorizedError();

  const appMetadata = claims.app_metadata;
  const role = typeof appMetadata?.role === 'string' ? appMetadata.role : undefined;
  const rawCompanyId = appMetadata?.company_id;
  const companyId = typeof rawCompanyId === 'string' && rawCompanyId.trim() ? rawCompanyId.trim() : undefined;
  return { userId: claims.sub, role, companyId };
}
