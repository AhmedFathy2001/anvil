// The picture a link becomes.
//
// Every link to this site is pasted into Discord — that is the whole distribution model — and until
// now every one of them arrived as a bare grey URL with a hostname on it. This draws the card
// instead: the clan's name, what it is, and a line of real numbers.
//
// NO CALLER-SUPPLIED TEXT. The routes take a slug or an id, look the row up themselves and pass what
// the database said. An `/api/og?title=…` would be an open text-rendering endpoint on our domain,
// which is a thing people put words on other people's brands with.

import { ImageResponse } from 'next/og';

/** The palette, lifted from globals.css. ImageResponse has no stylesheet, so the values come along. */
const C = {
  bg: '#141010',
  card: '#1c1714',
  border: '#332a22',
  gold: '#e0aa1e',
  goldLight: '#ffd35c',
  text: '#f5efe6',
  muted: '#a89b86',
};

/**
 * Cache headers for a card.
 *
 * Long, because Discord and every other unfurler caches aggressively anyway and a stale member count
 * on a social card is not a bug worth a database round trip per paste. `stale-while-revalidate` keeps
 * a renamed clan from serving the old name for a day.
 */
export const OG_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

export interface OgStat {
  label: string;
  value: string;
}

/**
 * One card, three shapes: an eyebrow (what kind of thing this is), a title, a subtitle, and up to
 * four counters along the bottom. Everything is optional except the title, so the site card and a
 * clan card are the same component with different amounts filled in.
 */
export function ogCard(opts: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  stats?: OgStat[];
}): ImageResponse {
  const stats = (opts.stats ?? []).slice(0, 4);
  // Long clan and event names have to stay on the card. Two steps rather than a scale factor,
  // because a continuous shrink makes every card a slightly different size and none of them look
  // deliberate.
  const titleSize = opts.title.length > 34 ? 64 : opts.title.length > 22 ? 78 : 92;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: C.bg,
          // The gold bleed in the corner, so the card reads as this product at thumbnail size even
          // before the words are legible.
          backgroundImage: `radial-gradient(circle at 88% 8%, rgba(224,170,30,0.20), rgba(224,170,30,0) 55%)`,
          padding: '68px 76px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {opts.eyebrow ? (
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: C.gold,
                marginBottom: 22,
              }}
            >
              {opts.eyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              fontSize: titleSize,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.1,
              // Two lines at most; a third would collide with the stats row.
              maxHeight: 230,
              overflow: 'hidden',
            }}
          >
            {opts.title}
          </div>
          {opts.subtitle ? (
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                color: C.muted,
                marginTop: 26,
                maxHeight: 96,
                overflow: 'hidden',
              }}
            >
              {opts.subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 56 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: C.goldLight }}>
                  {s.value}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 22,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: C.muted,
                    marginTop: 6,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {/* The wordmark, bottom-right, where it does not compete with the name of the thing. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              border: `2px solid ${C.border}`,
              background: C.card,
              borderRadius: 14,
              padding: '12px 22px',
            }}
          >
            <div style={{ display: 'flex', width: 14, height: 30, background: C.gold, borderRadius: 3 }} />
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: C.gold }}>Anvil</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': OG_CACHE_CONTROL } },
  );
}
