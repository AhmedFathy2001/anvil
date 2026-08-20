'use client';

import { useState } from 'react';
import { SKILLS, SKILL_LABELS } from '@/lib/constants';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';

interface Props {
  /** Drive the dialog from outside (the Add tiles menu). Omit for self-managed. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in trigger button when something else opens it. */
  hideTrigger?: boolean;
  eventId: number;
  canGrow: boolean;
  pointsMode: boolean;
  onCreated: (summary: { created: number; ignored: number; label: string }) => void;
  onError: (text: string) => void;
}

// Accepts "2m", "500k", "1.5m", "750000" or "200,000" — the shorthand people actually type
// for XP goals. Returns whole XP or null when unparseable.
function parseXp(raw: string): number | null {
  const v = raw.trim().toLowerCase().replace(/,/g, '');
  const m = v.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (!m) return null;
  const mult = m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1;
  const n = Math.round(parseFloat(m[1]) * mult);
  return Number.isFinite(n) && n >= 1 && n <= 200_000_000 ? n : null;
}

// "2M" / "500K" / "1.5M" / "12,345" — compact form for tile labels.
function shortXp(n: number): string {
  if (n % 1_000_000 === 0) return `${n / 1_000_000}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n % 1_000 === 0) return `${n / 1_000}K`;
  return n.toLocaleString();
}

// "Generate skill tiles" — pick several skills, one XP goal, one point value, and append a
// stat-tracked tile per skill in a single go. Reopenable batch-after-batch (2M Cooking/RC/Sailing
// @ 400 pts, then 500K others @ 200 pts, …): after each Create the picks clear but the dialog
// stays open for the next round. Tiles are tagged "Skilling, <Skill>" so they land under both
// category filters.
export default function SkillTileGenerator({ open: controlledOpen, onOpenChange, hideTrigger, eventId, canGrow, pointsMode, onCreated, onError }: Props) {
  // Controlled when the parent passes `open` (the Add tiles menu drives it); self-managed
  // otherwise, so the component still works as a standalone button.
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInnerOpen(v));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [xpText, setXpText] = useState('');
  const [points, setPoints] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastBatch, setLastBatch] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setSelected(new Set());
    setXpText('');
    setPoints('');
    setLastBatch(null);
  }

  function toggle(skill: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  }

  async function create() {
    const goal = parseXp(xpText);
    if (goal == null) {
      onError('Enter an XP goal like 2m, 500k, or 750000.');
      return;
    }
    if (selected.size === 0) {
      onError('Pick at least one skill.');
      return;
    }
    const pts = pointsMode && points.trim() ? Math.max(0, parseInt(points, 10) || 0) : undefined;
    const skills = SKILLS.filter((s) => selected.has(s)); // canonical order
    const rows = skills.map((skill) => {
      const label = SKILL_LABELS[skill] ?? skill;
      return {
        label: `${shortXp(goal)} ${label} XP`,
        tileType: 'standard',
        trackedStat: skill,
        statType: 'skill',
        statGoal: goal,
        category: `Skilling, ${label}`,
        description: `Gain ${goal.toLocaleString()} ${label} XP during the event.`,
        ...(pts !== undefined ? { points: pts } : {}),
      };
    });
    setCreating(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, append: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || 'Could not create tiles.');
        return;
      }
      const summary = `${shortXp(goal)} XP × ${skills.length} skill${skills.length === 1 ? '' : 's'}${pts !== undefined ? ` @ ${pts} pts` : ''}`;
      onCreated({ created: data.created ?? 0, ignored: data.ignored ?? 0, label: summary });
      // Stay open for the next batch — clear the skill picks, keep goal/points as a starting point.
      setLastBatch(`Added ${summary}.`);
      setSelected(new Set());
    } finally {
      setCreating(false);
    }
  }

  const goalPreview = parseXp(xpText);

  return (
    <>
      {!hideTrigger && (
      <button
        onClick={() => setOpen(true)}
        disabled={!canGrow}
        title={
          canGrow
            ? 'Add an XP-goal tile for several skills at once (e.g. 2M XP in Cooking + Runecraft + Sailing)'
            : 'Available on Leagues / Tile-race boards before the event starts'
        }
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Generate skill tiles…
      </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={close}>
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl border border-card-border bg-card-bg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-1 h-5 bg-gold rounded-full" />
                Generate skill tiles
              </h3>
              <button onClick={close} className="text-text-muted hover:text-foreground text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-text-muted mb-3">
              One XP-goal tile per picked skill, tagged <span className="text-gold">Skilling</span> +
              the skill name. Create a batch, then keep going — the dialog stays open for the next
              goal/point combo.
            </p>

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-[10px] text-text-muted mb-1">XP goal</label>
                <Input
                  type="text"
                  value={xpText}
                  onChange={(e) => setXpText(e.target.value)}
                  placeholder="e.g. 2m or 500k"
                  aria-label="XP goal"
                />
              </div>
              {pointsMode && (
                <div className="w-28">
                  <label className="block text-[10px] text-text-muted mb-1">Points each</label>
                  <Input
                    type="number"
                    min={0}
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    placeholder="e.g. 400"
                    aria-label="Points per tile"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-text-muted">
                {selected.size} skill{selected.size === 1 ? '' : 's'} picked
                {goalPreview != null && selected.size > 0 && (
                  <span className="text-gold/80"> → {selected.size} × &ldquo;{shortXp(goalPreview)} … XP&rdquo; tiles</span>
                )}
              </span>
              <span className="flex gap-2 text-[10px]">
                <button onClick={() => setSelected(new Set(SKILLS))} className="text-gold/80 hover:text-gold">All</button>
                <button onClick={() => setSelected(new Set())} className="text-text-muted hover:text-foreground">None</button>
              </span>
            </div>
            <div className="overflow-y-auto border border-card-border/60 rounded-lg p-2 grid grid-cols-3 gap-0.5 mb-3">
              {SKILLS.map((skill) => (
                <label
                  key={skill}
                  className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <input type="checkbox" checked={selected.has(skill)} onChange={() => toggle(skill)} className="accent-gold" />
                  <span className={selected.has(skill) ? 'text-foreground' : 'text-text-muted'}>
                    {SKILL_LABELS[skill] ?? skill}
                  </span>
                </label>
              ))}
            </div>

            {lastBatch && <p className="text-xs text-accent-green-light mb-2">{lastBatch} Pick the next batch, or close.</p>}

            <div className="flex justify-end gap-2">
              <button onClick={close} className="text-xs px-3 py-1.5 rounded-lg text-text-muted hover:text-foreground transition-colors">
                Done
              </button>
              <button
                onClick={create}
                disabled={creating || selected.size === 0 || parseXp(xpText) == null}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating…' : `Create ${selected.size || ''} tile${selected.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
