'use client';

import { useEffect, useMemo, useState } from 'react';
import Input from '@/components/Input';
import Select from '@/components/Select';

// Admin editor for the board-balance effort rates (backed by /api/admin/balance-rates).
// Renders the MERGED view (curated defaults + this clan's overrides); saving diffs the
// edited rows against the defaults and stores only the changes, so future default
// improvements flow through untouched rows. Every rate is a fast/average/slow triplet.

type Triplet = [number, number, number];
type Floor = 'anyone' | 'mid' | 'high' | 'elite';

interface SkillRate { xpPerHour: Triplet; floor?: Floor }
interface ActivityRate { killSeconds?: Triplet; attemptMinutes?: Triplet; successRate?: Triplet; floor?: Floor }
interface Rates {
  skills: Record<string, SkillRate>;
  activities: Record<string, ActivityRate>;
}

const FLOOR_OPTIONS = [
  { value: 'anyone', label: 'Anyone' },
  { value: 'mid', label: 'Mid' },
  { value: 'high', label: 'High' },
  { value: 'elite', label: 'Elite' },
];

function TripletInputs({
  value,
  onChange,
  scale = 1,
}: {
  value: Triplet;
  onChange: (t: Triplet) => void;
  /** Display divisor (e.g. successRate edited as %). */
  scale?: number;
}) {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <Input
          key={i}
          type="number"
          value={Math.round(value[i] * scale * 100) / 100}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!Number.isFinite(n) || n < 0) return;
            const next = [...value] as Triplet;
            next[i] = n / scale;
            onChange(next);
          }}
          className="w-20 px-1.5 py-1 text-xs text-center"
          aria-label={['fast', 'average', 'slow'][i]}
        />
      ))}
    </span>
  );
}

