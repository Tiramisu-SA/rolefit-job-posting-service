/**
 * A MongoDB URI that is safe to log: the user and password are replaced by `***`.
 * The Atlas URI holds the database password, so never log `env.mongodbUri` directly.
 */
export function redactMongoUri(uri: string): string {
  // Everything between "scheme://" (or the start) and the last "@" before the host is credentials.
  return uri.replace(/^([a-z+]+:\/\/)?[^@/\s]*(?:\s[^@/]*)*@/i, (_match, scheme: string | undefined) => `${scheme ?? ''}***@`);
}
