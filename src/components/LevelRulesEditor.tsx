'use client';

import Checkbox from '@/components/Checkbox';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import { cn } from '@/lib/utils';
import { SKILL_XP_CHOICES_M, TOTAL_XP_GRAIN_M, type MilestoneRules } from '@/lib/levelRules';

// The level / XP milestone rule controls (lib/levelRules), shared by the clan's "Level milestones"
// card and a member's "Level posts on my webhooks". Controlled: the caller owns the value and saving.

type SkillPreset = 'off' | 'every5' | 'from90' | 'custom';

function presetOf(r: MilestoneRules): SkillPreset {
  if (r.skillStep === 0) return 'off';
  if (r.skillStep === 5 && r.skillFrom === 5) return 'every5';
  if (r.skillStep === 1 && r.skillFrom === 90) return 'from90';
  return 'custom';
}

const PRESET_OPTIONS = [
  { value: 'off', label: 'Off — 99s only' },
  { value: 'every5', label: 'Every 5 levels (like in-game)' },
  { value: 'from90', label: 'Every level from 90' },
  { value: 'custom', label: 'Custom…' },
];

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        {hint && <p className="text-[11.5px] text-text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const num = 'w-20 text-xs';

export default function LevelRulesEditor({
  value,
  onChange,
  disabled,
}: {
  value: MilestoneRules;
  onChange: (next: MilestoneRules) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<MilestoneRules>) => onChange({ ...value, ...patch });
  const preset = presetOf(value);

  function pickPreset(p: string) {
    if (p === 'off') set({ skillStep: 0 });
    else if (p === 'every5') set({ skillStep: 5, skillFrom: 5 });
    else if (p === 'from90') set({ skillStep: 1, skillFrom: 90 });
    // Custom keeps whatever is there, but a step of 0 would read back as "Off" — give it one.
    else set({ skillStep: value.skillStep || 10, skillFrom: value.skillFrom || 50 });
  }

  function toggleXp(m: number) {
    const has = value.skillXpM.includes(m);
    set({ skillXpM: (has ? value.skillXpM.filter((x) => x !== m) : [...value.skillXpM, m]).sort((a, b) => a - b) });
  }

  return (
    <div className="grid gap-5">
      <Checkbox
        checked={value.ninetyNines}
        onChange={(v) => set({ ninetyNines: v })}
        disabled={disabled}
        label="Post 99s"
        description="A skill reaching level 99."
      />

      <Row title="Skill levels" hint="Level-ups below 99 worth a post.">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={preset}
            onChange={pickPreset}
            options={PRESET_OPTIONS}
            disabled={disabled}
            ariaLabel="Skill level posts"
            className="w-60"
          />
          {preset === 'custom' && (
            <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-text-muted">
              every
              <NumberInput value={value.skillStep} onChange={(n) => set({ skillStep: n })} min={1} max={98} className={num} disabled={disabled} aria-label="Every N levels" />
              levels from level
              <NumberInput value={value.skillFrom} onChange={(n) => set({ skillFrom: n })} min={1} max={99} className={num} disabled={disabled} aria-label="Starting level" />
            </span>
          )}
        </div>
      </Row>

      <Row title="Total level" hint="Round total-level milestones. 0 turns them off.">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-text-muted">
          every
          <NumberInput value={value.totalStep} onChange={(n) => set({ totalStep: n })} min={0} max={2500} className={num} disabled={disabled} aria-label="Every N total levels" />
          from
          <NumberInput value={value.totalFrom} onChange={(n) => set({ totalFrom: n })} min={0} max={2500} className={num} disabled={disabled} aria-label="Starting total level" />
        </div>
        <Checkbox
          checked={value.maxTotal}
          onChange={(v) => set({ maxTotal: v })}
          disabled={disabled}
          label="Post maxing"
          labelClassName="text-xs"
        />
      </Row>

      <Row title="Total XP" hint={`Overall XP steps, in millions (multiples of ${TOTAL_XP_GRAIN_M}). 0 turns them off.`}>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-text-muted">
          every
          <NumberInput
            value={value.totalXpStepM}
            onChange={(n) => set({ totalXpStepM: n })}
            min={0}
            max={1000}
            step={TOTAL_XP_GRAIN_M}
            className={num}
            disabled={disabled}
            aria-label="Every N million total XP"
          />
          M
        </div>
      </Row>

      <Row title="Skill XP milestones" hint="XP in a single skill. None picked = off.">
        <div className="flex flex-wrap gap-1.5">
          {SKILL_XP_CHOICES_M.map((m) => {
            const on = value.skillXpM.includes(m);
            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => toggleXp(m)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors disabled:opacity-50',
                  on ? 'border-gold/60 bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground',
                )}
              >
                {m}M
              </button>
            );
          })}
        </div>
      </Row>
    </div>
  );
}
