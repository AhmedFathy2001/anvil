import ClanLink from '@/components/ClanLink';
import { notFound } from 'next/navigation';

import { requirePlatformPage } from '@/lib/platformAccess';
import { analyticsOverview, type DailyPoint } from '@/lib/analyticsRead';
import { parseWindow, worstStep, WINDOWS, type FunnelRow } from '@/lib/analyticsFunnels';

export const dynamic = 'force-dynamic';

/**
 * How Anvil is used, across every clan.
 *
 * Three questions, in the order an operator asks them: is anyone here (the headline), what do they
 * use (routes and actions), and where do they stop (the funnels, then the clans going quiet). Page
 * views and actions are first-party rows (lib/analytics); the funnels read the domain tables, so they
 * are complete from each clan's first day rather than from the day tracking shipped.
 */
export default async function StaffAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // The shell gates this too; a page that can show every clan's activity checks for itself.
  if (!(await requirePlatformPage('support'))) notFound();
  const days = parseWindow((await searchParams).days);
  const a = await analyticsOverview(days);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-semibold text-gold">Analytics</h1>
          <p className="mt-1 max-w-[70ch] text-sm text-text-muted">
            Visits, the features people reach for, and where they stop. Paths are stored as routes, never
            as URLs; visitors are a per-tab random id, with no cookie.
          </p>
        </div>
        <nav className="flex gap-2 text-sm" aria-label="Window">
          {WINDOWS.map((w) => (
            <ClanLink
              key={w}
              href={`/staff/analytics?days=${w}`}
              className={`rounded-lg border px-3 py-1.5 ${
                w === days ? 'border-gold/40 bg-gold/10 text-gold' : 'border-card-border text-text-muted hover:text-gold'
              }`}
            >
              {w}d
            </ClanLink>
          ))}
        </nav>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Visitors" sub="tab sessions" v={a.headline.visitors} />
        <Stat label="Signed-in users" sub="DAU / WAU / MAU" v={a.headline.users} />
        <Stat label="Active clans" sub="any visit or action" v={a.headline.clans} />
        <Stat label="Plugin users" sub="accounts seen in-game" v={a.headline.pluginUsers} />
      </div>

      <Section title={`Page views — last ${days} days`}>
        <Card>
          <Bars series={a.pageViews} />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
            <span>
              {sum(a.pageViews).toLocaleString()} views · {sum(a.visitorsByDay).toLocaleString()} visitor-days
            </span>
            <span>
              {pct(a.conversion.signedInSessions, a.conversion.sessions)} of {a.conversion.sessions.toLocaleString()}{' '}
              sessions were signed in
            </span>
          </div>
        </Card>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Top pages">
          <Card>
            {a.topRoutes.length === 0 ? (
              <Empty />
            ) : (
              <RankTable
                head={['Route', 'Views', 'Sessions']}
                rows={a.topRoutes.map((r) => [r.name, r.views, r.sessions])}
                max={a.topRoutes[0].views}
              />
            )}
          </Card>
        </Section>
        <Section title="Feature use">
          <Card>
            {a.topActions.length === 0 ? (
              <Empty />
            ) : (
              <RankTable
                head={['Action', 'Times', 'People', 'Clans']}
                rows={a.topActions.map((r) => [r.name, r.count, r.users, r.clans])}
                max={a.topActions[0].count}
              />
            )}
          </Card>
        </Section>
      </div>

      <Section title="Plugin features">
        <Card>
          {a.pluginRoutes.length === 0 ? (
            <Empty />
          ) : (
            <RankTable
              head={['Plugin path', 'Account-days', 'Accounts', 'Clans']}
              rows={a.pluginRoutes.map((r) => [r.name, r.accountDays, r.accounts, r.clans])}
              max={Math.max(...a.pluginRoutes.map((r) => r.accountDays))}
            />
          )}
        </Card>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Clan onboarding">
          <Funnel rows={a.clanFunnel} actor={`clans created in the last ${days} days`} />
        </Section>
        <Section title="Member onboarding">
          <Funnel rows={a.memberFunnel} actor={`people who first signed in during the last ${days} days`} />
        </Section>
      </div>

      <Section title="Clans by activity">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Clan</th>
                  <th className="py-2 pr-4 font-medium">Last active</th>
                  <th className="py-2 pr-4 text-right font-medium">Views 7d</th>
                  <th className="py-2 pr-4 text-right font-medium">Actions 7d</th>
                  <th className="py-2 pr-4 text-right font-medium">People 7d</th>
                  <th className="py-2 text-right font-medium">Plugin 7d</th>
                </tr>
              </thead>
              <tbody>
                {a.clanActivity.map((c) => {
                  const quietDays = c.quietDays;
                  return (
                    <tr key={c.id} className={`border-t border-card-border ${c.status !== 'active' ? 'opacity-60' : ''}`}>
                      <td className="py-2 pr-4">
                        <ClanLink href={`/staff/clans/${c.id}`} className="text-gold-light hover:text-gold">
                          {c.name}
                        </ClanLink>
                        <span className="ml-2 text-xs text-text-muted">
                          {c.plan ?? 'free'}
                          {c.status !== 'active' ? ` · ${c.status}` : ''}
                        </span>
                      </td>
                      <td className={`py-2 pr-4 ${quietDays != null && quietDays >= 7 ? 'text-amber-400' : 'text-gray-300'}`}>
                        {quietDays == null ? <span className="text-text-muted">never</span> : quietDays === 0 ? 'today' : `${quietDays}d ago`}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{c.views7d.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{c.actions7d.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{c.activeUsers7d.toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums">{c.pluginUsers7d.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>
    </div>
  );
}

const sum = (s: DailyPoint[]) => s.reduce((n, p) => n + p.count, 0);
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-card-border bg-card-bg p-4">{children}</div>;
}

function Empty() {
  return <p className="py-6 text-center text-sm text-text-muted">Nothing recorded in this window yet.</p>;
}

function Stat({ label, sub, v }: { label: string; sub: string; v: { d1: number; d7: number; d30: number } }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="text-2xl font-semibold text-gold tabular-nums">{v.d1.toLocaleString()}</div>
      <div className="text-sm text-gray-300">{label} today</div>
      <div className="mt-1 text-xs text-text-muted tabular-nums">
        {v.d7.toLocaleString()} this week · {v.d30.toLocaleString()} in 30d
      </div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  );
}

/** A day-per-bar chart in plain CSS; the tooltip is the bar's title. */
function Bars({ series }: { series: DailyPoint[] }) {
  const max = Math.max(1, ...series.map((p) => p.count));
  return (
    <div>
      <div className="flex h-36 items-end gap-px" role="img" aria-label="Page views per day">
        {series.map((p) => (
          <div
            key={p.day}
            title={`${p.day}: ${p.count.toLocaleString()} views`}
            className="flex-1 rounded-t-sm bg-gold/70 hover:bg-gold"
            style={{ height: `${Math.max(p.count > 0 ? 2 : 0, (p.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-text-muted tabular-nums">
        <span>{series[0]?.day}</span>
        <span>peak {max.toLocaleString()}</span>
        <span>{series[series.length - 1]?.day}</span>
      </div>
    </div>
  );
}

function RankTable({ head, rows, max }: { head: string[]; rows: (string | number)[][]; max: number }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-text-muted">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={`py-1.5 font-medium ${i > 0 ? 'pl-3 text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])} className="border-t border-card-border">
            <td className="relative py-1.5 pr-2">
              <span
                className="absolute inset-y-1 left-0 rounded bg-gold/10"
                style={{ width: `${(Number(r[1]) / Math.max(1, max)) * 100}%` }}
                aria-hidden
              />
              <span className="relative break-all font-mono text-xs text-gray-200">{r[0]}</span>
            </td>
            {r.slice(1).map((v, i) => (
              <td key={i} className="py-1.5 pl-3 text-right tabular-nums">
                {Number(v).toLocaleString()}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Funnel({ rows, actor }: { rows: FunnelRow[]; actor: string }) {
  const worst = worstStep(rows);
  const start = rows[0]?.count ?? 0;
  return (
    <Card>
      <p className="mb-3 text-xs text-text-muted">
        {start.toLocaleString()} {actor}.
        {worst && (
          <>
            {' '}
            Most are lost before <span className="text-amber-400">{worst.label.toLowerCase()}</span> (
            {Math.round(worst.dropFromPrev * 100)}% of the step before).
          </>
        )}
      </p>
      <ol className="space-y-2">
        {rows.map((r, k) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={r === worst ? 'text-amber-400' : 'text-gray-200'}>{r.label}</span>
              <span className="tabular-nums text-gray-300">
                {r.count.toLocaleString()}
                <span className="ml-2 text-xs text-text-muted">
                  {start > 0 ? `${Math.round(r.ofStart * 100)}%` : '—'}
                  {k > 0 && r.dropFromPrev > 0 ? ` · −${Math.round(r.dropFromPrev * 100)}%` : ''}
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded bg-card-border/60">
              <div className="h-2 rounded bg-gold/70" style={{ width: `${r.ofStart * 100}%` }} />
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">{r.hint}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
