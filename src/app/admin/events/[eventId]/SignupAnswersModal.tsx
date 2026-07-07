'use client';

import { useMemo, useState } from 'react';
import { BOSSES, SKILLS, SKILL_LABELS, SKILL_ALIASES } from '@/lib/constants';
import type { SignupProfile, HoursRange } from '@/lib/signup';
import { TIMEZONE_OPTIONS } from '@/lib/signup';
import ClanMemberPicker, { type PickableMember } from '@/components/ClanMemberPicker';
import Select from '@/components/Select';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';

// Admin modal for writing sign-up answers on a member's behalf. Two modes:
//   add  → pick a clan member (must have a linked Discord user — sign-ups hang off the
//          users row), fill answers, submit. Created straight as 'approved'.
//   edit → answers form only, prefilled from the existing sign-up.
// The self-serve form (events/[eventId]/signup/SignupForm) stays the canonical UX; this
// is the compact staff version of the same fields.

interface EditTarget {
  id: number;
  displayName: string;
  rsn: string;
  profile: SignupProfile;
}

interface Props {
  eventId: number;
  // null = add mode; a target = edit that sign-up's answers.
  editTarget: EditTarget | null;
  // User ids with an active (non-withdrawn) sign-up, to flag duplicates before submit.
  signedUpUserIds: number[];
  onClose: () => void;
  onSaved: () => void;
}

// Read one bound of an HoursRange as a form string ('' when absent).
function hoursBound(range: HoursRange | undefined, bound: 'min' | 'max'): string {
  const v = range?.[bound];
  return v === undefined ? '' : String(v);
}

// Build an HoursRange from two form strings, or undefined when both are blank.
// The server sanitizer clamps and normalizes, so we just collect what was typed.
function rangeFromInputs(min: string, max: string): HoursRange | undefined {
  const lo = min === '' ? undefined : Number(min);
  const hi = max === '' ? undefined : Number(max);
  const out: HoursRange = {};
  if (lo !== undefined && Number.isFinite(lo)) out.min = lo;
  if (hi !== undefined && Number.isFinite(hi)) out.max = hi;
  return out.min === undefined && out.max === undefined ? undefined : out;
}

// A labelled min–max number-input pair.
function RangeRow({
  label,
  min,
  max,
  onMin,
  onMax,
  maxVal,
  step,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  maxVal: number;
  step: number;
}) {
  const inputCls =
    'w-full px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60';
  return (
    <div className="block">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5 mt-1">
        <Input
          type="number"
          min={0}
          max={maxVal}
          step={step}
          value={min}
          onChange={(e) => onMin(e.target.value)}
          placeholder="min"
          aria-label={`${label} minimum`}
          className={inputCls}
        />
        <span className="text-text-muted text-xs">–</span>
        <Input
          type="number"
          min={0}
          max={maxVal}
          step={step}
          value={max}
          onChange={(e) => onMax(e.target.value)}
          placeholder="max"
          aria-label={`${label} maximum`}
          className={inputCls}
        />
      </div>
    </div>
  );
}

