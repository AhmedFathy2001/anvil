'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import CompetitionPostPreview, { type PreviewEmbed } from '@/components/CompetitionPostPreview';
import { clanFetch } from '@/lib/clanFetch';
import { COMPETITION_POST_TYPES, type CompetitionPostType } from '@/lib/competitionPosts';

interface View {
  posts: Record<CompetitionPostType, boolean>;
  samples?: Partial<Record<CompetitionPostType, PreviewEmbed>>;
}

/**
 * Which posts a competition sends to Discord: the start and the results as always, and the daily
 * recap, halfway report and "ending soon" for a clan that switches them on. Each saves as it is
 * ticked. A competition can change any of them on its own Settings tab.
 */
export default function CompetitionPostsPanel() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<CompetitionPostType | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await clanFetch('/api/admin/discord/competition-posts');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setView(data);
      else setError(data.error ?? 'Could not load the competition posts.');
    })();
  }, []);

  async function save(key: CompetitionPostType, on: boolean) {
    if (!view) return;
    const before = view;
    setView({ ...view, posts: { ...view.posts, [key]: on } });
    setSaving(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/discord/competition-posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: { [key]: on } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not save.');
      setView({ ...before, posts: data.posts });
    } catch (e) {
      setView(before);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!view) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        What every competition posts to this channel. A competition can change any of these on its own Settings tab.
        Competitions shorter than 2 days only post the start and the results.
      </p>
      <ul className="rounded-xl border border-card-border bg-card-bg">
        {COMPETITION_POST_TYPES.map((t) => {
          const sample = view.samples?.[t.key];
          return (
            <li key={t.key} className="border-b border-card-border-soft px-4 py-2.5 last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="min-w-0 flex-[1_1_260px]">
                  <Checkbox
                    checked={view.posts[t.key]}
                    disabled={saving}
                    onChange={(v) => void save(t.key, v)}
                    label={t.label}
                    description={t.help}
                  />
                </div>
                {sample && (
                  <button
                    type="button"
                    aria-expanded={preview === t.key}
                    onClick={() => setPreview(preview === t.key ? null : t.key)}
                    className="min-h-9 max-sm:min-h-10 rounded-lg border border-card-border px-3 text-[13px] hover:border-gold/50"
                  >
                    Preview {preview === t.key ? '▴' : '▾'}
                  </button>
                )}
              </div>
              {sample && preview === t.key && (
                <div className="mt-3 space-y-1.5">
                  <CompetitionPostPreview embed={sample} />
                  <p className="text-[12px] text-text-muted">A sample with made-up players. Nothing is sent.</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-[13px] text-accent-red">{error}</p>}
    </div>
  );
}
