'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { Switch } from '@/app/settings/_client';
import { clanFetch } from '@/lib/clanFetch';
import type { QuickItem, QuickRequest, QuickSettingsView } from '@/lib/quickSettings';

type Status = 'saving' | 'saved' | string;

/**
 * The few settings a new clan member most likely wants to decide (lib/quickSettings): one line each,
 * a switch, and a sentence saying what turning it on does. Every switch saves at once through the
 * route its real Settings page uses, and shows the current value; nothing changes until it is pressed.
 *
 * `strip`: the open step of the "Getting started" guide, with the two buttons that finish it.
 * `overview`: the same block on the Settings home, with no buttons but the link to every setting.
 */
export default function QuickSettings({ view, mode }: { view: QuickSettingsView; mode: 'strip' | 'overview' }) {
  const router = useRouter();
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(view.groups.flatMap((g) => g.items.map((i) => [i.id, i.checked]))));
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const base = useId();

  async function send(reqs: QuickRequest[]) {
    for (const r of reqs) {
      const res = await clanFetch(r.url, { method: r.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.body) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'That did not save.');
      }
    }
  }

  async function toggle(item: QuickItem, next: boolean) {
    const before = on[item.id];
    setOn((s) => ({ ...s, [item.id]: next }));
    setStatus((s) => ({ ...s, [item.id]: 'saving' }));
    try {
      await send(next ? item.on : item.off);
      setStatus((s) => ({ ...s, [item.id]: 'saved' }));
    } catch (e) {
      setOn((s) => ({ ...s, [item.id]: before }));
      setStatus((s) => ({ ...s, [item.id]: e instanceof Error ? e.message : 'That did not save.' }));
    }
  }

  async function finish() {
    setFinishing(true);
    setError('');
    try {
      const res = await clanFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quickSettingsDone', clanId: view.clanId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError('That did not save. Try again.');
      setFinishing(false);
    }
  }

  return (
    <div>
      {view.groups.map((g) => {
        const items = g.items.filter((i) => !(i.hideWhenOn && on[i.hideWhenOn]));
        if (items.length === 0) return null;
        return (
          <div key={g.heading} className="mt-3 first:mt-0">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">{g.heading}</h3>
            <ul className="mt-1 divide-y divide-card-border/60">
              {items.map((i) => {
                const st = status[i.id];
                const descId = `${base}-${i.id}`;
                return (
                  <li key={i.id} className="flex items-start gap-3 py-2">
                    <div className="min-w-0 flex-1 pt-1.5">
                      <p className="text-sm font-medium leading-snug">{i.label}</p>
                      <p id={descId} className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">
                        {i.sentence}
                      </p>
                      <p role="status" aria-live="polite" className={`min-h-4 text-[11px] ${st && st !== 'saving' && st !== 'saved' ? 'text-red-400' : 'text-accent-green-light'}`}>
                        {st === 'saved' ? 'Saved' : st === 'saving' ? 'Saving…' : st && st !== 'saving' ? st : ''}
                      </p>
                    </div>
                    <Switch tall checked={on[i.id]} disabled={st === 'saving'} onChange={(n) => toggle(i, n)} label={i.label} />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {mode === 'strip' && (
          <>
            <button type="button" onClick={finish} disabled={finishing} className="molten-btn !px-4 !py-2 text-sm max-sm:min-h-11">
              {finishing ? 'Working…' : 'Looks good'}
            </button>
            <button type="button" onClick={finish} disabled={finishing} className="rounded-md px-1 py-2 text-sm text-text-muted hover:text-gold max-sm:min-h-11">
              Skip for now
            </button>
          </>
        )}
        <ClanLink href="/settings" className="text-sm text-gold hover:text-gold-light max-sm:flex max-sm:min-h-11 max-sm:items-center">
          All settings
        </ClanLink>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
