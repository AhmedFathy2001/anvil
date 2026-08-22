import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import type { ApexHomeView, ClanCard } from '@/lib/apexHome';

/**
 * The apex, to somebody signed in.
 *
 * BUILT FOR A DOZEN CLANS, not three. Guesting into other clans' events is meant to be normal — a
 * player who likes a challenge ends up a guest in ten of them — so a card per clan stops working
 * almost immediately: ten identical tiles saying "nothing running" is a wall, and the one clan that
 * matters is lost in it.
 *
 * So the page is ordered by what is happening rather than by what you belong to:
 *
 *   LIVE gets the room. Anything actually running, in any of your clans, as its own row.
 *   YOURS is a compact list, member seat first, guests after — one line each, not a card.
 *   NEEDS YOU is separate, because a clan you run with nothing in it is a job, not a status.
 *
 * That ordering holds at three clans and at thirty, which a grid does not.
 */
export default function ApexHome({
  view,
  displayName,
}: {
  view: ApexHomeView;
  displayName: string;
}) {
  const live = view.clans.filter((c) => c.live.length > 0);
  const needsYou = view.clans.filter((c) => c.staff && c.live.length === 0);
  const quiet = view.clans.filter((c) => !c.staff && c.live.length === 0);
  const running = view.clans.reduce((n, c) => n + c.live.length, 0);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-9">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] sm:text-[34px]">
          {greeting()}, {displayName}
        </h1>
        <p className="mt-2 text-[15px] text-text-muted">
          {summary(view.clans.length, running)}
        </p>
      </header>

      {view.clans.length === 0 ? (
        <Empty />
      ) : (
        <div className="flex flex-col gap-10">
          {live.length > 0 && (
            <Section title="Happening now" note={`${running} running`}>
              <div className="flex flex-col gap-2.5">
                {live.flatMap((c) =>
                  c.live.map((l) => (
                    <ClanLink
                      key={`${c.id}-${l.kind}-${l.id}`}
                      href={l.kind === 'weekly' ? `/c/${c.slug}/weekly/${l.id}` : `/c/${c.slug}/events/${l.id}`}
                      className="flex items-center gap-3.5 rounded-xl border border-card-border bg-card-bg px-4 py-3.5 transition-colors hover:border-gold/40 hover:bg-card-bg-hover sm:px-5"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent-green-light shadow-[0_0_0_3px_rgba(52,208,88,0.14)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{l.name}</span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-text-muted">
                          {c.name} · {seatWord(c)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-muted/70">
                        {l.kind === 'weekly' ? 'week' : 'event'}
                      </span>
                    </ClanLink>
                  )),
                )}
              </div>
            </Section>
          )}

          {needsYou.length > 0 && (
            <Section title="Waiting on you" note={`${needsYou.length}`}>
              <div className="flex flex-col gap-2.5">
                {needsYou.map((c) => (
                  <ClanLink
                    key={c.id}
                    href={`/c/${c.slug}/admin/dashboard`}
                    className="flex items-center gap-3.5 rounded-xl border border-gold-dark bg-gold/[0.06] px-4 py-3.5 transition-colors hover:bg-gold/[0.1] sm:px-5"
                  >
                    <ClanCrest name={c.name} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{c.name}</span>
                      <span className="mt-0.5 block text-[12.5px] text-text-muted">
                        Nothing running — start something
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] text-gold">Open →</span>
                  </ClanLink>
                ))}
              </div>
            </Section>
          )}

          <Section title="Your clans" note={`${view.clans.length}`}>
            <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
              {[...live, ...needsYou, ...quiet].map((c) => (
                <li key={c.id}>
                  <ClanLink
                    href={`/c/${c.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-card-bg-hover sm:px-5"
                  >
                    <ClanCrest name={c.name} size={22} />
                    <span className="min-w-0 flex-1 truncate text-[14.5px]">{c.name}</span>
                    {c.live.length > 0 && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green-light" />
                    )}
                    <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted/70">
                      {seatWord(c)}
                    </span>
                  </ClanLink>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Your week"
            note="every character"
            more={{ href: '/profile', label: 'Your profile' }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat n={compact(view.xpThisWeek)} k="XP this week" />
              <Stat n={view.characters.toLocaleString()} k="Characters" />
              <Stat n={running.toLocaleString()} k="You're in" />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  note,
  more,
  children,
}: {
  title: string;
  note?: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3.5 flex items-center gap-3">
        <span className="h-5 w-1 shrink-0 rounded-sm bg-gold" />
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{title}</h2>
        {note && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-muted/70">
            {note}
          </span>
        )}
        {more && (
          <ClanLink href={more.href} className="ml-auto text-[13px] text-text-muted hover:text-gold">
            {more.label} →
          </ClanLink>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-7 sm:p-8">
      <h2 className="text-lg font-semibold">You&rsquo;re not in a clan yet</h2>
      <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-text-muted">
        Join one that&rsquo;s recruiting, or start your own — a clan takes an evening to set up, and
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
  );
}

function Stat({ n, k }: { n: string; k: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg px-5 py-4">
      <div className="font-mono text-[24px] tabular-nums">{n}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted/70">{k}</div>
    </div>
  );
}

/** One word for how you are attached. Staff is a separate axis and outranks the seat for display. */
function seatWord(c: ClanCard): string {
  if (c.staff) return c.seat === 'member' ? 'Staff' : 'Staff · guest';
  return c.seat === 'member' ? 'Member' : c.seat === 'guest' ? 'Guest' : 'No seat';
}

function summary(clans: number, running: number): string {
  if (clans === 0) return 'Nothing here yet.';
  const c = `${clans} clan${clans === 1 ? '' : 's'}`;
  if (running === 0) return `${c}, and nothing running in any of them.`;
  return `${c}. ${running} thing${running === 1 ? '' : 's'} running.`;
}

// Server component — evaluated once per request, not on client renders.
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
