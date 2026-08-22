import ClanLink from '@/components/ClanLink';

export interface LookupClan {
  slug: string;
  name: string;
  members: number;
  /** What is running there now, if anything — the one column worth reading first. */
  doing: string | null;
  /** The viewer's own standing here, so their clans do not offer them a way to apply. */
  seat: 'member' | 'guest' | null;
}

/**
 * Find a clan — the lookup, and DELIBERATELY plain.
 *
 * An earlier pass made this a grid of cards with activity sparklines and a moments feed, on the
 * theory that a platform page should be exciting. It should not: this is a page you open twice a
 * year, when you want somewhere to play or somebody to play against, and both times you arrive with
 * a specific intent. So it is a table you scan, with one action per row — the thing you came for.
 *
 * Manufacturing excitement here also had a cost: it implied people browse other clans, which nobody
 * does. What happens in a clan you are not in is not interesting to you, and a design that pretends
 * otherwise fills the page with noise.
 */
export default function ClanLookup({ clans }: { clans: LookupClan[] }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-10">
      <div className="mb-7">
        <h1 className="text-[31px] font-semibold tracking-[-0.02em]">Find a clan</h1>
        <p className="mt-1.5 text-[15px] text-text-muted">
          For when you want somewhere to play, or somebody to play against.
        </p>
      </div>

      {clans.length === 0 ? (
        <p className="rounded-2xl border border-card-border bg-card-bg p-6 text-sm text-text-muted">
          No clans are listed yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card-bg">
          <div className="grid grid-cols-[minmax(150px,1.7fr)_1fr_88px] items-center gap-4 bg-black/15 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted sm:grid-cols-[minmax(170px,1.7fr)_1fr_92px_108px]">
            <div>Clan</div>
            <div className="hidden sm:block">Doing now</div>
            <div className="text-right">Members</div>
            <div className="hidden text-right sm:block">&nbsp;</div>
          </div>

          {clans.map((c) => (
            <ClanLink
              key={c.slug}
              href={`/c/${c.slug}`}
              className="grid grid-cols-[minmax(150px,1.7fr)_1fr_88px] items-center gap-4 border-t border-card-border/55 px-5 py-4 text-[14.5px] transition-colors hover:bg-card-bg-hover sm:grid-cols-[minmax(170px,1.7fr)_1fr_92px_108px]"
            >
              <div className="flex min-w-0 items-center gap-2.5 font-medium">
                <Crest name={c.name} />
                <span className="truncate">{c.name}</span>
              </div>
              <div className="hidden truncate text-[13.5px] text-text-muted sm:block">
                {c.doing ?? 'Nothing running'}
              </div>
              <div className="text-right font-mono tabular-nums">{c.members.toLocaleString()}</div>
              <div className="hidden text-right sm:block">
                <span
                  className={`rounded-md border px-3 py-1.5 text-[12.5px] ${
                    c.seat
                      ? 'border-card-border text-text-muted'
                      : 'border-gold-dark text-gold'
                  }`}
                >
                  {c.seat === 'member' ? 'You’re in' : c.seat === 'guest' ? 'Guest' : 'Open'}
                </span>
              </div>
            </ClanLink>
          ))}
        </div>
      )}

      <p className="mt-6 text-[13px] text-text-muted/70">
        Every clan here chose to be listed. Joining one never affects the others — your account and
        characters follow you between them.
      </p>
    </div>
  );
}

function Crest({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded font-mono text-[10px] font-semibold text-brown-dark"
      style={{ background: `hsl(${h} 34% 42%)` }}
    >
      {initials}
    </span>
  );
}
