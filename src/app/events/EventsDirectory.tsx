import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';
import { EVENT_MODES } from '@/lib/eventModes';
import {
  DIRECTORY_PAGE_SIZE,
  directoryPage,
  filterHref,
  whenWords,
  type DirectoryEvent,
  type DirectoryFilters,
} from '@/lib/eventsDirectory';
import { cachedDirectoryEvents } from '@/lib/eventsDirectoryDb';
import { JsonLd, eventLd } from '@/lib/jsonLd';

/**
 * anvilosrs.com/events — every event a clan or creator space asked us to advertise, upcoming or
 * live. Rules and visibility guarantees: lib/eventsDirectory. Server-rendered end to end: the
 * filters are plain links, so it works without JavaScript and every view has its own URL.
 */
export default async function EventsDirectory({ filters }: { filters: DirectoryFilters }) {
  const { view, now } = await loadView(filters);
  const filtered =
    filters.when !== 'all' || filters.format !== 'any' || filters.join !== 'any' || filters.host !== 'any';

  const modeLabel = (k: string) => EVENT_MODES.find((m) => m.key === k)?.label ?? k;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {view.items.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: view.items.map((e, i) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { '@context': _ctx, ...item } = eventLd({
                name: e.name,
                url: e.href,
                startDate: e.startDate,
                endDate: e.endDate,
                clanName: e.hostName,
                clanSlug: e.hostSlug,
                hostKind: e.hostKind,
              }) as Record<string, unknown>;
              return { '@type': 'ListItem', position: (view.page - 1) * DIRECTORY_PAGE_SIZE + i + 1, item };
            }),
          }}
        />
      )}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display display-lg text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">Events</h1>
          <p className="mt-2 max-w-[60ch] text-[14.5px] text-text-muted">
            Bingos, races and ladders you can join, from clans and streamers on Anvil. Pick one, open it,
            and press Join.
          </p>
        </div>
        <ClanLink
          href="/host"
          className="rounded-lg border border-gold/40 px-3.5 py-2 text-[13.5px] font-medium text-gold transition-colors hover:bg-gold/10"
        >
          Host your own →
        </ClanLink>
      </header>

      <nav aria-label="Filters" className="mb-6 space-y-2 rounded-xl border border-card-border bg-card-bg p-3">
        <FilterRow label="When">
          <Chip href={filterHref(filters, { when: 'all' })} on={filters.when === 'all'}>All</Chip>
          <Chip href={filterHref(filters, { when: 'live' })} on={filters.when === 'live'}>
            {view.liveCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent-green-light" />}
            Live now{view.liveCount > 0 ? ` · ${view.liveCount}` : ''}
          </Chip>
          <Chip href={filterHref(filters, { when: 'open' })} on={filters.when === 'open'}>
            Open to join{view.openCount > 0 ? ` · ${view.openCount}` : ''}
          </Chip>
          <Chip href={filterHref(filters, { when: 'soon' })} on={filters.when === 'soon'}>Starting this week</Chip>
        </FilterRow>
        <FilterRow label="Type">
          <Chip href={filterHref(filters, { format: 'any' })} on={filters.format === 'any'}>Any</Chip>
          {view.modes.map((k) => (
            <Chip key={k} href={filterHref(filters, { format: k })} on={filters.format === k}>
              {modeLabel(k)}
            </Chip>
          ))}
          {(view.anySolo || filters.format === 'solo') && (
            <Chip href={filterHref(filters, { format: 'solo' })} on={filters.format === 'solo'}>Solo</Chip>
          )}
        </FilterRow>
        <FilterRow label="Joining">
          <Chip href={filterHref(filters, { join: 'any' })} on={filters.join === 'any'}>Any</Chip>
          <Chip href={filterHref(filters, { join: 'open' })} on={filters.join === 'open'}>Anyone can join</Chip>
          <Chip href={filterHref(filters, { join: 'gated' })} on={filters.join === 'gated'}>Ask or meet a rule</Chip>
        </FilterRow>
        <FilterRow label="Host">
          <Chip href={filterHref(filters, { host: 'any' })} on={filters.host === 'any'}>All</Chip>
          <Chip href={filterHref(filters, { host: 'clan' })} on={filters.host === 'clan'}>Clans</Chip>
          <Chip href={filterHref(filters, { host: 'creator' })} on={filters.host === 'creator'}>Creators</Chip>
        </FilterRow>
      </nav>

      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-sm bg-gold" />
        <h2 className="text-[16.5px] font-semibold">{filtered ? 'Matching events' : 'Upcoming and live'}</h2>
        <span className="font-mono text-[11px] text-text-dim">{view.total}</span>
      </div>

      {view.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-sm text-text-muted">
          {filtered ? (
            <>
              Nothing matches those filters right now.{' '}
              <ClanLink href={filterHref(filters, { when: 'all', format: 'any', join: 'any', host: 'any' })} className="text-gold hover:underline">
                Show everything
              </ClanLink>
            </>
          ) : (
            <>
              No events are listed right now. Hosting one? Turn on <b className="text-foreground">Advertise on Anvil</b> in
              your event&rsquo;s settings and it shows up here.
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {view.items.map((e) => (
            <Card key={e.eventId} e={e} now={now} />
          ))}
        </div>
      )}

      {view.pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-[13.5px]">
          {view.page > 1 ? (
            <ClanLink href={filterHref(filters, { page: view.page - 1 })} className="rounded-lg border border-card-border px-3 py-1.5 hover:border-gold/40 hover:text-gold">
              ← Newer
            </ClanLink>
          ) : null}
          <span className="font-mono text-[11px] text-text-dim">
            Page {view.page} of {view.pages}
          </span>
          {view.page < view.pages ? (
            <ClanLink href={filterHref(filters, { page: view.page + 1 })} className="rounded-lg border border-card-border px-3 py-1.5 hover:border-gold/40 hover:text-gold">
              Later →
            </ClanLink>
          ) : null}
        </nav>
      )}

      <p className="mt-6 text-xs text-text-dim">
        Every event here was listed by its host. Joining someone else&rsquo;s event lets you play in that event
        only — you never become a member, and your account and characters stay yours.
      </p>
    </div>
  );
}

