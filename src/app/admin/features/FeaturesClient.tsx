'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import GuideLink from '@/components/GuideLink';
import ItemSlot, { type SpriteName } from '@/components/ItemSlot';
import { clanFetch } from '@/lib/clanFetch';
import { FEATURES, type FeatureDef, type FeatureKey } from '@/lib/features';

const SPRITE: Record<FeatureKey, SpriteName> = {
  weekly: 'stats',
  poolFormats: 'casket',
  missions: 'dagger',
  survey: 'emblem',
  fees: 'coins',
  coffer: 'coins',
  announce: 'hammer',
  funMessages: 'petRock',
  clanHall: 'bandos',
};

const GROUPS: FeatureDef['group'][] = ['Events', 'Money', 'Discord & plugin'];

export default function FeaturesClient({ initial }: { initial: { key: FeatureKey; on: boolean }[] }) {
  const router = useRouter();
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(initial.map((f) => [f.key, f.on])));
  const [saving, setSaving] = useState<FeatureKey | null>(null);
  const [error, setError] = useState('');

  async function toggle(key: FeatureKey, next: boolean) {
    setError('');
    setSaving(key);
    setOn((s) => ({ ...s, [key]: next }));
    const res = await clanFetch('/api/admin/features', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, on: next }),
    });
    setSaving(null);
    if (!res.ok) {
      setOn((s) => ({ ...s, [key]: !next }));
      setError('That didn’t save. Try again.');
      return;
    }
    // The sidebar and member nav read these too.
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="display display-lg text-4xl sm:text-[44px] font-semibold leading-tight">Features</h1>
        <p className="text-text-muted mt-2 text-[15px] max-w-[62ch]">
          Switch on only what your clan uses. Anything switched off is hidden for everyone, staff and members alike.
          Nothing is deleted, so switching it back on brings it all back.
        </p>
      </header>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group} className="border border-[#2e251d] rounded-xl bg-[#18130f] p-5">
            <h2 className="display text-xl font-semibold mb-4">{group}</h2>
            <ul className="space-y-4">
              {FEATURES.filter((f) => f.group === group).map((f) => (
                <li key={f.key} className="flex gap-4 items-start">
                  <ItemSlot name={SPRITE[f.key]} size={40} />
                  <label className="flex-1 min-w-0 flex gap-3 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-1 shrink-0 accent-gold"
                      checked={on[f.key] ?? true}
                      disabled={saving === f.key}
                      onChange={(e) => toggle(f.key, e.target.checked)}
                    />
                    <span>
                      <span className="block font-medium">
                        {f.name}
                        {!on[f.key] && <span className="ml-2 text-xs font-normal text-text-dim">hidden</span>}
                        {saving === f.key && <span className="ml-2 text-xs font-normal text-text-muted">Saving…</span>}
                      </span>
                      <span className="block text-sm text-text-muted mt-0.5">{f.what}</span>
                    </span>
                  </label>
                  <GuideLink href={f.guide}>How it works</GuideLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
