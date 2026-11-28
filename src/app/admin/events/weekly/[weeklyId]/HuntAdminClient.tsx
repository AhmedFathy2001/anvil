'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';
import LocalTime from '@/components/LocalTime';
import ThingIcon from '@/components/ThingIcon';
import { HuntProofForm, HuntStandingsTable } from '@/components/weekly/HuntBoard';
import { clanFetch } from '@/lib/clanFetch';
import type { HuntView } from '@/lib/itemHuntView';
import { itemIconUrl } from '@/lib/tileIcons';
import type { WeeklyPrizes } from '@/lib/weeklyPrizes';
import WeeklyPrizeEditor from './WeeklyPrizeEditor';
import type { WeeklyWinner } from '@/lib/coffer';
import { displayImageUrl } from '@/lib/displayImage';

/** A drop staff have something to decide about, with what they need to decide it. */
export interface HuntAttention {
  id: number;
  rsn: string;
  itemId: number | null;
  itemName: string;
  source: string | null;
  occurredAt: string;
  /** 'proof' a member's screenshot; 'held' a plugin report that looked wrong; 'deciding' the ending
   *  waits on it; 'prize' a prize place rests on it. */
  why: 'proof' | 'held' | 'deciding' | 'prize';
  reason: string | null;
  /** The number the drop claims ("1,204 kc"), and the site's own reading for that character. */
  stated: string | null;
  site: string | null;
  mismatch: boolean;
  screenshotUrl: string | null;
  note: string | null;
}

const WHY: Record<HuntAttention['why'], string> = {
  proof: 'Screenshot proof from the member',
  held: 'Plugin report held for a look',
  deciding: 'The hunt ends once this is confirmed',
  prize: 'A prize place rests on this',
};

