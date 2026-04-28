// Small helper for reading required secrets.
// In production runtime we fail loudly at first read so the app never boots with a weak default.
// In dev/test (and during `next build`'s page-data collection, which sets NODE_ENV=production
// but doesn't actually serve traffic) we fall back to the provided string so local workflows
// and CI builds keep working without real secrets in the environment.

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';
const IS_PROD_RUNTIME = process.env.NODE_ENV === 'production' && !IS_BUILD;

export function requireSecret(name: string, devDefault: string): string {
  const raw = process.env[name];
  if (raw && raw.length > 0) return raw;
  if (IS_PROD_RUNTIME) {
    throw new Error(
      `Missing required env var "${name}". Set it in your deployment environment.`,
    );
  }
  return devDefault;
}