export default function BalanceRatesSetting() {
  const [defaults, setDefaults] = useState<Rates | null>(null);
  const [merged, setMerged] = useState<Rates | null>(null);
  const [tab, setTab] = useState<'activities' | 'skills'>('activities');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/balance-rates');
      if (!res.ok) return;
      const data = await res.json();
      const d = data.defaults as Rates;
      const o = (data.overrides ?? {}) as Partial<Rates>;
      setDefaults(d);
      setMerged({
        skills: { ...d.skills, ...(o.skills ?? {}) },
        activities: { ...d.activities, ...(o.activities ?? {}) },
      });
    })();
  }, []);

  const isModified = useMemo(() => {
    if (!defaults || !merged) return () => false;
    return (section: 'skills' | 'activities', key: string) => {
      const def = (defaults[section] as Record<string, unknown>)[key];
      const cur = (merged[section] as Record<string, unknown>)[key];
      return JSON.stringify(def) !== JSON.stringify(cur);
    };
  }, [defaults, merged]);

  if (!defaults || !merged) return <p className="text-sm text-text-muted">Loading rates…</p>;

  const setActivity = (key: string, patch: Partial<ActivityRate>) =>
    setMerged((m) => m && { ...m, activities: { ...m.activities, [key]: { ...m.activities[key], ...patch } } });
  const setSkill = (key: string, patch: Partial<SkillRate>) =>
    setMerged((m) => m && { ...m, skills: { ...m.skills, [key]: { ...m.skills[key], ...patch } } });
  const resetRow = (section: 'skills' | 'activities', key: string) =>
    setMerged((m) => {
      if (!m) return m;
      const next = { ...m, [section]: { ...m[section] } } as Rates;
      const def = (defaults[section] as Record<string, unknown>)[key];
      if (def) (next[section] as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(def));
      else delete (next[section] as Record<string, unknown>)[key];
      return next;
    });

  async function save() {
    if (!merged || !defaults) return;
    setSaving(true);
    setMsg(null);
    // Sparse diff: only rows that differ from the curated defaults are stored.
    const overrides: { skills: Record<string, SkillRate>; activities: Record<string, ActivityRate> } = { skills: {}, activities: {} };
    for (const [k, v] of Object.entries(merged.skills)) {
      if (JSON.stringify(defaults.skills[k]) !== JSON.stringify(v)) overrides.skills[k] = v;
    }
    for (const [k, v] of Object.entries(merged.activities)) {
      if (JSON.stringify(defaults.activities[k]) !== JSON.stringify(v)) overrides.activities[k] = v;
    }
    const res = await fetch('/api/admin/balance-rates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides }),
    });
    setSaving(false);
    const count = Object.keys(overrides.skills).length + Object.keys(overrides.activities).length;
    setMsg(res.ok
      ? { ok: true, text: count ? `Saved ${count} override${count === 1 ? '' : 's'}.` : 'Saved — no rows differ from the defaults.' }
      : { ok: false, text: 'Could not save overrides.' });
  }

  async function resetAll() {
    if (!confirm('Discard every override and restore the curated default rates?')) return;
    const res = await fetch('/api/admin/balance-rates', { method: 'DELETE' });
    if (res.ok && defaults) {
      setMerged(JSON.parse(JSON.stringify(defaults)));
      setMsg({ ok: true, text: 'Restored the curated defaults.' });
    }
  }

  function addActivity() {
    const key = newName.trim().toLowerCase();
    if (!key || merged!.activities[key]) return;
    setActivity(key, { killSeconds: [60, 90, 150], floor: 'anyone' });
    setNewName('');
    setSearch(key);
  }

  const q = search.trim().toLowerCase();
  const activityRows = Object.keys(merged.activities)
    .filter((k) => !q || k.includes(q))
    .sort();
  const skillRows = Object.keys(merged.skills).filter((k) => !q || k.includes(q));

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted leading-relaxed">
        The effort model behind <span className="text-gold">Board balance</span>. Every rate is a{' '}
        <span className="text-foreground/80">fast / average / slow</span> player triplet; the floor marks who can
        realistically do the content at all. Edited rows are stored as overrides — untouched rows keep tracking the
        bundled defaults.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {(['activities', 'skills'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              tab === t ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            {t === 'activities' ? `Bosses & activities (${Object.keys(merged.activities).length})` : `Skills (${Object.keys(merged.skills).length})`}
          </button>
        ))}
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter…"
          className="w-44 px-2.5 py-1.5 text-xs"
        />
      </div>

      <div className="max-h-96 overflow-y-auto border border-card-border/60 rounded-lg divide-y divide-card-border/40">
        {tab === 'activities' &&
          activityRows.map((key) => {
            const a = merged.activities[key];
            const mod = isModified('activities', key);
            const attemptModel = !!(a.attemptMinutes && a.successRate);
            return (
              <div key={key} className="px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
                <span className={`w-48 shrink-0 truncate ${mod ? 'text-gold' : 'text-foreground'}`} title={key}>
                  {key}{mod ? ' •' : ''}
                </span>
                <span className="text-[10px] text-text-muted w-24 shrink-0">
                  {attemptModel ? 'attempt min' : 'kill seconds'}
                </span>
                {attemptModel ? (
                  <>
                    <TripletInputs value={a.attemptMinutes!} onChange={(t) => setActivity(key, { attemptMinutes: t })} />
                    <span className="text-[10px] text-text-muted">success %</span>
                    <TripletInputs value={a.successRate!} onChange={(t) => setActivity(key, { successRate: t })} scale={100} />
                  </>
                ) : (
                  <TripletInputs value={a.killSeconds ?? [60, 90, 150]} onChange={(t) => setActivity(key, { killSeconds: t })} />
                )}
                <Select
                  className="w-28"
                  ariaLabel={`Floor for ${key}`}
                  value={a.floor ?? 'anyone'}
                  onChange={(v) => setActivity(key, { floor: v as Floor })}
                  options={FLOOR_OPTIONS}
                />
                {mod && (
                  <button onClick={() => resetRow('activities', key)} className="text-[10px] text-text-muted hover:text-foreground">
                    reset
                  </button>
                )}
              </div>
            );
          })}
        {tab === 'skills' &&
          skillRows.map((key) => {
            const s = merged.skills[key];
            const mod = isModified('skills', key);
            return (
              <div key={key} className="px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
                <span className={`w-48 shrink-0 truncate ${mod ? 'text-gold' : 'text-foreground'}`}>{key}{mod ? ' •' : ''}</span>
                <span className="text-[10px] text-text-muted w-24 shrink-0">XP / hour</span>
                <TripletInputs value={s.xpPerHour} onChange={(t) => setSkill(key, { xpPerHour: t })} />
                {mod && (
                  <button onClick={() => resetRow('skills', key)} className="text-[10px] text-text-muted hover:text-foreground">
                    reset
                  </button>
                )}
              </div>
            );
          })}
        {((tab === 'activities' && activityRows.length === 0) || (tab === 'skills' && skillRows.length === 0)) && (
          <p className="px-3 py-4 text-xs text-text-muted">No rows match the filter.</p>
        )}
      </div>

      {tab === 'activities' && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addActivity()}
            placeholder="Add an activity (exact boss/source name)…"
            className="w-72 px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={addActivity}
            className="text-xs px-3 py-1.5 rounded-lg border border-gold/30 text-gold hover:bg-gold/15 transition-colors"
          >
            Add
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save overrides'}
        </button>
        <button
          onClick={resetAll}
          className="text-xs px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
        >
          Restore defaults
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-accent-green-light' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
