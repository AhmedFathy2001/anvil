import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, errorEvents, users } from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import ResolveButton from './ResolveButton';

export const dynamic = 'force-dynamic';

/**
 * What is broken, across every clan.
 *
 * The counterpart to the hourly digest: the digest says what changed, this says what stands. One row
 * per distinct failure (lib/errorFingerprint), so the same broken handler firing four thousand times
 * overnight is one line with a count rather than four thousand lines nobody reads.
 *
 * WHY A COUNT AND A LAST-SEEN ARE THE TWO COLUMNS THAT MATTER. "Happened 3 times, last on Tuesday" and
 * "happened 9,000 times, last 40 seconds ago" want completely different responses, and the raw log
 * this replaces made them look identical.
 *
 * Resolving is a note to the other operators, not a fix — and it is deliberately not sticky: the
 * next occurrence clears it (see lib/errorEvents), because a failure that came back is news whatever
 * anybody ticked last week.
 */
export default async function StaffErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const showResolved = (await searchParams).show === 'resolved';

  // clan-scope: global -- the operator surface spans every clan; that is what makes it the
  // platform's error list rather than one clan's.
  const rows = await db
    .select({
      id: errorEvents.id,
      name: errorEvents.name,
      message: errorEvents.message,
      stack: errorEvents.stack,
      path: errorEvents.path,
      method: errorEvents.method,
      source: errorEvents.source,
      release: errorEvents.release,
      count: errorEvents.count,
      firstSeenAt: errorEvents.firstSeenAt,
      lastSeenAt: errorEvents.lastSeenAt,
      resolvedAt: errorEvents.resolvedAt,
      clanSlug: clans.slug,
      clanName: clans.name,
      resolvedBy: users.displayName,
    })
    .from(errorEvents)
    .leftJoin(clans, eq(clans.id, errorEvents.clanId))
    .leftJoin(users, eq(users.id, errorEvents.resolvedByUserId))
    .where(showResolved ? isNotNull(errorEvents.resolvedAt) : isNull(errorEvents.resolvedAt))
    .orderBy(desc(errorEvents.lastSeenAt))
    .limit(200);

  const [openCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(errorEvents)
    .where(isNull(errorEvents.resolvedAt));

  return (
    <div>
      <header className="mb-6">
        <h1 className="display text-2xl font-semibold text-gold">Errors</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-text-muted">
          Every server-side failure, folded by cause rather than logged one line at a time. The
          hourly digest posts what is new to the ops channel; this is the standing list.
        </p>
      </header>

      <nav className="mb-5 flex gap-2 text-sm">
        <a
          href="/staff/errors"
          className={`rounded-lg border px-3 py-1.5 ${
            showResolved
              ? 'border-card-border text-text-muted hover:text-gold'
              : 'border-gold/40 bg-gold/10 text-gold'
          }`}
        >
          Open{Number(openCount?.n ?? 0) > 0 ? ` (${Number(openCount.n).toLocaleString()})` : ''}
        </a>
        <a
          href="/staff/errors?show=resolved"
          className={`rounded-lg border px-3 py-1.5 ${
            showResolved
              ? 'border-gold/40 bg-gold/10 text-gold'
              : 'border-card-border text-text-muted hover:text-gold'
          }`}
        >
          Resolved
        </a>
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center text-sm text-text-muted">
          {showResolved ? 'Nothing has been marked resolved.' : 'Nothing is failing. '}
          {!showResolved && <span className="text-gold">Good.</span>}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-card-border bg-card-bg p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gold-light">{r.name}</span>
                    <span className="rounded bg-card-border/60 px-1.5 py-0.5 text-xs text-text-muted">
                      ×{r.count.toLocaleString()}
                    </span>
                    {r.resolvedAt && (
                      <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-xs text-green-400">
                        resolved{r.resolvedBy ? ` by ${r.resolvedBy}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words font-mono text-[13px] text-text">{r.message}</p>
                </div>
                {!r.resolvedAt && <ResolveButton id={r.id} />}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                {r.path && (
                  <span className="font-mono">
                    {r.method ? `${r.method} ` : ''}
                    {r.path}
                  </span>
                )}
                <span>{r.clanSlug ? `clan ${r.clanName ?? r.clanSlug}` : 'apex'}</span>
                {r.source && <span>{r.source}</span>}
                {r.release && <span>v{r.release}</span>}
                <span title={r.lastSeenAt}>last {ago(r.lastSeenAt)}</span>
                <span title={r.firstSeenAt}>first {ago(r.firstSeenAt)}</span>
              </div>

              {r.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-text-muted hover:text-gold">
                    Stack
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-brown-dark p-3 text-[11px] leading-relaxed text-text-muted">
                    {r.stack}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Coarse relative time. Rendered on the server, so it is deliberately not precise enough to look
 * live — "3m ago" that is actually eleven minutes old is worse than "minutes ago".
 */
function ago(stamp: string | null): string {
  const ms = parseStamp(stamp);
  if (ms == null) return 'unknown';
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 90) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