/** The shared minute-old list, settled against this moment and cut to one page. */
async function loadView(filters: DirectoryFilters) {
  const all = await cachedDirectoryEvents();
  const now = Date.now();
  return { view: directoryPage(all, filters, now), now };
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-[4.5rem] shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">{label}</span>
      {children}
    </div>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <ClanLink
      href={href}
      aria-current={on ? 'true' : undefined}
      scroll={false}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12.5px] transition-colors ${
        on ? 'border-gold/40 bg-gold/[0.08] text-gold' : 'border-card-border text-text-muted hover:border-gold/30 hover:text-foreground'
      }`}
    >
      {children}
    </ClanLink>
  );
}

function Card({ e, now }: { e: DirectoryEvent; now: number }) {
  const cta = e.takingEntries ? 'Join' : 'View event';
  return (
    <article className="flex flex-col rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/30">
      <div className="flex items-start gap-3">
        <ClanCrest name={e.name} logoUrl={e.iconUrl} size={44} rounded="rounded-lg" className="text-sm" />
        <div className="min-w-0 flex-1">
          <h3 className="display line-clamp-2 text-[16px] font-semibold leading-snug">
            <ClanLink href={e.href} className="hover:text-gold">
              {e.name}
            </ClanLink>
          </h3>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-muted">
            <ClanCrest name={e.hostName} logoUrl={e.hostLogoUrl} size={16} />
            <span className="truncate">{e.hostName}</span>
            <span
              className={`shrink-0 rounded border px-1.5 py-px text-[10.5px] font-medium ${
                e.hostKind === 'creator' ? 'border-gold/30 bg-gold/10 text-gold' : 'border-card-border text-text-muted'
              }`}
            >
              {e.hostKind === 'creator' ? 'Creator' : 'Clan'}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
        <span className={`flex items-center gap-1.5 font-medium ${e.live ? 'text-accent-green-light' : 'text-foreground'}`}>
          {e.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green-light" />}
          {whenWords(e, now)}
        </span>
        {e.featured && (
          <span className="rounded border border-gold/30 px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.1em] text-gold">
            Featured
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Tag>{e.formatLabel}</Tag>
        <Tag>{e.solo ? 'Solo' : 'Teams'}</Tag>
        <Tag>
          {e.players.toLocaleString('en-US')} player{e.players === 1 ? '' : 's'}
        </Tag>
      </div>

      <p className="mt-2 line-clamp-2 text-[12.5px] text-text-muted">{e.joinLabel}</p>

      <div className="mt-auto pt-4">
        <ClanLink
          href={e.href}
          className={`block rounded-lg px-3 py-2 text-center text-[13.5px] font-semibold transition-colors ${
            e.takingEntries
              ? 'bg-gold text-brown-dark hover:bg-gold-light'
              : 'border border-card-border text-foreground hover:border-gold/40 hover:text-gold'
          }`}
        >
          {cta}
        </ClanLink>
      </div>
    </article>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-card-border bg-brown-light/60 px-1.5 py-px text-[11px] text-text-muted">{children}</span>
  );
}