export default function SignupAnswersModal({
  eventId,
  editTarget,
  signedUpUserIds,
  onClose,
  onSaved,
}: Props) {
  const initial = editTarget?.profile ?? {};
  const [memberId, setMemberId] = useState<number | null>(null);
  const [member, setMember] = useState<PickableMember | null>(null);
  const [activeDailyMin, setActiveDailyMin] = useState(hoursBound(initial.activeDailyHours, 'min'));
  const [activeDailyMax, setActiveDailyMax] = useState(hoursBound(initial.activeDailyHours, 'max'));
  const [activeWeeklyMin, setActiveWeeklyMin] = useState(hoursBound(initial.activeWeeklyHours, 'min'));
  const [activeWeeklyMax, setActiveWeeklyMax] = useState(hoursBound(initial.activeWeeklyHours, 'max'));
  const [afkDailyMin, setAfkDailyMin] = useState(hoursBound(initial.afkDailyHours, 'min'));
  const [afkDailyMax, setAfkDailyMax] = useState(hoursBound(initial.afkDailyHours, 'max'));
  const [afkWeeklyMin, setAfkWeeklyMin] = useState(hoursBound(initial.afkWeeklyHours, 'min'));
  const [afkWeeklyMax, setAfkWeeklyMax] = useState(hoursBound(initial.afkWeeklyHours, 'max'));
  const [timezone, setTimezone] = useState(initial.timezone ?? '');
  const [bosses, setBosses] = useState<Set<string>>(new Set(initial.bosses ?? []));
  const [skills, setSkills] = useState<Set<string>>(new Set(initial.skills ?? []));
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [bossFilter, setBossFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editTarget !== null;
  // Picked member's user already has an active sign-up — the server would 409; flag it
  // up-front so the admin reaches for "Edit answers" on the existing row instead.
  const duplicateUser =
    !isEdit && member?.user != null && signedUpUserIds.includes(member.user.id);

  const filteredBosses = useMemo(() => {
    if (!bossFilter.trim()) return BOSSES;
    const q = bossFilter.trim().toLowerCase();
    return BOSSES.filter(
      (b) => b.label.toLowerCase().includes(q) || b.aliases?.some((a) => a.includes(q)),
    );
  }, [bossFilter]);

  const filteredSkills = useMemo(() => {
    const all = SKILLS.filter((s) => s !== 'overall');
    if (!skillFilter.trim()) return all;
    const q = skillFilter.trim().toLowerCase();
    return all.filter(
      (s) => (SKILL_LABELS[s] ?? s).toLowerCase().includes(q) || SKILL_ALIASES[s]?.some((a) => a.includes(q)),
    );
  }, [skillFilter]);

  function toggle(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !memberId) {
      setError('Pick the member to sign up.');
      return;
    }
    setSubmitting(true);
    try {
      const profile: SignupProfile = {
        activeDailyHours: rangeFromInputs(activeDailyMin, activeDailyMax),
        activeWeeklyHours: rangeFromInputs(activeWeeklyMin, activeWeeklyMax),
        afkDailyHours: rangeFromInputs(afkDailyMin, afkDailyMax),
        afkWeeklyHours: rangeFromInputs(afkWeeklyMin, afkWeeklyMax),
        timezone: timezone || undefined,
        bosses: Array.from(bosses),
        skills: Array.from(skills),
        notes: notes.trim() || undefined,
      };

      const res = isEdit
        ? await fetch(`/api/admin/events/${eventId}/signups/${editTarget.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'edit-answers', profile }),
          })
        : await fetch(`/api/admin/events/${eventId}/signups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clanMemberId: memberId, profile }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-card-border rounded-xl bg-card-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            {isEdit ? `Edit answers · ${editTarget.displayName} (${editTarget.rsn})` : 'Add member sign-up'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-foreground text-xl leading-none px-1"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                Sign a member up on their behalf and fill in their answers — for the folks
                who told you everything on Discord but won&apos;t touch the site. Skips the
                sign-up window and goes straight to <span className="text-accent-green-light">approved</span>.
                Members without a Discord login can&apos;t be added — sign-ups are tied to
                their site account.
              </p>
              <ClanMemberPicker
                mode="single"
                eventId={eventId}
                value={memberId}
                onChange={(id, m) => {
                  setMemberId(id);
                  setMember(m);
                }}
                requireDiscordUser
                requireDiscordUserHint="No Discord login linked — sign-ups attach to the member's site account, so they need to log in once first"
                preferLinked
              />
              {duplicateUser && (
                <p className="text-xs text-yellow-300 border border-yellow-500/30 bg-yellow-500/10 rounded p-2">
                  This member&apos;s user already has an active sign-up in this event — close
                  this and use &quot;Edit answers&quot; on their row instead.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Active hours</div>
            <div className="grid grid-cols-2 gap-3">
              <RangeRow label="Per day" min={activeDailyMin} max={activeDailyMax} onMin={setActiveDailyMin} onMax={setActiveDailyMax} maxVal={24} step={0.5} />
              <RangeRow label="Per week" min={activeWeeklyMin} max={activeWeeklyMax} onMin={setActiveWeeklyMin} onMax={setActiveWeeklyMax} maxVal={168} step={1} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">AFK hours</div>
            <div className="grid grid-cols-2 gap-3">
              <RangeRow label="Per day" min={afkDailyMin} max={afkDailyMax} onMin={setAfkDailyMin} onMax={setAfkDailyMax} maxVal={24} step={0.5} />
              <RangeRow label="Per week" min={afkWeeklyMin} max={afkWeeklyMax} onMin={setAfkWeeklyMin} onMax={setAfkWeeklyMax} maxVal={168} step={1} />
            </div>
          </div>

          <label className="block">
            <span className="text-xs text-text-muted">Timezone (optional)</span>
            <div className="mt-1">
              <Select
                value={timezone}
                onChange={setTimezone}
                ariaLabel="Timezone"
                options={[{ value: '', label: '— Not specified —' }, ...TIMEZONE_OPTIONS]}
              />
            </div>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                Bosses they regularly do
              </div>
              {bosses.size > 0 && (
                <span className="text-xs text-text-muted">{bosses.size} selected</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="search"
                placeholder="Filter…"
                value={bossFilter}
                onChange={(e) => setBossFilter(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
              />
              <button
                type="button"
                onClick={() => setBosses(new Set([...bosses, ...filteredBosses.map((b) => b.key)]))}
                className="text-xs px-2 py-1 rounded border border-card-border hover:border-gold/40 transition-colors"
              >
                {bossFilter.trim() ? 'Select shown' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={() => setBosses(new Set())}
                disabled={bosses.size === 0}
                className="text-xs px-2 py-1 rounded border border-card-border hover:border-gold/40 transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredBosses.map((b) => {
                const checked = bosses.has(b.key);
                return (
                  <label
                    key={b.key}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                      checked ? 'bg-gold/15 text-gold' : 'hover:bg-brown-dark'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(bosses, b.key, setBosses)}
                      className="accent-gold"
                    />
                    <span className="truncate">{b.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                Skills they regularly train
              </div>
              {skills.size > 0 && (
                <span className="text-xs text-text-muted">{skills.size} selected</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="search"
                placeholder="Filter…"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
              />
              <button
                type="button"
                onClick={() => setSkills(new Set([...skills, ...filteredSkills]))}
                className="text-xs px-2 py-1 rounded border border-card-border hover:border-gold/40 transition-colors"
              >
                {skillFilter.trim() ? 'Select shown' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={() => setSkills(new Set())}
                disabled={skills.size === 0}
                className="text-xs px-2 py-1 rounded border border-card-border hover:border-gold/40 transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredSkills.map((s) => {
                const checked = skills.has(s);
                return (
                  <label
                    key={s}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                      checked ? 'bg-gold/15 text-gold' : 'hover:bg-brown-dark'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(skills, s, setSkills)}
                      className="accent-gold"
                    />
                    <span>{SKILL_LABELS[s] ?? s}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-xs text-text-muted">Notes for captains (optional)</span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Preferred role, availability quirks, etc."
              className="w-full mt-1 px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
            />
          </label>

          {error && (
            <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || duplicateUser || (!isEdit && !memberId)}
              className="text-sm font-medium bg-accent-green/20 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/30 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving…' : isEdit ? 'Save answers' : 'Add sign-up'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-text-muted hover:text-foreground px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
