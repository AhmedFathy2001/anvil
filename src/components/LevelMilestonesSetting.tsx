'use client';

import { useEffect, useState } from 'react';

import LevelRulesEditor from '@/components/LevelRulesEditor';
import { useUnsavedChanges, UnsavedIndicator } from '@/components/UnsavedChanges';
import { clanFetch } from '@/lib/clanFetch';
import { DEFAULT_MILESTONE_RULES, type MilestoneRules } from '@/lib/levelRules';
import { valuesEqual } from '@/lib/unsavedChanges';

// Admin editor for the clan's level / XP milestone rules (lib/levelRules), backed by
// /api/admin/level-rules. Members can only be stricter for their own posts; the plugin picks the
// rules up on its next config poll, and the site re-checks every level post against them.
export default function LevelMilestonesSetting() {
  const [rules, setRules] = useState<MilestoneRules | null>(null);
  const [savedRules, setSavedRules] = useState<MilestoneRules | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dirty = !!rules && !!savedRules && !valuesEqual(rules, savedRules);
  useUnsavedChanges(dirty);

  useEffect(() => {
    (async () => {
      try {
        const res = await clanFetch('/api/admin/level-rules');
        const data = res.ok ? await res.json() : null;
        const loaded: MilestoneRules = data?.rules ?? { ...DEFAULT_MILESTONE_RULES };
        setRules(loaded);
        setSavedRules(loaded);
      } catch {
        const loaded: MilestoneRules = { ...DEFAULT_MILESTONE_RULES };
        setRules(loaded);
        setSavedRules(loaded);
      }
    })();
  }, []);

  async function save(next: MilestoneRules | null) {
    if (!next) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/level-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRules(data.rules ?? next);
        setSavedRules(data.rules ?? next);
        setMessage({ type: 'success', text: 'Saved. Plugins pick this up on their next refresh.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  if (!rules) return <p className="text-xs text-text-muted">Loading…</p>;

  return (
    <div className="grid gap-4">
      <LevelRulesEditor value={rules} onChange={setRules} disabled={saving} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => save(rules)}
          disabled={saving}
          className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <UnsavedIndicator dirty={dirty} />
        <button
          type="button"
          onClick={() => save({ ...DEFAULT_MILESTONE_RULES, skillXpM: [] })}
          disabled={saving}
          className="rounded-lg border border-card-border px-3 py-1.5 text-[13px] text-text-muted transition-colors hover:text-foreground disabled:opacity-50"
        >
          Reset to defaults
        </button>
        {message && (
          <span className={message.type === 'success' ? 'text-xs text-green-400' : 'text-xs text-red-400'}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
