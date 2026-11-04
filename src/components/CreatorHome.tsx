import MotionImg from '@/components/MotionImg';
import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import type { PublicClanActivity, VisitorItem } from '@/lib/clanHome';
import type { CreatorHomeView } from '@/lib/creatorHome';

/** "Nov 7" — day-level; the event pages carry the times. */
function shortDate(iso: string): string {
  const t = Date.parse(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold">
      <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
      {children}
      {aside && <span className="text-sm font-normal text-text-muted">{aside}</span>}
    </h2>
  );
}

function StreamLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-gold/45 hover:text-gold"
    >
      {label}
      <span aria-hidden className="text-text-dim">↗</span>
    </a>
  );
}

function EventRow({ item, tone }: { item: VisitorItem; tone: 'live' | 'upcoming' | 'past' }) {
  return (
    <li className="border-t border-card-border/70 first:border-t-0">
      <ClanLink
        href={item.href}
        className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-card-bg-hover"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            {tone === 'live' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-label="Live" />}
            <span className="truncate font-medium">{item.name}</span>
          </span>
          <span className="block text-[12.5px] text-text-muted">
            {item.kind}
            {item.line && <> · {item.line}</>}
          </span>
        </span>
        <span className="text-right text-[13px]">
          {item.top ? (
            <>
              <span className="block">{item.top.name}</span>
              <span className="block text-[12px] text-text-muted">{item.top.text}</span>
            </>
          ) : (
            <span className="font-mono text-[12.5px] text-text-dim">{item.when ? shortDate(item.when) : ''}</span>
          )}
        </span>
      </ClanLink>
    </li>
  );
}

function EventList({ title, items, tone }: { title: string; items: VisitorItem[]; tone: 'live' | 'upcoming' | 'past' }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <SectionTitle>{title}</SectionTitle>
      <ul
        className={`overflow-hidden rounded-xl border bg-card-bg ${tone === 'live' ? 'border-emerald-500/30' : 'border-card-border'}`}
      >
        {items.map((item) => (
          <EventRow key={item.key} item={item} tone={tone} />
        ))}
      </ul>
    </section>
  );
}

/**
 * A creator space's page (lib/creatorSpaces): who runs it, where they stream, their events, and the
 * people who have played them. No member count, no recruiting, no "apply" — a creator space has no
 * roster, and the way in is each event's own sign-up.
 */
export default function CreatorHome({ view, activity }: { view: CreatorHomeView; activity: PublicClanActivity | null }) {
  const live = activity?.live ?? [];
  const upcoming = activity?.upcoming ?? [];
  const past = activity?.past ?? [];
  const nothingYet = live.length + upcoming.length + past.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      {view.bannerUrl && (
        <div className="relative mb-4 aspect-[3/1] w-full overflow-hidden rounded-2xl border border-card-border">
          <MotionImg
            src={view.bannerUrl}
            className="h-full w-full object-cover"
            style={{ objectPosition: `50% ${view.bannerPosition ?? 50}%` }}
          />
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-2xl border border-card-border bg-card-bg p-6 sm:flex-row sm:items-center">
        <ClanCrest
          variant="letter"
          slug={view.slug}
          name={view.name}
          logoUrl={view.logoUrl}
          size={64}
          rounded="rounded-2xl"
          className="text-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-gold">Events by</p>
          <h1 className="display text-2xl font-semibold text-foreground sm:text-3xl">{view.name}</h1>
          {view.tagline && <p className="mt-1.5 max-w-[60ch] text-[15px] text-text-muted">{view.tagline}</p>}
          {(view.links.twitch || view.links.kick) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {view.links.twitch && <StreamLink href={view.links.twitch} label="Twitch" />}
              {view.links.kick && <StreamLink href={view.links.kick} label="Kick" />}
            </div>
          )}
        </div>
        <div className="flex gap-6 sm:flex-col sm:gap-3 sm:text-right">
          <div>
            <div className="text-xl font-bold tabular-nums text-foreground">{view.eventsRun}</div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">events</div>
          </div>
          {view.playerCount != null && (
            <div>
              <div className="text-xl font-bold tabular-nums text-foreground">{view.playerCount}</div>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">players</div>
            </div>
          )}
        </div>
      </div>

      <EventList title="Happening now" items={live} tone="live" />
      <EventList title="Coming up" items={upcoming} tone="upcoming" />
      <EventList title="Finished" items={past} tone="past" />

      {nothingYet && (
        <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-5 text-sm text-text-muted">
          No events yet. Check back soon.
        </div>
      )}

      {view.players.length > 0 && (
        <section className="mt-8">
          <SectionTitle aside={view.playerCount != null && view.playerCount > view.players.length ? `latest ${view.players.length} of ${view.playerCount}` : undefined}>
            Players
          </SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {view.players.map((p) => (
              <li
                key={p.accountId}
                className="rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-[13px]"
                title={`${p.events} event${p.events === 1 ? '' : 's'}`}
              >
                {p.rsn}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-card-border bg-card-bg px-5 py-4 text-[13.5px]">
        <span className="min-w-0 flex-[1_1_22rem] text-text-muted">
          These events run on Anvil, a free indie project for OSRS. Host your own for your viewers or friends.
        </span>
        <ClanLink href="/host" className="text-gold hover:text-gold-light">
          Host an event
        </ClanLink>
      </div>
    </div>
  );
}
