'use client';

import { useState } from 'react';
import type { Persona as PersonaData } from '@/lib/memberProfile';
import ClanLink from '@/components/ClanLink';
import { accountTypeBadge, accountTypeLabel } from '@/lib/accountType';

// Where each character stands in THIS clan. Every character the person owns is listed (lib/memberProfile
// getPersona); the chip is what tells a clan which of them it actually has.
const STATUS: Record<'member' | 'guest' | 'out', { label: string; cls: string }> = {
  member: { label: 'member', cls: 'bg-accent-green/15 text-accent-green-light' },
  guest: { label: 'guest', cls: 'bg-blue-500/15 text-blue-300' },
  out: { label: 'not in this clan', cls: 'bg-brown-light text-text-muted' },
};

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
                key={a.accountId}
                // A character seated here opens its page in this clan; one that isn't has no page here,
                // so it opens its own Anvil page instead (a platform path — never clan-prefixed).
                href={a.id != null ? `/members/${encodeURIComponent(a.rsn)}` : `/p/${encodeURIComponent(a.rsn)}`}
                className={`grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5rem] gap-2 text-sm py-1 items-center hover:text-gold ${
                  a.id === currentMemberId ? 'text-gold' : ''
                }`}
              >
                <span className="truncate">
                  {a.rsn}
                  {a.isPrimary && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">main</span>
                  )}
                  {accountTypeBadge(a.accountType) && (
                    <span
                      className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-brown-light text-foreground/80"
                      title={accountTypeLabel(a.accountType) ?? undefined}
                    >
                      {accountTypeBadge(a.accountType)}
                    </span>
                  )}
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${STATUS[a.status].cls}`}>
                    {STATUS[a.status].label}
                  </span>
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
