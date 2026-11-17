'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Select from '@/components/Select';
import HuntFields, { huntPayload, huntUnchosen, type HuntFormValue } from '@/components/weekly/HuntFields';
import { BOSSES, EFFICIENCY_METRICS, RAIDS_ANY_MODE, SKILLS, SKILL_LABELS, metricKeys } from '@/lib/constants';
import { clanFetch } from '@/lib/clanFetch';
import { MAX_WEEKLY_METRIC_KEYS, joinWeeklyMetricPicks, weeklyMetricPicks } from '@/lib/weeklyMetricInput';

const TYPES = [
  { value: 'skill', label: 'Skills (XP gained)' },
  { value: 'boss', label: 'Bosses (kills gained)' },
  { value: 'efficiency', label: 'Efficiency (hours)' },
];

function optionsFor(type: string) {
  if (type === 'skill') return SKILLS.map((k) => ({ value: k as string, label: SKILL_LABELS[k] ?? k }));
  if (type === 'boss') {
    return [
      ...RAIDS_ANY_MODE.map((r) => ({ value: r.key, label: r.label, keywords: r.keywords })),
      ...BOSSES.map((b) => ({ value: b.key, label: b.label, keywords: b.aliases })),
    ];
  }
  return EFFICIENCY_METRICS.map((m) => ({ value: m.key as string, label: m.label }));
}

/**
 * "What it counts", on a competition that has not started: the skills or bosses of a weekly, or
 * what an item hunt hunts. The same pickers as the create form; saved through lib/weeklyRetarget,
 * which also clears the entrants' starting values so they are read again for the new target.
 */
export default function WeeklyTargetPanel({
  competitionId,
  type: initialType,
  metric: initialMetric,
  hunt: initialHunt,
}: {
  competitionId: number;
  type: string;
  metric: string;
  /** An item hunt's current rules as the form holds them; null for every other kind. */
  hunt: HuntFormValue | null;
}) {
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const [metric, setMetric] = useState(initialMetric);
  const [hunt, setHunt] = useState<HuntFormValue | null>(initialHunt);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const isHunt = initialType === 'hunt';
  const options = optionsFor(type);
  const multi = type === 'skill' || type === 'boss';
  const picks = weeklyMetricPicks(type, metric);
  const addable = options.filter((o) => {
    const keys = metricKeys(o.value);
    if (o.value === 'overall') return false;
    if (keys.every((k) => metricKeys(metric).includes(k))) return false;
    return new Set([...metricKeys(metric), ...keys]).size <= MAX_WEEKLY_METRIC_KEYS;
  });
  const canAdd = multi && metric !== 'overall' && addable.length > 0 && metricKeys(metric).length < MAX_WEEKLY_METRIC_KEYS;
  const setPicks = (next: string[]) => {
    const joined = joinWeeklyMetricPicks(next);
    if (joined) setMetric(joined);
  };
  const dirty = isHunt ? JSON.stringify(hunt) !== JSON.stringify(initialHunt) : type !== initialType || metric !== initialMetric;
  const unchosen = isHunt && hunt ? huntUnchosen(hunt) : null;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const target = isHunt && hunt ? { hunt: huntPayload(hunt) } : { type, metric };
      const res = await clanFetch(`/api/admin/weekly/${competitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? 'Could not save.' });
        return;
      }
      setMessage({ ok: true, text: 'Saved. Everyone’s starting point will be read again for the new target.' });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: 'Could not save. Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-5 w-1 bg-gold" />
        <h2 className="text-lg font-semibold">What it counts</h2>
      </div>
      <p className="mb-4 text-sm text-text-muted">
        You can change this until the competition starts. After that it is fixed, because gains already counted would stop meaning anything.
      </p>

      {isHunt && hunt ? (
        <HuntFields value={hunt} onChange={setHunt} />
      ) : (
        <div className="space-y-3">
          <div className="max-w-sm">
            <label className="mb-1 block text-sm text-text-muted">Kind</label>
            <Select
              value={type}
              ariaLabel="Kind of competition"
              options={TYPES}
              onChange={(v) => {
                setType(v);
                setMetric(optionsFor(v)[0]?.value ?? '');
              }}
            />
          </div>
          <div className="max-w-sm space-y-2">
            <label className="block text-sm text-text-muted">{type === 'skill' ? 'Skills' : type === 'boss' ? 'Bosses' : 'Measure'}</label>
            {picks.map((pick, i) => (
              <div key={`${pick}-${i}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={pick}
                    searchable
                    ariaLabel={`Entry ${i + 1}`}
                    options={options.filter((o) => o.value === pick || i === 0 || addable.some((a) => a.value === o.value))}
                    onChange={(v) => setPicks(v === 'overall' ? ['overall'] : picks.map((p, j) => (j === i ? v : p)))}
                  />
                </div>
                {picks.length > 1 && (
                  <button type="button" onClick={() => setPicks(picks.filter((_, j) => j !== i))} className="rounded-lg border border-card-border px-2.5 py-2 text-sm text-text-muted transition-colors hover:text-foreground" aria-label={`Remove entry ${i + 1}`}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            {canAdd && (
              <button type="button" onClick={() => setPicks([...picks, addable[0].value])} className="text-sm text-gold transition-colors hover:text-gold-light">
                + Add another {type === 'skill' ? 'skill' : 'boss'}
              </button>
            )}
            {multi && picks.length > 1 && <p className="text-xs text-text-dim">Gains in all of them are added together.</p>}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || !!unchosen}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save what it counts'}
        </button>
        {unchosen && <span className="text-sm text-amber-300">Choose where {unchosen.name} counts from first.</span>}
        {message && <span className={`text-sm ${message.ok ? 'text-accent-green-light' : 'text-red-400'}`}>{message.text}</span>}
      </div>
    </section>
  );
}
