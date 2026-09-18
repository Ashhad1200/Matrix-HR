/**
 * Refuses to boot in production with development defaults. Several settings fall back to well-known
 * constants when unset (JWT secrets, credential key, localhost CORS); silently running that way in
 * production would mean forgeable tokens and a wide-open origin, so it must be a startup failure.
 */
const weak = (v?: string) => !v || v.length < 32 || /dev|change-me|change_me|secret-change|example|password/i.test(v);

export function productionConfigProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is not set');
  if (weak(env.JWT_SECRET)) problems.push('JWT_SECRET must be a random value of at least 32 characters (not a dev default)');
  if (weak(env.JWT_REFRESH_SECRET)) problems.push('JWT_REFRESH_SECRET must be a random value of at least 32 characters (not a dev default)');
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  if (weak(env.CREDENTIAL_KEY)) problems.push('CREDENTIAL_KEY must be a random value of at least 32 characters (encrypts integration credentials)');
  if (!env.WEB_URL || /localhost|127\.0\.0\.1/.test(env.WEB_URL)) problems.push('WEB_URL must be your public web origin (it is the CORS allow-list and the base of emailed links)');
  if (env.WEBHOOK_ALLOW_PRIVATE_TARGETS === 'true') problems.push('WEBHOOK_ALLOW_PRIVATE_TARGETS=true lets tenants aim webhooks at internal services — dev only');
  if (env.THROTTLE_LIMIT || env.AUTH_THROTTLE_LIMIT) problems.push('THROTTLE_LIMIT / AUTH_THROTTLE_LIMIT are test-only overrides and must not be set in production');
  return problems;
}

export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env) {
  const problems = productionConfigProblems(env);
  if (problems.length) {
    throw new Error(`Refusing to start with an unsafe production configuration:\n - ${problems.join('\n - ')}`);
  }
}
