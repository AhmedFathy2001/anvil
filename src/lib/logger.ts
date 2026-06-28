// Thin structured-logging wrapper.
//
// Writes single-line JSON in production (friendly to Vercel log ingestion and
// Logtail-style aggregators) and prettier output in dev.
//
// Usage:
//   import { log } from '@/lib/logger';
//   log.info('clan-sync.ok', { added, updated });
//   log.warn('discord.rate-limited', { retryAfter });
//   log.error('hiscores.fail', { rsn }, err);

type Level = 'debug' | 'info' | 'warn' | 'error';

const IS_PROD = process.env.NODE_ENV === 'production';

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
}

export const log = {
  debug: (event: string, meta?: Record<string, unknown>) => emit('debug', event, meta),
  info: (event: string, meta?: Record<string, unknown>) => emit('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>, err?: unknown) => emit('warn', event, meta, err),
  error: (event: string, meta?: Record<string, unknown>, err?: unknown) => emit('error', event, meta, err),
};
