'use client';

import { useState } from 'react';
import type { Persona as PersonaData } from '@/lib/memberProfile';
import ClanLink from '@/components/ClanLink';

// One human, several accounts. Grouped strictly by linked Discord — see getPersona() for why we
// never infer alts from anything softer.

const fmtXp = (xp: number) =>
  xp >= 1_000_000_000 ? `${(xp / 1_000_000_000).toFixed(2)}B` : `${(xp / 1_000_000).toFixed(0)}M`;

export default function Persona({
  persona,
  currentMemberId,
}: {
  persona: PersonaData;
  currentMemberId: number;
}) {
  const [open, setOpen] = useState(false);
  const others = persona.accounts.filter((a) => a.id !== currentMemberId);
  const name = persona.discordUsername ?? 'this player';
  const avatar =
    persona.discordAvatar && persona.discordId
      ? `https://cdn.discordapp.com/avatars/${persona.discordId}/${persona.discordAvatar}.png?size=64`
      : null;

  return (
    <div className="border border-card-border rounded-xl bg-card-bg mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-brown-light transition-colors"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" width={28} height={28} className="rounded-full shrink-0" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-gold/20 text-gold text-xs grid place-items-center shrink-0">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="text-sm">
            <span className="text-gold font-medium">{name}</span>
            <span className="text-text-muted"> · {persona.accounts.length} accounts</span>
          </span>
        </span>
        <span className="ml-auto flex items-center gap-4 text-sm tabular-nums">
          <span className="text-text-muted">
            <span className="text-foreground">{Math.round(persona.totalEhp).toLocaleString()}</span> EHP
          </span>
          <span className="text-text-muted">
            <span className="text-foreground">{Math.round(persona.totalEhb).toLocaleString()}</span> EHB
          </span>
          <span className="hidden sm:inline text-text-muted">
            <span className="text-foreground">{fmtXp(persona.totalXp)}</span> XP
          </span>
          <span className="text-text-muted text-xs">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-card-border px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">
            All accounts · combined totals above
          </div>
          <div className="space-y-1.5">
            {persona.accounts.map((a) => (
              <ClanLink
                key={a.id}
                href={`/members/${encodeURIComponent(a.rsn)}`}
                className={`grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5rem] gap-2 text-sm py-1 items-center hover:text-gold ${
                  a.id === currentMemberId ? 'text-gold' : ''
                }`}
              >
                <span className="truncate">
                  {a.rsn}
                  {a.isPrimary && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">main</span>
                  )}
                  {a.id === currentMemberId && <span className="ml-2 text-[10px] text-text-muted">viewing</span>}
                </span>
                <span className="text-right tabular-nums text-text-muted">{a.ehp?.toFixed(1) ?? '—'}</span>
                <span className="text-right tabular-nums text-text-muted">{a.ehb?.toFixed(1) ?? '—'}</span>
                <span className="text-right tabular-nums text-text-muted">
                  {a.overallXp ? fmtXp(a.overallXp) : '—'}
                </span>
              </ClanLink>
            ))}
          </div>
          {others.length === 0 && (
            <p className="text-xs text-text-muted mt-2">No other accounts linked to this Discord yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
