// Thin structured-logging wrapper.
//
// Writes single-line JSON in production (friendly to Vercel log ingestion and
// Logtail-style aggregators) and prettier output in dev. Optionally forwards
// error-level events to Sentry if SENTRY_DSN is configured and @sentry/nextjs
// is installed — the import is dynamic so the dep is entirely optional.
//
// Usage:
//   import { log } from '@/lib/logger';
//   log.info('clan-sync.ok', { added, updated });
//   log.warn('discord.rate-limited', { retryAfter });
//   log.error('hiscores.fail', { rsn }, err);

type Level = 'debug' | 'info' | 'warn' | 'error';

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';
const SENTRY_DSN = process.env.SENTRY_DSN;

type SentryModule = {
  init: (opts: { dsn: string; tracesSampleRate?: number; environment?: string }) => void;
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
  captureMessage: (msg: string, ctx?: Record<string, unknown>) => void;
};

let sentryPromise: Promise<SentryModule | null> | null = null;

function getSentry(): Promise<SentryModule | null> {
  if (!SENTRY_DSN || IS_BUILD) return Promise.resolve(null);
  if (sentryPromise) return sentryPromise;
  // Dynamic import with a runtime-computed module name so TypeScript doesn't
  // resolve the package at compile time — `@sentry/nextjs` stays an optional,
  // install-at-will dependency.
  const moduleName = '@sentry/nextjs';
  sentryPromise = import(/* webpackIgnore: true */ /* @vite-ignore */ moduleName)
    .then((mod: unknown) => {
      const sentry = mod as SentryModule;
      sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      });
      return sentry;
    })
    .catch(() => null);
  return sentryPromise;
}

function emit(level: Level, event: string, meta?: Record<string, unknown>, err?: unknown) {
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
  };
  if (meta) Object.assign(record, meta);
  if (err instanceof Error) {
    record.err = { name: err.name, message: err.message, stack: err.stack };
  } else if (err !== undefined) {
    record.err = err;
  }

  if (IS_PROD) {
    const line = JSON.stringify(record);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } else {
    const tag = `[${level}]`;
    if (level === 'error') console.error(tag, event, meta ?? '', err ?? '');
    else if (level === 'warn') console.warn(tag, event, meta ?? '', err ?? '');
    else console.log(tag, event, meta ?? '');
  }

  if (level === 'error' || level === 'warn') {
    void getSentry().then((s) => {
      if (!s) return;
      if (err !== undefined) s.captureException(err, { extra: meta });
      else s.captureMessage(event, { level, extra: meta });
    });
  }
}

export const log = {
  debug: (event: string, meta?: Record<string, unknown>) => emit('debug', event, meta),
  info: (event: string, meta?: Record<string, unknown>) => emit('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>, err?: unknown) => emit('warn', event, meta, err),
  error: (event: string, meta?: Record<string, unknown>, err?: unknown) => emit('error', event, meta, err),
};