export default function HuntAdminClient({
  competitionId,
  title,
  view,
  attention,
  entrants,
  asItStands,
  prizes,
  prizesWaiting,
}: {
  competitionId: number;
  title: string;
  view: HuntView;
  attention: HuntAttention[];
  entrants: { id: number; rsn: string }[];
  /** The top of the standings in words, for the "End now" confirm. */
  asItStands: string[];
  prizes: { initial: WeeklyPrizes; cofferAvailable: number; held: boolean; settledAt: string | null; canEdit: boolean; hasCoffer: boolean; hcw?: boolean; winners: WeeklyWinner[] };
  /** The hunt has finished and its prizes are waiting on unconfirmed drops. */
  prizesWaiting: boolean;
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [busy, setBusy] = useState<number | 'end' | null>(null);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const base = `/admin/events/weekly/${competitionId}`;
  const ended = view.status === 'completed';

  async function act(body: Record<string, unknown>, key: number | 'end'): Promise<boolean> {
    setBusy(key);
    setMessage('');
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/hunt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || 'That did not work.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setMessage('That did not work. Check your connection and try again.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function reject(a: HuntAttention) {
    const ok = await confirm({
      title: `Reject ${a.rsn}'s ${a.itemName}?`,
      body: 'It comes out of the standings and the hunt carries on. This is written to the audit log.',
      confirmLabel: 'Reject',
      tone: 'danger',
    });
    if (ok) await act({ action: 'reject', dropId: a.id }, a.id);
  }

  async function endNow() {
    const ok = await confirm({
      title: 'End this hunt now and post the results?',
      body: [
        'Drops stop counting now and the results post to Discord straight away.',
        asItStands.length ? `As it stands: ${asItStands.join(', ')}.` : 'As it stands nobody has a drop, so the post will say nobody got one.',
        prizes.initial.places.length > 0 && view.confirm === 'staff' ? 'Prizes are paid once the winning drops are confirmed.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'End now and post results',
    });
    if (!ok) return;
    if (await act({ action: 'end' }, 'end')) setMessage('Ended. The results have been posted.');
  }

  return (
    <div className="space-y-6">
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-text-muted">
          <span className="font-medium text-foreground/90">{view.kindWord}:</span> {view.line}
          {!ended && <> · ends {view.endingWords}</>}
        </p>
        <div className="flex flex-wrap gap-2">
          <ClanLink href={`${base}/settings`} className="min-h-11 rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-text-muted transition-colors hover:border-gold/40 hover:text-gold">
            Settings <span className="text-text-dim">· how it ends, who confirms</span>
          </ClanLink>
          {view.status === 'active' && (
            <button type="button" onClick={endNow} disabled={busy === 'end'} className="min-h-11 rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-50">
              {busy === 'end' ? 'Ending…' : 'End now and post results'}
            </button>
          )}
        </div>
      </div>
      {message && <p className="text-sm text-amber-300">{message}</p>}

      {prizesWaiting && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm">
          The hunt has finished. Its prizes are waiting: confirm or reject the winning drops below and the coffer pays within 15 minutes.
        </p>
      )}

      {attention.length > 0 && (
        <section className="rounded-xl border border-amber-400/40 bg-amber-400/[0.06] p-4 sm:p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <span className="h-5 w-1 rounded-full bg-amber-400" />
            Needs you <span className="text-sm font-normal text-text-muted">· {attention.length}</span>
          </h2>
          <p className="mb-3 text-xs text-text-muted">A plugin report is the player&rsquo;s client speaking. Confirm what you believe; reject what you do not.</p>
          <ul className="space-y-3">
            {attention.map((a) => (
              <li key={a.id} className="rounded-lg border border-card-border bg-card-bg p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <ThingIcon src={a.itemId != null ? itemIconUrl(a.itemId) : null} alt="" size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {a.rsn} <span className="font-normal text-text-muted">·</span> {a.itemName}
                    </p>
                    <p className="text-xs text-text-muted">
                      <LocalTime date={a.occurredAt} format="short" />
                      {a.source ? ` · from ${a.source}` : ' · no source given'} · {WHY[a.why]}
                    </p>
                    {a.reason && <p className="mt-1 text-xs text-amber-300">{a.reason}</p>}
                    {(a.stated || a.site) && (
                      <p className={`mt-1 text-xs ${a.mismatch ? 'text-amber-300' : 'text-text-muted'}`}>
                        {a.stated ? `Says ${a.stated}` : 'No number given'}
                        {a.site ? ` · the site read ${a.site} then` : ' · the site has no reading to compare'}
                        {a.mismatch && ' · these do not agree'}
                      </p>
                    )}
                    {a.note && <p className="mt-1 text-xs italic text-text-muted">&ldquo;{a.note}&rdquo;</p>}
                  </div>
                  {a.screenshotUrl && (
                    <a href={displayImageUrl(a.screenshotUrl)} target="_blank" rel="noreferrer" className="block shrink-0" title="Open the screenshot">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={displayImageUrl(a.screenshotUrl)} alt={`${a.rsn}'s screenshot`} className="h-20 w-32 rounded border border-card-border object-cover" loading="lazy" />
                    </a>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy === a.id} onClick={() => act({ action: 'confirm', dropId: a.id }, a.id)} className="min-h-11 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-brown-dark hover:bg-gold-light disabled:opacity-50">
                    Confirm
                  </button>
                  <button type="button" disabled={busy === a.id} onClick={() => reject(a)} className="min-h-11 rounded-lg border border-card-border px-4 py-2 text-sm text-text-muted hover:border-red-400/50 hover:text-red-300 disabled:opacity-50">
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!ended && (
        <section className="rounded-xl border border-card-border bg-card-bg p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className="h-5 w-1 rounded-full bg-gold" />
                Add a drop
              </h2>
              <p className="text-xs text-text-muted">For a player without the plugin. Needs a screenshot and the kill count or XP. It shows as a manual proof approved by you.</p>
            </div>
            <button type="button" onClick={() => setAdding((o) => !o)} aria-expanded={adding} className="min-h-11 rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
              {adding ? 'Close' : 'Add a drop'}
            </button>
          </div>
          {adding && (
            <div className="mt-4 border-t border-card-border pt-4">
              <HuntProofForm competitionId={competitionId} proof={view.proof} characters={entrants} staff onDone={() => setAdding(false)} />
            </div>
          )}
        </section>
      )}

      <div id="prizes">
        <WeeklyPrizeEditor
          competitionId={competitionId}
          initial={prizes.initial}
          cofferAvailable={prizes.cofferAvailable}
          initialHeld={prizes.held}
          settledAt={prizes.settledAt}
          canEdit={prizes.canEdit}
          hasCoffer={prizes.hasCoffer}
          hcw={prizes.hcw}
          winners={prizes.winners}
        />
        {prizes.initial.places.length > 0 && (
          <p className="mt-2 text-xs text-text-muted">
            {view.confirm === 'staff'
              ? 'Prizes on a hunt are paid once staff have confirmed the winning drops.'
              : 'This hunt counts plugin drops automatically, so prizes are paid on them without a check. Change that in Settings.'}
          </p>
        )}
      </div>

      <section aria-label={`${title} standings`}>
        <HuntStandingsTable view={view} />
      </section>
    </div>
  );
}
