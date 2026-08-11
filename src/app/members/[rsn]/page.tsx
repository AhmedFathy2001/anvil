import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMemberProfile, getMilestones, getRecords } from '@/lib/memberProfile';
import { SKILL_LABELS, BOSSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ rsn: string }> }): Promise<Metadata> {
  const { rsn } = await params;
  const name = decodeURIComponent(rsn);
  return { title: `${name} — Anvil`, description: `Skills, bosses and efficient hours for ${name}.` };
}

const bossLabel = (key: string) => BOSSES.find((b) => b.key === key)?.label ?? key;

function fmtXp(xp: number): string {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(2)}B`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
  return xp.toLocaleString();
}

/** A headline number with its label. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3" title={hint}>
      <div className="text-[11px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className="text-xl font-bold text-gold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function milestoneText(m: { kind: string; metric: string | null; threshold: number }): string {
  const label = m.metric ? (SKILL_LABELS[m.metric] ?? bossLabel(m.metric)) : null;
  switch (m.kind) {
    case 'level':
      return `${m.threshold} ${label}`;
    case 'xp':
      return `${fmtXp(m.threshold)} ${label} XP`;
    case 'kc':
      return `${m.threshold.toLocaleString()} ${label} kills`;
    case 'ehp':
      return `${m.threshold.toLocaleString()} efficient hours played`;
    case 'ehb':
      return `${m.threshold.toLocaleString()} efficient hours bossed`;
    default:
      return `${m.kind} ${m.threshold}`;
  }
}

export default async function MemberProfilePage({ params }: { params: Promise<{ rsn: string }> }) {
  const { rsn } = await params;
  const profile = await getMemberProfile(decodeURIComponent(rsn));
  if (!profile) notFound();

  const [milestones, records] = await Promise.all([
    getMilestones(profile.id, 12),
    getRecords(profile.id),
  ]);

  const eff = profile.efficiency;
  // Skills sorted by the hours they're worth, not alphabetically: the point of per-skill EHP is
  // showing where the time actually went, and 0.00 rows (bonus-XP skills like Attack) belong at the
  // bottom rather than the top.
  const skills = [...profile.skills].sort((a, b) => b.ehp - a.ehp || b.xp - a.xp);
  const recordLabel = { xp: 'XP', ehp: 'EHP', ehb: 'EHB' } as const;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/members" className="text-sm text-text-muted hover:text-gold">
        ← All members
      </Link>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 mb-1">
        <h1 className="text-3xl font-bold text-gold">{profile.rsn}</h1>
        {profile.isGuest && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-text-muted/15 text-text-muted">guest</span>
        )}
        {profile.rank && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold/15 text-gold capitalize">{profile.rank}</span>
        )}
        {profile.leftAt && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">left the clan</span>
        )}
      </div>
      <p className="text-xs text-text-muted mb-6">
        {profile.statsAt
          ? `Stats as at the last sweep · ${new Date(profile.statsAt).toLocaleString()}`
          : 'Stats from the last hiscores sweep'}
      </p>

      {!eff ? (
        <div className="border border-card-border rounded-xl bg-card-bg px-4 py-8 text-center text-sm text-text-muted">
          We haven&rsquo;t successfully read this account from the hiscores yet. It&rsquo;ll fill in
          after the next sweep — or immediately once they play with the plugin running.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            <Stat label="Combat" value={profile.combatLevel?.toString() ?? '—'} />
            <Stat label="Total level" value={profile.totalLevel.toLocaleString()} />
            <Stat
              label="EHP"
              value={eff.ehp.toFixed(2)}
              hint="Efficient hours played — all XP converted to time at the best known rates."
            />
            <Stat
              label="EHB"
              value={eff.ehb.toFixed(2)}
              hint="Efficient hours bossed — boss kills converted to time."
            />
            <Stat
              label="Time to max"
              value={eff.ttm >= 1 ? `${Math.round(eff.ttm).toLocaleString()}h` : 'maxed'}
              hint="Hours of efficient play from here to all 99s."
            />
          </div>

          {records.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-5 bg-gold rounded-full" />
                <h2 className="text-lg font-bold">Records</h2>
                <span className="text-xs text-text-muted">best stretch we&rsquo;ve recorded</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['day', 'week', 'month'] as const).map((period) => {
                  const forPeriod = records.filter((r) => r.period === period);
                  if (forPeriod.length === 0) return null;
                  return (
                    <div key={period} className="border border-card-border rounded-xl bg-card-bg p-4">
                      <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">
                        Best {period}
                      </div>
                      {forPeriod.map((r) => (
                        <div key={r.metric} className="flex items-baseline justify-between text-sm py-0.5">
                          <span className="text-text-muted">{recordLabel[r.metric]}</span>
                          <span className="tabular-nums">
                            {r.metric === 'xp' ? fmtXp(r.value) : r.value.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {milestones.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-5 bg-gold rounded-full" />
                <h2 className="text-lg font-bold">Recent achievements</h2>
              </div>
              <div className="border border-card-border rounded-xl overflow-hidden">
                {milestones.map((m, i) => (
                  <div
                    key={`${m.kind}-${m.metric}-${m.threshold}`}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm ${i % 2 ? 'bg-card-bg' : 'bg-tile-bg'}`}
                  >
                    <span>{milestoneText(m)}</span>
                    <span className="text-xs text-text-muted">
                      {new Date(m.noticedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-5 bg-gold rounded-full" />
              <h2 className="text-lg font-bold">Skills</h2>
              <span className="text-xs text-text-muted">by hours invested</span>
            </div>
            <div className="border border-card-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_6rem_5rem] gap-2 px-4 py-2 bg-tile-bg text-xs text-text-muted">
                <span>Skill</span>
                <span className="text-right">Level</span>
                <span className="text-right">XP</span>
                <span className="text-right">EHP</span>
              </div>
              {skills.map((s, i) => (
                <div
                  key={s.key}
                  className={`grid grid-cols-[minmax(0,1fr)_3.5rem_6rem_5rem] gap-2 px-4 py-2 text-sm ${i % 2 ? 'bg-card-bg' : ''}`}
                >
                  <span className="truncate">{SKILL_LABELS[s.key] ?? s.key}</span>
                  <span className="text-right tabular-nums text-text-muted">{s.level || '—'}</span>
                  <span className="text-right tabular-nums text-text-muted">{fmtXp(s.xp)}</span>
                  <span className={`text-right tabular-nums ${s.ehp > 0 ? '' : 'text-text-muted/50'}`}>
                    {s.ehp.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              A skill can show 0.00 with millions of XP — Attack and Strength arrive as bonus XP from
              Slayer in the efficiency tables, so they cost no time of their own.
            </p>
          </section>

          {profile.bosses.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-5 bg-gold rounded-full" />
                <h2 className="text-lg font-bold">Bosses</h2>
                <span className="text-xs text-text-muted">by hours invested</span>
              </div>
              <div className="border border-card-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-2 px-4 py-2 bg-tile-bg text-xs text-text-muted">
                  <span>Boss</span>
                  <span className="text-right">KC</span>
                  <span className="text-right">EHB</span>
                </div>
                {profile.bosses.map((b, i) => (
                  <div
                    key={b.key}
                    className={`grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-2 px-4 py-2 text-sm ${i % 2 ? 'bg-card-bg' : ''}`}
                  >
                    <span className="truncate">{bossLabel(b.key)}</span>
                    <span className="text-right tabular-nums text-text-muted">{b.kc.toLocaleString()}</span>
                    <span className={`text-right tabular-nums ${b.ehb > 0 ? '' : 'text-text-muted/50'}`}>
                      {b.ehb.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
