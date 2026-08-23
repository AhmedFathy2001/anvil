'use client';

import { useState } from 'react';

import BingoBoard from '@/components/BingoBoard';

/**
 * The product, doing the one thing worth promising.
 *
 * THE BOARD IS THE REAL COMPONENT. `BingoBoard` takes plain props — tiles, completions, teams — and
 * touches no database, so the landing renders the same thing a member sees, with fixture data. A
 * hand-drawn facsimile would look right today and drift the first time a tile gains a state nobody
 * remembered to mirror here.
 *
 * FIVE FORMATS, not one. Bingo opens because everyone recognises it, but leading with it alone sold
 * a quarter of the product: Anvil runs seven formats, and the four beside bingo are what make it a
 * platform rather than a bingo site. Each panel is the format's own shape — a board, a task list, a
 * track, a table — because "we also do X" as a bullet point convinces nobody.
 */

const TEAMS = [{ id: 1, name: 'Team Molten', color: '#d4a017' }];

const TILES = [
  'Dragon warhammer', 'Any Nightmare unique', '3× Zenyte shard', 'Voidwaker piece', 'Elite clue casket',
  '500 Zulrah KC', 'Any boss pet', 'Twisted bow', "Tumeken's shadow", 'Bandos tassets',
  'Dragon pickaxe', 'Justiciar piece', 'Ranger boots', "Inquisitor's mace", '5× Barrows chest',
  'Venator shard', 'Occult necklace', "10k Zulrah's scales", 'Abyssal whip', 'Any raid purple',
  "Dizana's quiver", 'Araxyte fang', 'Soulreaper axe', 'Virtus piece', 'Sunfire fanatic',
].map((label, i) => ({ id: i + 1, position: i, label, tileType: 'drop', points: 10 }));

// Nine done, scattered rather than in a line — a board mid-event, not a solved one.
const DONE = [1, 3, 5, 7, 10, 11, 13, 17, 19];
const COMPLETIONS = DONE.map((tileId) => ({ teamId: 1, tileId }));

const LEAGUES = [
  { task: 'Complete a Chambers of Xeric raid', pts: 30, done: true },
  { task: 'Reach 90 Slayer', pts: 50, done: true },
  { task: 'Obtain any megarare', pts: 150, done: false },
  { task: 'Finish 20 Hard clues', pts: 40, done: true },
  { task: 'Complete the Inferno', pts: 200, done: false },
  { task: '500 Zulrah kills', pts: 60, done: true },
  { task: 'Grandmaster combat achievement', pts: 80, done: false },
];

const RACE = [
  { team: 'Team Molten', at: 31, rank: 0 },
  { team: 'Team Quench', at: 28, rank: 1 },
  { team: 'Team Ember', at: 22, rank: 2 },
];

const WEEK = [
  { rsn: 'Denoverse', kc: 248, you: false },
  { rsn: 'Kpx Nisbro', kc: 201, you: false },
  { rsn: 'minjoll', kc: 177, you: false },
  { rsn: 'Drenvox mdps', kc: 61, you: true },
  { rsn: 'Sam Says', kc: 54, you: false },
];

const LADDER: { task: string; note?: string; pts: number; hot?: boolean; done?: boolean }[] = [
  { task: 'Kill 50 Vorkath', note: 'expires in 4h', pts: 120, hot: true },
  { task: 'Any collection log slot', pts: 75 },
  { task: 'Three Barrows chests', pts: 40 },
  { task: '10 Wintertodt crates', pts: 25, done: true },
];

type Format = 'bingo' | 'leagues' | 'race' | 'week' | 'ladder';

const FORMATS: { key: Format; label: string }[] = [
  { key: 'bingo', label: 'Bingo' },
  { key: 'leagues', label: 'Leagues' },
  { key: 'race', label: 'Tile race' },
  { key: 'week', label: 'Boss week' },
  { key: 'ladder', label: 'Ladder' },
];

