// The picture a link becomes.
//
// Every link to this site is pasted into Discord — that is the whole distribution model — so each
// kind of page draws its own card: the site, a board, a Skill or Boss of the Week, the clan table, a
// clan, a member. All of them share lib/ogKit's frame (the forge backdrop, the mark, the brand
// fonts); what differs is the art, and wherever the clan or event chose its own picture (a banner, an
// icon, a logo) that picture is used before anything we would draw.
//
// NO CALLER-SUPPLIED TEXT. The routes take a slug or an id, look the row up themselves and pass what
// the database said. An `/api/og?title=…` would be an open text-rendering endpoint on our domain,
// which is a thing people put words on other people's brands with.
//
// These are pure renderers: plain data in, an ImageResponse out. Fetching, gating and the fallback
// to the site card when something is private all live in the routes.

import type { ReactNode } from 'react';

import {
  Brand,
  C,
  ClanFace,
  DISPLAY,
  Eyebrow,
  Frame,
  MONO,
  Mark,
  PLACE_COLOR,
  Title,
  backdrop,
  clip,
  localSprite,
  renderCard,
  seedOf,
  titleSize,
} from '@/lib/ogKit';

export { OG_CACHE_CONTROL } from '@/lib/ogKit';

/** A data URL (already fetched and re-encoded), or null for "not set" / "couldn't load". */
type Pic = string | null;

/** Rows of a column, laid out absolutely so the frame's layers don't take part in the flow. */
const PANE = { display: 'flex', position: 'absolute' as const };

// ── The site ───────────────────────────────────────────────────────────────────────────────────

const SITE_SPRITES = [
  'twisted_bow', 'elder_maul', 'infernal_cape', 'tumekens_shadow', 'dragon_warhammer',
  'ancestral_hat', 'vorki', 'hydras_claw', 'kodai_insignia', 'toxic_blowpipe',
  'bandos_chestplate', 'fire_cape', 'dexterous_prayer_scroll', 'armadyl_crossbow', 'twisted_buckler',
  'abyssal_whip', 'dragon_pickaxe', 'magic_logs', 'crystal_axe', 'redwood_logs',
];
const SITE_DONE = new Set([0, 2, 6, 7, 11, 12, 16]);

export const SITE_PITCH = 'Bingos, Skill & Boss of the Week, and your whole roster, run from one place.';

/**
 * The platform's own card, and the card anything private falls back to. A tilted board of real drops
 * with a few tiles "claimed", because a bingo board is the one picture every OSRS clan recognises.
 */
export async function siteCard(): Promise<Response> {
  const sprites = await Promise.all(SITE_SPRITES.map(localSprite));
  return renderCard(['site'], async () => (
    <Frame backdrop={await backdrop({ glow: '78% 40%', seed: 3, sparkCount: 18 })}>
      <div style={{ ...PANE, left: 660, top: 78, width: 520, flexWrap: 'wrap', gap: 10, transform: 'rotate(-8deg)' }}>
        {sprites.map((src, i) => {
          const done = SITE_DONE.has(i);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                width: 94,
                height: 94,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                background: done ? 'rgba(224,170,30,0.22)' : 'rgba(28,23,20,0.9)',
                border: `2px solid ${done ? C.gold : C.border}`,
              }}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={src} width={60} height={60} style={{ width: 60, height: 60, objectFit: 'contain', opacity: done ? 1 : 0.55 }} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div
        style={{
          ...PANE,
          left: 420,
          top: 0,
          width: 780,
          height: 630,
          // Fades in from nothing so there's no edge where it starts, darkest over the board's near side.
          backgroundImage: 'linear-gradient(90deg, rgba(20,16,16,0) 0%, rgba(20,16,16,0.85) 28%, rgba(20,16,16,0.35) 55%, rgba(20,16,16,0) 85%)',
        }}
      />
      <div style={{ ...PANE, left: 76, top: 72, width: 640, height: 500, flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', marginBottom: 30 }}>
            <Mark size={112} />
          </div>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 700, fontSize: 104, lineHeight: 1, letterSpacing: -2 }}>Anvil</div>
          <div style={{ display: 'flex', fontSize: 36, marginTop: 22, lineHeight: 1.3, maxWidth: 560 }}>{SITE_PITCH}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, color: C.muted, letterSpacing: 3, textTransform: 'uppercase' }}>
          For Old School RuneScape clans
          <div style={{ display: 'flex', width: 6, height: 6, borderRadius: 6, background: C.gold }} />
          anvilosrs.com
        </div>
      </div>
    </Frame>
  ), { isOverflowCard: true });
}

