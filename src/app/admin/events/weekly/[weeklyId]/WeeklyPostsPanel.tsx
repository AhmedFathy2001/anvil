'use client';

import { useState } from 'react';

import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { COMPETITION_POST_TYPES, type CompetitionPostOverrides, type CompetitionPostType } from '@/lib/competitionPosts';

/**
 * This competition's own Discord posts. Each follows the clan's setting (Admin → Discord → What
 * goes where → Skill & boss of the week → Posts) until it is set to On or Off here. Saves as it changes.
 */
export default function WeeklyPostsPanel({
  competitionId,
  initial,
  clanDefaults,
}: {
  competitionId: number;
  initial: CompetitionPostOverrides;
  clanDefaults: Record<string, boolean>;
}) {
  const [posts, setPosts] = useState<CompetitionPostOverrides>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function change(key: CompetitionPostType, value: string) {
    const before = posts;
    const next: CompetitionPostOverrides = { ...posts };
    if (value === 'on' || value === 'off') next[key] = value;
    else delete next[key];
    setPosts(next);
    setSaving(true);
    setError('');
    const res = await clanFetch(`/api/admin/weekly/${competitionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setPosts(before);
      setError('That didn’t save. Try again.');
    }
  }

  return (
    <section id="weekly-posts" className="scroll-mt-24 mb-6 rounded-xl border border-card-border bg-card-bg p-4">
      <h2 className="text-sm font-semibold">Discord posts</h2>
      <p className="mt-0.5 mb-3 text-[13px] text-text-muted">
        What this competition posts. Each one follows your clan’s Discord setting unless you choose here.
      </p>
      <ul className="rounded-xl border border-card-border">
        {COMPETITION_POST_TYPES.map((t) => (
          <li key={t.key} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-card-border-soft px-4 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-[1_1_260px]">
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-xs text-text-muted">{t.help}</div>
            </div>
            <Select
              className="w-52"
              value={posts[t.key] ?? 'clan'}
              onChange={(v) => void change(t.key, v)}
              options={[
                { value: 'clan', label: `Clan setting (${clanDefaults[t.key] ? 'on' : 'off'})` },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              ariaLabel={`${t.label} for this competition`}
              disabled={saving}
            />
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
