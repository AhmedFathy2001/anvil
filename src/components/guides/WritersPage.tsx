'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { clanFetch } from '@/lib/clanFetch';
import { WriterBadge, type QuillTone } from './osrs';

export interface WritersProps {
  month: string;
  me: { rank: string | null; tone: QuillTone | null; band: string; monthBand: string; toGo: { rank: string; n: number } | null; supporter: boolean; pieces: { id: number; name: string; guideTitle: string; guideSlug: string; status: string; voters: number }[] } | null;
  featured: { userId: number; name: string; picked: boolean; granted: boolean; tone: QuillTone | null; supporter: boolean }[];
  canCurate: boolean;
  isStaff: boolean;
  wanted: { guideTitle: string | null; topic: string | null; requesters: number; slug: string | null }[];
}

const RANKS: { tone: QuillTone | null; label: string; sub: string }[] = [
  { tone: null, label: 'No writer rank', sub: 'Write a setup players use' },
  { tone: 'bronze', label: 'Contributor', sub: 'Your first players helped' },
  { tone: 'silver', label: 'Guide writer', sub: '1,000 players helped' },
  { tone: 'gold', label: 'Master writer', sub: '10,000 players helped · curator powers' },
];

/**
 * Writers: ranks and their flair, your own impact (a band, not a live number), the month's
 * featured writers (a group, not a 1-2-3), and the Wanted gaps. Credit is use: players helped by
 * your live pieces this month, kc-checked and weighted so alts, new accounts and one clan's crowd
 * count for little. Rewrites don't rank; improvements do.
 */
export default function WritersPage(p: WritersProps) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  async function act(action: 'record' | 'pick' | 'grant', userId?: number) {
    const res = await clanFetch('/api/staff/guides/awards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, month: p.month, userId }) });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(res.ok ? 'Done.' : j.error ?? 'Could not do that.');
    router.refresh();
  }
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <ClanLink href="/guides" className="text-xs text-text-muted hover:text-gold">
          ‹ Guides
        </ClanLink>
        <h1 className="mt-2 text-3xl font-extrabold">Writers</h1>
        <p className="mt-1 text-sm text-text-muted">Write setups people use. Every real player your live pieces help counts toward your rank and your flair.</p>
      </div>

      <section className="space-y-3 rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="font-bold">Flair</h2>
        <p className="text-xs text-text-muted">Writer rank colours the quill. With Supporter it becomes the gold star with the quill — the best of both.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          {RANKS.map((r) => (
            <div key={r.label} className="flex items-center gap-3 rounded-lg border border-card-border bg-black/20 p-3">
              {r.tone ? <WriterBadge tone={r.tone} size={28} title={r.label} /> : <span className="h-7 w-7 rounded-full border border-dashed border-card-border" />}
              <span className="text-xs">
                <strong className="block text-sm">{r.label}</strong>
                <span className="text-text-muted">{r.sub}</span>
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-lg border border-gold/40 bg-[#2a2114] p-3 sm:col-span-4">
            <WriterBadge tone="gold" supporter size={28} title="Master writer and Supporter" />
            <span className="text-xs">
              <strong className="block text-sm">Supporter + writer</strong>
              <span className="text-text-muted">Gold star and quill, on bylines, your profile and in the plugin.</span>
            </span>
          </div>
        </div>
      </section>

      {p.me && (
        <section className="space-y-3 rounded-xl border border-card-border bg-card-bg p-5">
          <h2 className="font-bold">Your impact</h2>
          <div className="flex flex-wrap items-center gap-4">
            {p.me.tone && <WriterBadge tone={p.me.tone} supporter={p.me.supporter} size={36} title={p.me.rank ?? ''} />}
            <div>
              <div className="text-2xl font-extrabold text-gold">{p.me.monthBand}</div>
              <div className="text-xs text-text-muted">helped this month · {p.me.band} lifetime</div>
            </div>
            <div className="text-sm">
              <strong>{p.me.rank ?? 'No rank yet'}</strong>
              {p.me.toGo && (
                <span className="block text-xs text-text-muted">
                  {p.me.toGo.n.toLocaleString('en-US')} players to {p.me.toGo.rank}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-text-muted">Ranks need impact, not edit counts: a fix earns a little once, a substantive improvement shares a piece&apos;s reach, and the original writer keeps theirs.</p>
          {p.me.pieces.length > 0 && (
            <ul className="divide-y divide-card-border text-sm">
              {p.me.pieces.map((x) => (
                <li key={x.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    {x.name}{' '}
                    <ClanLink href={`/guides/${x.guideSlug}`} className="text-xs text-text-muted hover:text-gold">
                      {x.guideTitle}
                    </ClanLink>
                  </span>
                  <span className="text-xs text-text-muted">{x.status === 'hidden' ? 'hidden (no credit)' : x.status}</span>
                  <span className="w-20 text-right text-xs">{x.voters} used</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-card-border bg-card-bg p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-bold">Top writers this month</h2>
          {p.canCurate && (
            <button type="button" onClick={() => act('record')} className="rounded-lg border border-card-border px-3 py-1.5 text-xs">
              Record {p.month}
            </button>
          )}
        </div>
        <p className="text-xs text-text-muted">A featured group, in name order. Each month curators pick one of them for a month of Supporter.</p>
        {p.featured.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody yet this month.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.featured.map((w) => (
              <li key={w.userId} className="flex items-center gap-2 rounded-lg border border-card-border bg-black/20 p-2.5 text-sm">
                {w.tone && <WriterBadge tone={w.tone} supporter={w.supporter} />}
                <span className="flex-1">{w.name}</span>
                {w.granted ? (
                  <span className="text-xs text-emerald-300">Supporter granted</span>
                ) : w.picked ? (
                  p.isStaff ? (
                    <button type="button" onClick={() => act('grant', w.userId)} className="rounded bg-gold px-2 py-1 text-xs font-semibold text-brown-dark">
                      Grant a month of Supporter
                    </button>
                  ) : (
                    <span className="text-xs text-gold">picked</span>
                  )
                ) : (
                  p.canCurate && (
                    <button type="button" onClick={() => act('pick', w.userId)} className="rounded border border-gold/50 px-2 py-1 text-xs text-gold">
                      Pick for the reward
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="text-xs text-text-muted">{msg}</p>}
      </section>

      {p.wanted.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Wanted</h2>
          <p className="text-xs text-text-muted">Gaps players searched for and found nothing. First to write it gets extra credit.</p>
          {p.wanted.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg p-2.5 text-sm">
              <span className="flex-1">{w.guideTitle ?? w.topic}</span>
              <span className="text-xs text-text-muted">{w.requesters} asked</span>
              <ClanLink href={w.slug ? `/guides/${w.slug}/submit` : '/guides/propose'} className="text-xs text-gold hover:underline">
                Write it
              </ClanLink>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
