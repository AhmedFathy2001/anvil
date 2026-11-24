'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import DialogFrame from '@/components/DialogFrame';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { GUIDE_ACCOUNTS } from '@/lib/guideSetups';
import { goalLabel, parseRouteBlock, type Goal, type RouteBlock, type RouteStep } from '@/lib/guideRoutes';

const KINDS: { value: Goal['kind']; label: string; tick: string }[] = [
  { value: 'level', label: 'Level', tick: 'Auto-ticks from hiscores' },
  { value: 'quest', label: 'Quest', tick: 'Auto-ticks from the plugin (quest state) · we name it, Quest Helper does the walkthrough' },
  { value: 'item', label: 'Item', tick: 'Auto-ticks from the plugin (bank, inventory, worn) or the collection log' },
  { value: 'diary', label: 'Diary', tick: 'Auto-ticks from the plugin (diary state)' },
  { value: 'clog', label: 'Clog slot', tick: 'Auto-ticks from the collection log' },
  { value: 'ca', label: 'Combat Achievement', tick: 'Auto-ticks from the plugin (Combat Achievements)' },
  { value: 'kc', label: 'Boss kc', tick: 'Auto-ticks from hiscores' },
  { value: 'manual', label: 'Manual', tick: 'Manual: the player ticks it' },
];
const DIARY_TIERS = ['easy', 'medium', 'hard', 'elite'] as const;

const blankGoal = (kind: Goal['kind']): Goal =>
  kind === 'level' ? { kind, skill: 'agility', level: 50 } : kind === 'quest' || kind === 'ca' ? { kind, name: '' } : kind === 'item' || kind === 'clog' ? { kind, id: 0 } : kind === 'diary' ? { kind, region: 'ardougne', tier: 'easy' } : kind === 'kc' ? { kind, boss: 'vorkath', count: 50 } : { kind: 'manual' };

let seq = 0;
const newId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