// ── A board ────────────────────────────────────────────────────────────────────────────────────

export interface BoardCell {
  icon: Pic;
  /** The colour of the team that claimed it first, or null while nobody has. */
  claimedBy: string | null;
}

export interface CardStanding {
  name: string;
  /** "420" — already formatted by lib/boardScoring's units. */
  score: string;
  value: number;
  color: string;
}

export interface EventCardData {
  /** "Live now · Bingo". */
  eyebrow: string;
  stage: 'build' | 'run' | 'wrap';
  title: string;
  clanName: string;
  clanLogo: Pic;
  /** The event's own square icon, beside the eyebrow. */
  icon: Pic;
  /** The event's own wide banner, full-bleed behind everything. */
  banner: Pic;
  /** Null while the tiles are hidden — the card never shows what `tilesRevealed` is holding back. */
  board: { cols: number; cells: BoardCell[] } | null;
  standings: CardStanding[];
  /** "2d 4h left" / "Starts in 3d" / "Iron Wolves won" — the one line about time. */
  clock: string | null;
  /** "4 teams · 25 tiles". */
  facts: string | null;
}

function MiniBoard({ cols, cells }: { cols: number; cells: BoardCell[] }) {
  const gap = cols > 7 ? 5 : 8;
  const inner = 420;
  const cell = Math.floor((inner - gap * (cols - 1)) / cols);
  const iconSize = Math.round(cell * 0.64);
  const rows = Math.ceil(cells.length / cols);
  const height = rows * cell + (rows - 1) * gap;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap,
        width: cols * cell + (cols - 1) * gap + 32,
        height: height + 32,
        padding: 14,
        borderRadius: 20,
        background: 'rgba(28,23,20,0.92)',
        border: `2px solid ${C.borderHi}`,
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            width: cell,
            height: cell,
            borderRadius: cols > 7 ? 6 : 10,
            alignItems: 'center',
            justifyContent: 'center',
            background: c.claimedBy ? `${c.claimedBy}33` : C.cell,
            border: `2px solid ${c.claimedBy ?? C.border}`,
          }}
        >
          {c.icon ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={c.icon} width={iconSize} height={iconSize} style={{ width: iconSize, height: iconSize, objectFit: 'contain', opacity: c.claimedBy ? 1 : 0.45 }} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** The right half when there is no board to show yet: the event's own face, large, in a glow. */
function FaceArt({ children }: { children: ReactNode }) {
  return (
    <div style={{ ...PANE, left: 760, top: 95, width: 360, height: 360, alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          ...PANE,
          left: -50,
          top: -50,
          width: 460,
          height: 460,
          borderRadius: 460,
          backgroundImage: 'radial-gradient(circle, rgba(224,170,30,0.25), rgba(224,170,30,0) 65%)',
        }}
      />
      {children}
    </div>
  );
}

export async function eventCard(d: EventCardData): Promise<Response> {
  const size = titleSize(d.title, [[16, 84], [28, 74], [40, 62]], 54);
  // A long name gets a third line when there are no standings below it to collide with.
  const top = d.standings.slice(0, 3);
  const max = Math.max(1, ...top.map((s) => s.value));
  // The right half: the board when it can be shown; else the event's own banner, which is already
  // behind everything and needs nothing drawn over it; else its icon or the clan's face.
  const art = d.board ? (
    <div style={{ ...PANE, right: 44, top: 0, height: 630, alignItems: 'center' }}>
      <MiniBoard cols={d.board.cols} cells={d.board.cells} />
    </div>
  ) : d.banner ? null : (
    <FaceArt>
      {d.icon ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={d.icon} width={300} height={300} style={{ width: 300, height: 300, borderRadius: 66, border: `3px solid ${C.borderHi}` }} />
      ) : (
        <ClanFace name={d.clanName} logo={d.clanLogo} size={300} />
      )}
    </FaceArt>
  );

  return renderCard(['event', d], async () => (
    <Frame
      backdrop={await backdrop({ glow: '85% 95%', seed: seedOf(d.title), sparkCount: 14, sparkArea: { x: 660, y: 0, w: 540, h: 630 }, overBanner: !!d.banner })}
      background={d.banner}
    >
      {art}
      <div style={{ ...PANE, left: 76, top: 66, width: d.board ? 580 : 640, height: 500, flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
            {d.icon && d.board ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img src={d.icon} width={64} height={64} style={{ width: 64, height: 64, borderRadius: 14, border: `3px solid ${C.borderHi}` }} />
            ) : (
              <ClanFace name={d.clanName} logo={d.clanLogo} size={64} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Eyebrow dot={d.stage === 'run' ? C.live : null}>{d.eyebrow}</Eyebrow>
              <div style={{ display: 'flex', fontSize: 24, color: C.muted, marginTop: 6 }}>{`hosted by ${clip(d.clanName, 34)}`}</div>
            </div>
          </div>
          <Title size={size} maxLines={top.length ? 2 : 3}>{d.title}</Title>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {top.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', width: 26, fontFamily: MONO, fontSize: 24, color: i === 0 ? C.goldLight : C.muted }}>{String(i + 1)}</div>
              <div
                style={{
                  display: 'flex',
                  width: 230,
                  fontSize: 26,
                  fontWeight: i === 0 ? 700 : 500,
                  color: i === 0 ? C.text : C.muted,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {clip(s.name, 17)}
              </div>
              <div style={{ display: 'flex', width: 190, height: 14, borderRadius: 8, background: '#2a221c' }}>
                <div
                  style={{
                    display: 'flex',
                    width: Math.max(s.value > 0 ? 8 : 0, Math.round((190 * s.value) / max)),
                    height: 14,
                    borderRadius: 8,
                    background: s.color,
                  }}
                />
              </div>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 24, color: i === 0 ? C.goldLight : C.muted, marginLeft: 6 }}>{s.score}</div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: top.length ? 14 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, color: C.muted, letterSpacing: 2, textTransform: 'uppercase' }}>
              {d.clock ? <div style={{ display: 'flex', color: C.goldLight, fontFamily: MONO, fontSize: 24, letterSpacing: 0, textTransform: 'none' }}>{d.clock}</div> : null}
              {d.clock && d.facts ? <div style={{ display: 'flex', width: 6, height: 6, borderRadius: 6, background: C.gold }} /> : null}
              {d.facts ? <div style={{ display: 'flex' }}>{d.facts}</div> : null}
            </div>
            <Brand size={40} />
          </div>
        </div>
      </div>
    </Frame>
  ));
}

// ── Skill / Boss of the Week ───────────────────────────────────────────────────────────────────

export interface WeeklyCardData {
  kind: 'skill' | 'boss' | 'efficiency';
  /** "Skill of the Week · The AFK Spot". */
  eyebrow: string;
  stage: 'upcoming' | 'active' | 'completed';
  /** The metric, as English: "Woodcutting", "Vorkath". */
  title: string;
  /** The clan's own name for it, when it says more than the metric does. */
  subtitle: string | null;
  /** "38 members chopping · 3 days left". */
  line: string;
  /** The skill icon (pixel art) or the boss's picture. */
  art: Pic;
  top: { rsn: string; gain: string }[];
  /** Finished: the winner's box, with a highlight from Moments under it. */
  winner: { rsn: string; gain: string; highlight: string | null; sprite: Pic } | null;
}

export async function weeklyCard(d: WeeklyCardData): Promise<Response> {
  const size = titleSize(d.title, [[12, 100], [18, 84], [26, 68]], 56);
  const boss = d.kind === 'boss';

  const art = d.art ? (
    boss ? (
      <div style={{ ...PANE, left: 540, top: 40, width: 700, height: 560, alignItems: 'center', justifyContent: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={d.art} width={560} height={560} style={{ width: 560, height: 560, objectFit: 'contain' }} />
      </div>
    ) : (
      <div style={{ ...PANE, left: 790, top: 70, width: 360, height: 460, alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            ...PANE,
            left: -30,
            top: 20,
            width: 420,
            height: 420,
            borderRadius: 420,
            backgroundImage: 'radial-gradient(circle, rgba(224,170,30,0.26), rgba(224,170,30,0) 65%)',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={d.art} width={300} height={300} style={{ width: 300, height: 300, objectFit: 'contain' }} />
      </div>
    )
  ) : null;

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {d.top.map((t, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '12px 20px',
            borderRadius: 14,
            width: 640,
            background: i === 0 ? 'rgba(224,170,30,0.14)' : 'rgba(28,23,20,0.85)',
            border: `2px solid ${i === 0 ? C.gold : C.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 40,
              height: 40,
              borderRadius: 40,
              background: PLACE_COLOR[i],
              color: '#1c1512',
              fontWeight: 700,
              fontSize: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {String(i + 1)}
          </div>
          <div style={{ display: 'flex', width: 300, fontSize: 28, fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.rsn}</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 28, color: i === 0 ? C.goldLight : C.text }}>{t.gain}</div>
        </div>
      ))}
    </div>
  );

  const winner = d.winner ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        padding: '20px 26px',
        borderRadius: 16,
        background: 'rgba(224,170,30,0.12)',
        border: `2px solid ${C.gold}`,
        width: 580,
      }}
    >
      {d.winner.sprite ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={d.winner.sprite} width={72} height={72} style={{ width: 72, height: 72, objectFit: 'contain' }} />
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 20, letterSpacing: 3, textTransform: 'uppercase', color: C.gold }}>Winner</div>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, marginTop: 4 }}>{`${clip(d.winner.rsn, 14)} · ${d.winner.gain}`}</div>
        {d.winner.highlight ? (
          <div style={{ display: 'flex', fontSize: 20, color: C.muted, marginTop: 4 }}>{clip(d.winner.highlight, 48)}</div>
        ) : null}
      </div>
    </div>
  ) : null;

  return renderCard(['weekly', d], async () => (
    <Frame backdrop={await backdrop({ glow: boss ? '75% 60%' : '80% 100%', seed: seedOf(d.title), sparkCount: boss ? 16 : 10 })}>
      {art}
      {boss && d.art ? (
        <div
          style={{
            ...PANE,
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            backgroundImage: 'linear-gradient(90deg, #141010 0%, rgba(20,16,16,0.92) 40%, rgba(20,16,16,0.1) 75%)',
          }}
        />
      ) : null}
      <div style={{ ...PANE, left: 76, top: 66, width: 680, height: 500, flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Eyebrow dot={d.stage === 'active' ? C.live : null}>{d.eyebrow}</Eyebrow>
          <div style={{ display: 'flex', marginTop: 18 }}>
            <Title size={size} maxLines={1}>{d.title}</Title>
          </div>
          {d.subtitle ? <div style={{ display: 'flex', fontSize: 26, color: C.text, marginTop: 12 }}>{clip(d.subtitle, 44)}</div> : null}
          <div style={{ display: 'flex', fontSize: 28, color: C.muted, marginTop: 12 }}>{d.line}</div>
        </div>
        {winner ?? (d.top.length ? list : <div style={{ display: 'flex' }} />)}
      </div>
      <div style={{ ...PANE, right: 48, ...(winner ? { bottom: 40 } : { top: 40 }) }}>
        <Brand size={40} />
      </div>
    </Frame>
  ));
}

// ── The clan table ─────────────────────────────────────────────────────────────────────────────

export interface LeaderboardCardData {
  field: number;
  /** In finishing order: first, second, third. */
  podium: { name: string; logo: Pic; stat: string }[];
}

export async function leaderboardCard(d: LeaderboardCardData): Promise<Response> {
  // Drawn second-first-third, the way a podium stands.
  const order = [1, 0, 2].filter((i) => d.podium[i]);
  const heights = [290, 210, 160];
  return renderCard(['leaderboard', d], async () => (
    <Frame backdrop={await backdrop({ glow: '72% 100%', seed: 21, sparkCount: 18 })}>
      <div style={{ ...PANE, left: 76, top: 66, flexDirection: 'column' }}>
        <Eyebrow>Hall of Records · This week</Eyebrow>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 700, fontSize: 70, lineHeight: 1.02, letterSpacing: -1.5, marginTop: 16, width: 470 }}>
          OSRS Clan Leaderboard
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: C.muted, marginTop: 18, width: 440, lineHeight: 1.35 }}>
          {d.field > 0
            ? `${d.field.toLocaleString('en-US')} clan${d.field === 1 ? '' : 's'} ranked by XP, efficient hours and bossing.`
            : 'Clans ranked by XP, efficient hours and bossing.'}
        </div>
      </div>
      <div style={{ ...PANE, left: 76, bottom: 46 }}>
        <Brand size={40} />
      </div>
      {order.length === 0 ? (
        // Nobody ranked yet (a fresh platform, or a quiet week): the mark on the empty podium.
        <FaceArt>
          <Mark size={260} />
        </FaceArt>
      ) : null}
      <div style={{ ...PANE, left: 556, bottom: 0, alignItems: 'flex-end', gap: 14 }}>
        {order.map((i) => {
          const p = d.podium[i];
          const first = i === 0;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 200 }}>
              <ClanFace name={p.name} logo={p.logo} size={first ? 104 : 84} />
              <div
                style={{
                  display: 'flex',
                  fontSize: first ? 28 : 24,
                  fontWeight: 700,
                  marginTop: 14,
                  maxWidth: 200,
                  textAlign: 'center',
                  justifyContent: 'center',
                  maxHeight: first ? 70 : 60,
                  overflow: 'hidden',
                }}
              >
                {clip(p.name, 22)}
              </div>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 20, color: C.muted, marginTop: 4, marginBottom: 14 }}>{p.stat}</div>
              <div
                style={{
                  display: 'flex',
                  width: 200,
                  height: heights[i],
                  borderTopLeftRadius: 14,
                  borderTopRightRadius: 14,
                  justifyContent: 'center',
                  paddingTop: 18,
                  backgroundImage: first ? `linear-gradient(180deg, ${C.gold}, #7a5a10)` : 'linear-gradient(180deg, #3a2e24, #221b16)',
                  border: `2px solid ${first ? C.goldLight : C.borderHi}`,
                }}
              >
                <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 700, fontSize: 64, color: first ? '#2a1d06' : PLACE_COLOR[i] }}>
                  {String(i + 1)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  ));
}

// ── A clan ─────────────────────────────────────────────────────────────────────────────────────

export interface ClanCardData {
  name: string;
  logo: Pic;
  /** The clan's own wide banner (its first frame, when animated), full-bleed behind everything. */
  banner: Pic;
  /** The clan's own words — its tagline, else the start of its description. */
  tagline: string | null;
  /** "#3 of 47", only for a clan that agreed to be ranked. */
  rank: string | null;
  /** "PvM · Skilling · Recruiting" — what the clan says it is. */
  chips: string[];
  stats: { value: string; label: string; live?: boolean }[];
}

export async function clanCard(d: ClanCardData): Promise<Response> {
  const size = titleSize(d.name, [[9, 96], [15, 80], [22, 66], [32, 56]], 48);
  return renderCard(['clan', d], async () => (
    <Frame
      backdrop={await backdrop({ glow: '78% 45%', seed: seedOf(d.name), sparkCount: 14, overBanner: !!d.banner })}
      background={d.banner}
    >
      <FaceArt>
        <ClanFace name={d.name} logo={d.logo} size={300} />
      </FaceArt>
      <div style={{ ...PANE, left: 76, top: 66, width: 640, height: 500, flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Eyebrow>OSRS Clan · on Anvil</Eyebrow>
          <div style={{ display: 'flex', marginTop: 18 }}>
            <Title size={size}>{d.name}</Title>
          </div>
          {d.tagline ? (
            <div style={{ display: 'flex', fontSize: 28, color: C.text, marginTop: 18, lineHeight: 1.3, maxHeight: 76, overflow: 'hidden' }}>
              {clip(d.tagline, 78)}
            </div>
          ) : null}
          {d.rank || d.chips.length ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
              {d.rank ? (
                <div
                  style={{
                    display: 'flex',
                    padding: '6px 16px',
                    borderRadius: 999,
                    background: 'rgba(224,170,30,0.16)',
                    border: `2px solid ${C.gold}`,
                    color: C.goldLight,
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {`${d.rank} this week`}
                </div>
              ) : null}
              {d.chips.map((c) => (
                <div
                  key={c}
                  style={{ display: 'flex', padding: '6px 16px', borderRadius: 999, border: `2px solid ${C.borderHi}`, color: C.muted, fontSize: 22 }}
                >
                  {c}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 52 }}>
          {d.stats.map((s) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 700, fontSize: 52, color: s.live ? '#ff6b5a' : C.goldLight }}>{s.value}</div>
              <div style={{ display: 'flex', fontSize: 20, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, marginTop: 4, maxWidth: 260 }}>
                {clip(s.label, 22)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...PANE, right: 48, bottom: 40 }}>
        <Brand size={40} />
      </div>
    </Frame>
  ));
}

// ── A member ───────────────────────────────────────────────────────────────────────────────────

export interface MemberCardData {
  rsn: string;
  /** Null for a character page (/p/<rsn>) whose account is in no listed clan. */
  clanName: string | null;
  clanLogo: Pic;
  /** Defaults to "Member · <clan>". */
  eyebrow?: string;
  /** "Ironman · Maxed · Captain". */
  line: string | null;
  stats: { value: string; label: string; icon: Pic }[];
  /** Up to nine sprites of what they've been getting — recent drops, else their bosses' signature drops. */
  loot: Pic[];
}

export async function memberCard(d: MemberCardData): Promise<Response> {
  const size = titleSize(d.rsn, [[8, 104], [12, 92]], 76);
  const loot = d.loot.filter((x): x is string => !!x).slice(0, 9);
  return renderCard(['member', d], async () => (
    <Frame backdrop={await backdrop({ glow: '85% 70%', seed: seedOf(d.rsn), sparkCount: 12 })}>
      {loot.length ? (
        <div style={{ ...PANE, left: 730, top: loot.length > 6 ? 120 : 180, width: 400, flexWrap: 'wrap', gap: 14, transform: 'rotate(6deg)' }}>
          {loot.map((src, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                width: 118,
                height: 118,
                borderRadius: 14,
                background: 'rgba(28,23,20,0.92)',
                border: `2px solid ${C.borderHi}`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={src} width={76} height={76} style={{ width: 76, height: 76, objectFit: 'contain' }} />
            </div>
          ))}
        </div>
      ) : (
        <FaceArt>
          {d.clanName ? <ClanFace name={d.clanName} logo={d.clanLogo} size={260} /> : <Mark size={240} />}
        </FaceArt>
      )}
      <div style={{ ...PANE, left: 76, top: 66, width: 640, height: 500, flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {d.clanName ? <ClanFace name={d.clanName} logo={d.clanLogo} size={44} /> : null}
            <Eyebrow>{d.eyebrow ?? `Member · ${clip(d.clanName ?? '', 26)}`}</Eyebrow>
          </div>
          <div style={{ display: 'flex', marginTop: 20 }}>
            <Title size={size} maxLines={1}>{d.rsn}</Title>
          </div>
          {d.line ? <div style={{ display: 'flex', fontSize: 28, color: C.muted, marginTop: 16 }}>{d.line}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {d.stats.map((s) => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '14px 18px',
                borderRadius: 14,
                background: 'rgba(28,23,20,0.9)',
                border: `2px solid ${C.border}`,
                width: 148,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                  <img src={s.icon} width={24} height={24} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                ) : null}
                <div style={{ display: 'flex', fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted }}>{s.label}</div>
              </div>
              <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 700, fontSize: 38, color: C.goldLight, marginTop: 6 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...PANE, right: 48, bottom: 40 }}>
        <Brand size={40} />
      </div>
    </Frame>
  ));
}

// ── Head to head ───────────────────────────────────────────────────────────────────────────────

/** The two sides' colours, as the /compare page draws them. */
const SIDE_COLOR = { a: C.goldLight, b: '#8fb4d4' } as const;

export interface HeadToHeadSide {
  name: string;
  /** "Ironman · Theafkspot" under the name. */
  line: string | null;
  /** A clan's logo; players have none and get no face. */
  face?: { logo: Pic } | null;
}

export interface HeadToHeadCardData {
  eyebrow: string;
  a: HeadToHeadSide;
  b: HeadToHeadSide;
  rows: { label: string; a: string; b: string; leader: 'a' | 'b' | 'tie' | null }[];
  verdict: string | null;
  /** Which side the verdict favours, for its colour. */
  verdictSide: 'a' | 'b' | null;
}

function SideHead({ side, align, d }: { side: 'a' | 'b'; align: 'left' | 'right'; d: HeadToHeadSide }) {
  const size = titleSize(d.name, [[10, 64], [14, 54], [20, 44]], 38);
  const end = align === 'right';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexDirection: end ? 'row-reverse' : 'row', width: 470 }}>
      {d.face ? <ClanFace name={d.name} logo={d.face.logo} size={96} /> : null}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: end ? 'flex-end' : 'flex-start', minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', width: 5 * 12, height: 5, borderRadius: 5, background: SIDE_COLOR[side], marginBottom: 14 }} />
        <Title size={size} maxLines={1}>{clip(d.name, 24)}</Title>
        {d.line ? <div style={{ display: 'flex', fontSize: 22, color: C.muted, marginTop: 8 }}>{clip(d.line, 34)}</div> : null}
      </div>
    </div>
  );
}

/** Two characters or two clans: the names facing off, then each headline number with the leader lit. */
export async function headToHeadCard(d: HeadToHeadCardData): Promise<Response> {
  const rows = d.rows.slice(0, 6);
  const rowH = rows.length > 5 ? 50 : 58;
  const cell = (side: 'a' | 'b', r: (typeof rows)[number]) => ({
    display: 'flex',
    width: 300,
    justifyContent: side === 'a' ? 'flex-end' : 'flex-start',
    fontFamily: DISPLAY,
    fontWeight: 700,
    fontSize: r.leader === side ? 40 : 34,
    color: r.leader === side ? SIDE_COLOR[side] : r.leader === 'tie' ? C.text : C.muted,
    opacity: r.leader === side || r.leader === 'tie' ? 1 : 0.75,
  });
  return renderCard(['h2h', d], async () => (
    <Frame backdrop={await backdrop({ glow: '50% 18%', seed: seedOf(d.a.name + d.b.name), sparkCount: 12 })}>
      <div style={{ ...PANE, left: 0, top: 44, width: 1200, justifyContent: 'center' }}>
        <Eyebrow>{d.eyebrow}</Eyebrow>
      </div>
      <div style={{ ...PANE, left: 60, top: 92, width: 1080, alignItems: 'center', justifyContent: 'space-between' }}>
        <SideHead side="a" align="left" d={d.a} />
        <div
          style={{
            display: 'flex',
            width: 84,
            height: 84,
            borderRadius: 84,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(28,23,20,0.95)',
            border: `3px solid ${C.gold}`,
            color: C.goldLight,
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 34,
          }}
        >
          vs
        </div>
        <SideHead side="b" align="right" d={d.b} />
      </div>
      <div style={{ ...PANE, left: 60, top: 236, width: 1080, flexDirection: 'column', borderTop: `2px solid ${C.border}` }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', height: rowH, alignItems: 'center', justifyContent: 'center', gap: 28, borderBottom: `2px solid ${C.border}` }}>
            <div style={cell('a', r)}>{r.a}</div>
            <div
              style={{
                display: 'flex',
                width: 220,
                justifyContent: 'center',
                fontSize: 19,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                color: C.muted,
              }}
            >
              {r.label}
            </div>
            <div style={cell('b', r)}>{r.b}</div>
          </div>
        ))}
      </div>
      <div style={{ ...PANE, left: 60, right: 48, bottom: 40, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: d.verdictSide ? SIDE_COLOR[d.verdictSide] : C.text }}>
          {d.verdict ?? ''}
        </div>
        <Brand size={40} />
      </div>
    </Frame>
  ));
}