export default function HeroShowcase() {
  const [format, setFormat] = useState<Format>('bingo');

  return (
    <div className="rounded-2xl border border-card-border bg-brown-dark/60 p-3.5 sm:p-4">
      <div className="mb-3 flex flex-wrap gap-1">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFormat(f.key)}
            aria-current={format === f.key}
            className={`rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
              format === f.key
                ? 'border-gold/30 bg-gold/[0.07] text-gold'
                : 'border-transparent text-text-muted hover:bg-brown-light hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {format === 'bingo' && (
        <>
          <Head title="Summer Bingo — Team Molten" meta={`${DONE.length} / 25`} />
          <BingoBoard tiles={TILES} boardSize={25} completions={COMPLETIONS} teams={TEAMS} activeTeamId={1} />
          <Foot>Every one of those was submitted by the plugin, with the screenshot attached.</Foot>
        </>
      )}

      {format === 'leagues' && (
        <>
          <Head title="Summer Leagues — 40 tasks" meta="610 pts" />
          <div className="flex flex-col gap-1 px-0.5 pt-0.5">
            {LEAGUES.map((t) => (
              <Row key={t.task} tone={t.done ? 'done' : 'idle'} label={t.task} value={String(t.pts)} />
            ))}
          </div>
          <Foot>Any number of tasks, each worth exactly what you say it is.</Foot>
        </>
      )}

      {format === 'race' && (
        <>
          <Head title="Tile race — 40 tiles" meta="day 5" />
          <div className="flex flex-col gap-4 px-0.5 pt-1">
            {RACE.map((r) => {
              const pct = (r.at / 40) * 100;
              return (
                <div key={r.team}>
                  <div className="mb-1.5 flex items-baseline gap-2 text-[12.5px]">
                    <span className={r.rank === 0 ? 'text-gold' : ''}>{r.team}</span>
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-text-muted">
                      {r.at} / 40
                    </span>
                  </div>
                  <div className="relative h-[22px] overflow-hidden rounded-md border border-tile-border bg-tile-bg">
                    <div
                      className={`absolute inset-y-0 left-0 ${
                        r.rank === 0 ? 'bg-gold/30' : r.rank === 1 ? 'bg-gold-dark/30' : 'bg-gold-dark/20'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute inset-0 grid grid-cols-10">
                      {Array.from({ length: 10 }, (_, i) => (
                        <span key={i} className="border-r border-tile-border/70 last:border-r-0" />
                      ))}
                    </div>
                    <div
                      className={`absolute top-1/2 -ml-[6.5px] -mt-[6.5px] h-[13px] w-[13px] rounded-full ${
                        r.rank === 0
                          ? 'bg-gold-light ring-[3px] ring-gold/25'
                          : r.rank === 1
                            ? 'bg-gold-dark ring-[3px] ring-gold-dark/25'
                            : 'bg-text-dim ring-[3px] ring-text-dim/20'
                      }`}
                      style={{ left: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Foot>Teams unlock the next tile only when the last one lands.</Foot>
        </>
      )}

      {format === 'week' && (
        <>
          <Head title="BOTW — Phosani's Nightmare" meta="ends Sun" />
          <div className="flex flex-col gap-0.5 px-0.5 pt-0.5">
            {WEEK.map((r, i) => (
              <div
                key={r.rsn}
                className={`flex items-center gap-3 rounded-md px-2.5 py-[7px] text-[12.5px] ${
                  r.you ? 'bg-gold/[0.08] text-gold' : ''
                }`}
              >
                <span
                  className={`w-3.5 text-right font-mono text-[11px] tabular-nums ${
                    r.you || i === 0 ? 'text-gold' : 'text-text-dim'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="truncate">
                  {r.rsn}
                  {r.you && ' — you'}
                </span>
                <span
                  className={`ml-auto font-mono text-xs tabular-nums ${r.you ? 'text-gold' : 'text-text-muted'}`}
                >
                  {r.kc}
                </span>
              </div>
            ))}
          </div>
          <Foot>
            Skill, boss, or pure efficiency (EHP/EHB). Baselines taken Monday — nobody entered
            anything.
          </Foot>
        </>
      )}

      {format === 'ladder' && (
        <>
          <Head title="Ladder — rolling missions" meta="live" />
          <div className="flex flex-col gap-1 px-0.5 pt-0.5">
            {LADDER.map((m) => (
              <Row
                key={m.task}
                tone={m.hot ? 'hot' : m.done ? 'done' : 'idle'}
                label={m.task}
                note={m.note}
                value={String(m.pts)}
              />
            ))}
          </div>
          <Foot>Missions appear mid-event and decay. Claim them before they go.</Foot>
        </>
      )}
    </div>
  );
}

/** One line of a task list — the shape leagues and ladder share. */
function Row({
  tone,
  label,
  note,
  value,
}: {
  tone: 'done' | 'hot' | 'idle';
  label: string;
  note?: string;
  value: string;
}) {
  const cls =
    tone === 'done'
      ? 'border-accent-green/35 bg-tile-completed text-accent-green-light'
      : tone === 'hot'
        ? 'border-gold bg-tile-bg text-gold-light shadow-[0_0_14px_rgba(224,170,30,0.14)]'
        : 'border-tile-border bg-tile-bg text-text-muted';
  return (
    <div className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-[12.5px] ${cls}`}>
      <span className="min-w-0 truncate">
        {label}
        {note && <span className="text-text-dim"> · {note}</span>}
      </span>
      <b className="ml-auto font-mono text-xs font-medium tabular-nums opacity-80">{value}</b>
    </div>
  );
}

function Head({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1 pb-3">
      <span className="grid h-[17px] w-[17px] place-items-center rounded bg-gold-dark font-mono text-[9px] font-semibold text-brown-dark">
        AF
      </span>
      <span className="min-w-0 truncate text-[13.5px] font-medium">{title}</span>
      <span className="ml-auto shrink-0 font-mono text-[11px] text-text-dim">{meta}</span>
    </div>
  );
}

function Foot({ children }: { children: React.ReactNode }) {
  return <p className="px-1 pt-3.5 text-xs leading-relaxed text-text-dim">{children}</p>;
}