/** The goal's own fields, by kind. */
function GoalFields({ goal, onChange }: { goal: Goal; onChange: (g: Goal) => void }) {
  switch (goal.kind) {
    case 'level':
      return (
        <span className="flex gap-1.5">
          <Input value={goal.skill} onChange={(e) => onChange({ ...goal, skill: e.target.value.toLowerCase().slice(0, 12) })} placeholder="skill" className="h-8 w-28 text-xs" />
          <Input inputMode="numeric" value={goal.level} onChange={(e) => onChange({ ...goal, level: Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)) })} className="h-8 w-14 text-xs" />
        </span>
      );
    case 'quest':
    case 'ca':
      return <Input value={goal.name} onChange={(e) => onChange({ ...goal, name: e.target.value.slice(0, 80) })} placeholder={goal.kind === 'quest' ? 'Quest name' : 'Task name'} className="h-8 text-xs" />;
    case 'item':
    case 'clog':
      return (
        <span className="flex gap-1.5">
          <Input inputMode="numeric" value={goal.id || ''} onChange={(e) => onChange({ ...goal, id: Math.max(0, parseInt(e.target.value, 10) || 0) })} placeholder="item id" className="h-8 w-24 text-xs" />
          <Input value={goal.name ?? ''} onChange={(e) => onChange({ ...goal, name: e.target.value.slice(0, 60) })} placeholder="name" className="h-8 text-xs" />
        </span>
      );
    case 'diary':
      return (
        <span className="flex gap-1.5">
          <Input value={goal.region} onChange={(e) => onChange({ ...goal, region: e.target.value.toLowerCase().slice(0, 30) })} placeholder="region" className="h-8 w-28 text-xs" />
          <Select value={goal.tier} onChange={(v) => onChange({ ...goal, tier: v as (typeof DIARY_TIERS)[number] })} options={DIARY_TIERS.map((t) => ({ value: t, label: t }))} ariaLabel="Diary tier" className="w-28" />
        </span>
      );
    case 'kc':
      return (
        <span className="flex gap-1.5">
          <Input value={goal.boss} onChange={(e) => onChange({ ...goal, boss: e.target.value.slice(0, 40) })} placeholder="boss key" className="h-8 w-28 text-xs" />
          <Input inputMode="numeric" value={goal.count} onChange={(e) => onChange({ ...goal, count: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="h-8 w-20 text-xs" />
        </span>
      );
    default:
      return null;
  }
}

/**
 * Build a progression route: chapters of goal steps, each with one line on why, requirement chips,
 * and forks per account type (skip it, or a different line). Writes one route block into the guide.
 */
export default function RouteBuilder({ initial, onSave, onClose }: { initial: string | null; onSave: (json: string) => void; onClose: () => void }) {
  const [route, setRoute] = useState<RouteBlock>(() => (initial ? parseRouteBlock(initial) : null) ?? { chapters: [{ name: 'Early game', steps: [] }] });
  const [drag, setDrag] = useState<{ c: number; s: number } | null>(null);
  const setChapter = (ci: number, f: (steps: RouteStep[]) => RouteStep[], name?: string) =>
    setRoute((r) => ({ ...r, chapters: r.chapters.map((c, i) => (i === ci ? { name: name ?? c.name, steps: f(c.steps) } : c)) }));
  const setStep = (ci: number, si: number, patch: Partial<RouteStep>) => setChapter(ci, (steps) => steps.map((s, j) => (j === si ? { ...s, ...patch } : s)));
  const total = route.chapters.reduce((a, c) => a + c.steps.length, 0);
  let n = 0;
  return (
    <DialogFrame dirty onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" panelClassName="w-full max-w-4xl rounded-xl border border-card-border bg-card-bg p-4" ariaLabel="Progression route">
      {(close) => (
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-lg font-bold text-gold">🧭 Progression route</h2>
            <span className="text-xs text-text-muted">
              {total} steps in {route.chapters.length} chapters
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#6b5326] bg-[#2a2114] p-2 text-xs">
            <strong>Auto-ticks from:</strong> Level → hiscores · Quest, Diary, Combat Achievement → plugin · Item → plugin (bank, worn) · Clog slot → collection log · Manual → the player ticks it
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-text-muted">Route for</span>
            {GUIDE_ACCOUNTS.map((a) => {
              const on = (route.accounts ?? []).includes(a.key);
              return (
                <button key={a.key} type="button" aria-pressed={on} onClick={() => setRoute((r) => ({ ...r, accounts: on ? (r.accounts ?? []).filter((x) => x !== a.key) : [...(r.accounts ?? []), a.key] }))} className={`h-7 rounded-full border px-2.5 ${on ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted'}`}>
                  {a.label}
                </button>
              );
            })}
          </div>
          {route.chapters.map((ch, ci) => (
            <section key={ci} className="overflow-hidden rounded-xl border border-card-border">
              <div className="flex items-center gap-2 border-b border-card-border bg-black/20 px-3 py-2">
                <Input value={ch.name} onChange={(e) => setChapter(ci, (s) => s, e.target.value.slice(0, 60))} className="h-9 font-bold" aria-label="Chapter name" />
                <button type="button" onClick={() => setRoute((r) => ({ ...r, chapters: r.chapters.filter((_, i) => i !== ci) }))} className="text-xs text-red-300" aria-label="Remove chapter">
                  Remove
                </button>
              </div>
              {ch.steps.map((s, si) => {
                n++;
                const kind = KINDS.find((k) => k.value === s.goal.kind);
                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDrag({ c: ci, s: si })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!drag) return;
                      setRoute((r) => {
                        const chapters = r.chapters.map((c) => ({ ...c, steps: [...c.steps] }));
                        const [moved] = chapters[drag.c].steps.splice(drag.s, 1);
                        chapters[ci].steps.splice(si, 0, moved);
                        return { ...r, chapters };
                      });
                      setDrag(null);
                    }}
                    className="space-y-2 border-b border-card-border p-3 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cursor-grab text-[#6b5c45]" title="Drag to reorder" aria-hidden>
                        ⋮⋮
                      </span>
                      <span className="w-6 text-xs text-text-muted">{n}</span>
                      <Select value={s.goal.kind} onChange={(v) => setStep(ci, si, { goal: blankGoal(v as Goal['kind']) })} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} ariaLabel="Step kind" className="w-44" />
                      <GoalFields goal={s.goal} onChange={(goal) => setStep(ci, si, { goal })} />
                      <button type="button" onClick={() => setChapter(ci, (steps) => steps.filter((_, j) => j !== si))} className="ml-auto h-8 w-8 rounded border border-card-border text-text-muted" aria-label="Delete step">
                        ×
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={s.title} onChange={(e) => setStep(ci, si, { title: e.target.value.slice(0, 80) })} placeholder="What to get, e.g. Ava's accumulator" className="h-9 text-xs" />
                      <Input value={s.why ?? ''} onChange={(e) => setStep(ci, si, { why: e.target.value.slice(0, 200) })} placeholder="Why it matters, in one line" className="h-9 text-xs" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-text-muted">Requires</span>
                      {(s.reqs ?? []).map((r, ri) => (
                        <span key={ri} className="flex items-center gap-1 rounded-full border border-[#6b5326] px-2 py-0.5">
                          {goalLabel(r)}
                          <button type="button" onClick={() => setStep(ci, si, { reqs: (s.reqs ?? []).filter((_, j) => j !== ri) })} aria-label="Remove requirement" className="text-text-muted">
                            ×
                          </button>
                        </span>
                      ))}
                      <ReqAdder onAdd={(g) => setStep(ci, si, { reqs: [...(s.reqs ?? []), g].slice(0, 8) })} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-text-muted">Forks</span>
                      {GUIDE_ACCOUNTS.filter((a) => a.key !== 'main').map((a) => {
                        const f = s.forks?.[a.key];
                        return (
                          <span key={a.key} className="flex items-center gap-1 rounded-lg border border-dashed border-card-border px-1.5 py-0.5">
                            <Checkbox checked={!!f?.skip} onChange={(v) => setStep(ci, si, { forks: { ...s.forks, [a.key]: { ...f, skip: v || undefined } } })} label={`Skip for ${a.label}`} labelClassName="text-xs" />
                            <Input value={f?.alt ?? ''} onChange={(e) => setStep(ci, si, { forks: { ...s.forks, [a.key]: { ...f, alt: e.target.value.slice(0, 160) || undefined } } })} placeholder={`${a.label} line`} className="h-7 w-36 px-1.5 py-0 text-[11px]" />
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-text-muted">{kind?.tick}</p>
                  </div>
                );
              })}
              <button type="button" onClick={() => setChapter(ci, (steps) => [...steps, { id: newId(), title: '', goal: { kind: 'manual' } }])} className="w-full px-3 py-3 text-left text-xs font-semibold text-gold hover:bg-white/5">
                + Add step to {ch.name}
              </button>
            </section>
          ))}
          <button type="button" onClick={() => setRoute((r) => ({ ...r, chapters: [...r.chapters, { name: 'New chapter', steps: [] }] }))} className="w-full rounded-xl border border-dashed border-card-border py-3 text-sm text-text-muted">
            + Add chapter
          </button>
          <div className="flex justify-end gap-2 border-t border-card-border pt-3">
            <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-text-muted">
              Cancel
            </button>
            <button type="button" onClick={() => onSave(JSON.stringify(parseRouteBlock(JSON.stringify(route)) ?? route))} className="rounded-lg bg-gold px-4 py-1.5 font-semibold text-brown-dark">
              {initial ? 'Update route' : 'Insert into guide'}
            </button>
          </div>
        </div>
      )}
    </DialogFrame>
  );
}

function ReqAdder({ onAdd }: { onAdd: (g: Goal) => void }) {
  const [kind, setKind] = useState<'level' | 'quest' | ''>('');
  const [goal, setGoal] = useState<Goal | null>(null);
  if (!kind)
    return (
      <span className="flex gap-1">
        <button type="button" onClick={() => { setKind('level'); setGoal(blankGoal('level')); }} className="rounded-full border border-dashed border-card-border px-2 py-0.5 text-text-muted">
          + Level
        </button>
        <button type="button" onClick={() => { setKind('quest'); setGoal(blankGoal('quest')); }} className="rounded-full border border-dashed border-card-border px-2 py-0.5 text-text-muted">
          + Quest
        </button>
      </span>
    );
  return (
    <span className="flex items-center gap-1">
      {goal && <GoalFields goal={goal} onChange={setGoal} />}
      <button type="button" onClick={() => { if (goal) onAdd(goal); setKind(''); setGoal(null); }} className="rounded border border-gold/50 px-2 py-0.5 text-gold">
        Add
      </button>
    </span>
  );
}
