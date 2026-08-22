import ClanLink from '@/components/ClanLink';
import type { ApexHomeView } from '@/lib/apexHome';

/**
 * The apex, to somebody signed in.
 *
 * Your clans, what is running in each, and which of them wants something from you. Not a directory:
 * the version of this page that listed every clan on the platform answered a question nobody signed
 * in was asking, since you already know which clans are yours and the others are strangers.
 *
 * A clan you hold authority in but have not finished setting up is pulled out with a gold border,
 * because that is the one card on the page with an actual task behind it.
 */
export default function ApexHome({
  view,
  displayName,
}: {
  view: ApexHomeView;
  displayName: string;
}) {
  const running = view.clans.reduce((n, c) => n + c.live.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-10">
      <div className="mb-8">
        <h1 className="text-[31px] font-semibold tracking-[-0.02em]">{greeting()}, {displayName}</h1>
        <p className="mt-1.5 text-[15px] text-text-muted">{summary(view.clans.length, running)}</p>
      </div>

      {view.clans.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card-bg p-8">
          <h2 className="text-lg font-semibold">You&rsquo;re not in a clan yet</h2>
          <p className="mt-2 max-w-[52ch] text-[14.5px] text-text-muted">
            Join one that&rsquo;s recruiting, or start your own — a clan takes an evening to set up and
            the plugin does the rest.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ClanLink
              href="/clans"
              className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Find a clan
            </ClanLink>
            <ClanLink
              href="/clans/new"
              className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold-dark"
            >
              Start one
            </ClanLink>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {view.clans.map((c) => {
            // Staff with nothing running is the one state with a job attached: they can fix it, and
            // an empty clan they own is the likeliest reason somebody bounces off Anvil entirely.
            const needsYou = c.staff && c.live.length === 0;
            return (
              <ClanLink
                key={c.id}
                href={`/c/${c.slug}`}
                className={`overflow-hidden rounded-2xl border bg-card-bg transition-colors hover:bg-card-bg-hover ${
                  needsYou ? 'border-gold-dark' : 'border-card-border'
                }`}
              >
                <div
                  className={`flex items-center gap-2.5 border-b border-card-border px-4 py-3.5 ${
                    needsYou ? 'bg-gold/[0.06]' : ''
                  }`}
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="ml-auto shrink-0 rounded border border-gold-dark px-1.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                    {standing(c.seat, c.staff)}
                  </span>
                </div>

                {c.live.length > 0 ? (
                  c.live.map((l) => (
                    <div
                      key={`${l.kind}-${l.id}`}
                      className="flex items-center gap-2.5 border-b border-card-border/50 px-4 py-3 text-sm last:border-b-0"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green-light" />
                      <span className="truncate">{l.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-text-muted">
                        {l.kind === 'weekly' ? 'week' : 'event'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-4 text-[13.5px] text-text-muted/70">
                    {needsYou ? 'Nothing running — start something' : 'Nothing running right now'}
                  </div>
                )}
              </ClanLink>
            );
          })}
        </div>
      )}

      <section className="pt-12">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[22px] w-1 shrink-0 rounded-sm bg-gold" />
          <h2 className="text-[23px] font-semibold tracking-[-0.015em]">Your week</h2>
          <ClanLink href="/profile" className="ml-auto text-[13px] text-text-muted hover:text-gold">
            Your profile →
          </ClanLink>
        </div>
        <p className="mb-5 ml-4 text-[14.5px] text-text-muted">
          Across every character you play.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat n={compact(view.xpThisWeek)} k="XP this week" />
          <Stat n={view.characters.toLocaleString()} k="Characters" />
          <Stat n={running.toLocaleString()} k="Events you're in" />
        </div>
      </section>
    </div>
  );
}

function Stat({ n, k }: { n: string; k: string }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-5">
      <div className="font-mono text-[26px] tabular-nums">{n}</div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted/70">{k}</div>
    </div>
  );
}

/** Member outranks guest; staff is a separate axis and worth saying when it applies. */
function standing(seat: 'member' | 'guest' | null, staff: boolean): string {
  const base = seat === 'member' ? 'Member' : seat === 'guest' ? 'Guest' : 'No seat';
  return staff ? `${base} · Staff` : base;
}

function summary(clans: number, running: number): string {
  if (clans === 0) return 'Nothing here yet.';
  const c = `${clans} clan${clans === 1 ? '' : 's'}`;
  if (running === 0) return `${c}. Nothing running in any of them.`;
  return `${c}. ${running} competition${running === 1 ? '' : 's'} running.`;
}

// Server component — one evaluation per request, not per client render.
// eslint-disable-next-line react-hooks/purity
function greeting(): string {
  const h = new Date().getUTCHours();
  if (h < 5 || h >= 22) return 'Evening';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
