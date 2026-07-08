import { BOSSES, SKILL_LABELS } from '@/lib/constants';
import { formatHoursRange, type SignupProfile } from '@/lib/signup';

// Read-only render of a player's frozen sign-up answers — the same shape captains see on
// the Applicants page, reused inline on the draft-setup pool and the live draft board so
// they can read hours/bosses/skills/notes right where they're picking.

const BOSS_LABEL: Record<string, string> = Object.fromEntries(
  BOSSES.map((b) => [b.key, b.label]),
);

// Whether there's anything worth expanding to. Timezone is excluded — it already shows as
// an inline badge on the draft rows, so a tz-only sign-up shouldn't offer an empty expand.
export function hasProfileDetail(profile: SignupProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.activeDailyHours ||
      profile.activeWeeklyHours ||
      profile.afkDailyHours ||
      profile.afkWeeklyHours ||
      (profile.bosses && profile.bosses.length > 0) ||
      (profile.skills && profile.skills.length > 0) ||
      profile.notes,
  );
}

export default function PlayerProfileDetail({ profile }: { profile: SignupProfile }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <Stat label="Active /day" value={formatHoursRange(profile.activeDailyHours)} />
        <Stat label="Active /week" value={formatHoursRange(profile.activeWeeklyHours)} />
        <Stat label="AFK /day" value={formatHoursRange(profile.afkDailyHours)} />
        <Stat label="AFK /week" value={formatHoursRange(profile.afkWeeklyHours)} />
        <Stat label="Timezone" value={profile.timezone} />
      </div>

      {profile.bosses && profile.bosses.length > 0 && (
        <ChipList label="Bosses" items={profile.bosses.map((k) => BOSS_LABEL[k] ?? k)} />
      )}
      {profile.skills && profile.skills.length > 0 && (
        <ChipList label="Skills" items={profile.skills.map((k) => SKILL_LABELS[k] ?? k)} />
      )}
      {profile.notes && (
        <div>
          <div className="text-xs text-text-muted mb-1">Notes</div>
          <p className="text-sm whitespace-pre-wrap text-foreground/90">{profile.notes}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <div className="text-text-muted uppercase tracking-wide">{label}</div>
      <div className={`mt-0.5 ${value ? 'text-gold font-medium' : 'text-text-muted'}`}>
        {value || '—'}
      </div>
    </div>
  );
}

function ChipList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span key={it} className="text-[11px] px-1.5 py-0.5 rounded bg-gold/10 text-gold">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
