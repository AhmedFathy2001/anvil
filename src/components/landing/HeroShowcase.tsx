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
 * Three formats behind tabs because bingo is the recognisable one but a quarter of what Anvil runs,
 * and a landing page that only shows bingo sells a quarter of the product. Bingo opens first for the
 * same reason it is not the only one.
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

const WEEK = [
  { rsn: 'Denoverse', kc: 248, you: false },
  { rsn: 'Kpx Nisbro', kc: 201, you: false },
  { rsn: 'minjoll', kc: 177, you: false },
  { rsn: 'Drenvox mdps', kc: 61, you: true },
  { rsn: 'Sam Says', kc: 54, you: false },
  { rsn: 'Amascuff', kc: 40, you: false },
];

const RACE = [
  { team: 'Team Molten', at: 31, lead: true },
  { team: 'Team Quench', at: 28, lead: false },
  { team: 'Team Ember', at: 22, lead: false },
];

type Format = 'bingo' | 'week' | 'race';

const FORMATS: { key: Format; label: string }[] = [
  { key: 'bingo', label: 'Bingo' },
  { key: 'week', label: 'Boss week' },
  { key: 'race', label: 'Tile race' },
];

export default function HeroShowcase() {
  const [format, setFormat] = useState<Format>('bingo');

  return (
    <div className="rounded-2xl border border-card-border bg-brown-dark/55 p-4">
      <div className="mb-3 flex flex-wrap gap-1">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFormat(f.key)}
            aria-current={format === f.key}
            className={`rounded-md border px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors ${
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

      {format === 'week' && (
        <>
          <Head title="BOTW — Phosani's Nightmare" meta="ends Sun" />
          <div className="flex flex-col gap-2.5 px-1 pt-1">
            {WEEK.map((r, i) => (
              <div key={r.rsn} className="grid grid-cols-[17px_1fr] items-center gap-3">
                <div className={`text-right font-mono text-xs ${i === 0 ? 'text-gold' : 'text-text-muted/70'}`}>
                  {i + 1}
                </div>
                <div>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className={`text-[12.5px] font-medium ${r.you ? 'text-gold' : ''}`}>
                      {r.rsn}
                      {r.you && ' — you'}
                    </span>
                    <span className="ml-auto font-mono text-[11.5px] text-text-muted">{r.kc} kc</span>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-sm bg-brown-light">
                    <div
                      className={`h-full rounded-sm ${i === 0 ? 'bg-gradient-to-r from-gold to-gold-light' : 'bg-gradient-to-r from-gold-dark to-gold'}`}
                      style={{ width: `${Math.round((r.kc / WEEK[0].kc) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Foot>Baselines taken Monday. Nobody entered anything.</Foot>
        </>
      )}

      {format === 'race' && (
        <>
          <Head title="Tile race — 40 tiles" meta="day 5" />
          <div className="flex flex-col gap-4 px-1 pt-1">
            {RACE.map((r) => {
              const pct = (r.at / 40) * 100;
              return (
                <div key={r.team}>
                  <div className="mb-1.5 flex items-baseline gap-2 text-[12.5px]">
                    <span className={r.lead ? 'text-gold' : ''}>{r.team}</span>
                    <span className="ml-auto font-mono text-[11px] text-text-muted">{r.at} / 40</span>
                  </div>
                  <div className="relative h-[22px] overflow-hidden rounded-md border border-tile-border bg-tile">
                    <div
                      className={`absolute inset-y-0 left-0 ${r.lead ? 'bg-gold/30' : 'bg-gold-dark/20'}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute inset-0 grid grid-cols-10">
                      {Array.from({ length: 10 }, (_, i) => (
                        <span key={i} className="border-r border-tile-border/70 last:border-r-0" />
                      ))}
                    </div>
                    <div
                      className={`absolute top-1/2 -ml-[6.5px] -mt-[6.5px] h-[13px] w-[13px] rounded-full ${
                        r.lead ? 'bg-gold-light ring-[3px] ring-gold/25' : 'bg-gold-dark ring-[3px] ring-gold-dark/20'
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
    </div>
  );
}

function Head({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1 pb-3">
      <span className="grid h-[17px] w-[17px] place-items-center rounded bg-gold-dark font-mono text-[9px] font-semibold text-brown-dark">
        AF
      </span>
      <span className="text-[13.5px] font-medium">{title}</span>
      <span className="ml-auto font-mono text-[11px] text-text-muted/70">{meta}</span>
    </div>
  );
}

function Foot({ children }: { children: React.ReactNode }) {
  return <p className="px-1 pt-4 text-xs text-text-muted/70">{children}</p>;
}
