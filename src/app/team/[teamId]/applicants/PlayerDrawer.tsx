'use client';

import { useEffect, useState } from 'react';
import { BOSSES, SKILL_LABELS } from '@/lib/constants';
import { formatHoursRange } from '@/lib/signup';
import type { WarRoomPerson } from '@/lib/warRoom';

// Everything known about one person, over the pool rather than instead of it — a captain reading
// about someone is still choosing between them and four others, so this is a drawer, not a modal.
//
// Order is deliberate: their own answers first (the thing a captain can't get anywhere else), then
// their public hiscores facts. No rating, tier or history is shown to a captain — member privacy,
// even from their own clan admins — so the choice rests on what the player said and what's public.

export const DOMAIN_LABEL: Record<string, string> = {
  raids: 'Raids',
  'endgame-pvm': 'Endgame',
  'midgame-pvm': 'Midgame',
  'wildy-pvp': 'Wildy',
};

const BOSS_LABEL: Record<string, string> = Object.fromEntries(BOSSES.map((b) => [b.key, b.label]));

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="text-text-muted">{k}</span>
      <span className="ml-auto font-mono tabular-nums text-right">{v}</span>
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-bold mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

interface DrawerProps {
  person: WarRoomPerson | null;
  onClose: () => void;
  onToggleShortlist: (personKey: string) => void;
  onNote: (personKey: string, note: string) => void;
  /** Only true while this captain is on the clock. */
  canPick?: boolean;
  onPick?: (person: WarRoomPerson) => void;
}

export default function PlayerDrawer({ person, onClose, ...rest }: DrawerProps) {
  // Escape closes, like every other overlay in the app.
  useEffect(() => {
    if (!person) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [person, onClose]);

  if (!person) return null;
  // Keyed on the person so the note box resets to theirs when you open someone else — state that
  // belongs to a subject, reset by remounting rather than by an effect that chases the prop.
  return <DrawerBody key={person.personKey} person={person} onClose={onClose} {...rest} />;
}

function DrawerBody({
  person,
  onClose,
  onToggleShortlist,
  onNote,
  canPick,
  onPick,
}: DrawerProps & { person: WarRoomPerson }) {
  const [note, setNote] = useState(person.shortlistNote ?? '');
  const answers = person.answers;
  const taken = person.teamId != null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[430px] bg-card-bg border-l border-card-border flex flex-col"
        aria-label={`${person.rsn} detail`}
      >
        <div className="p-4 border-b border-card-border">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-xl font-bold tracking-tight truncate">{person.rsn}</h3>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-text-muted hover:text-foreground text-xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <div className="flex items-center gap-2.5 mt-2 flex-wrap text-sm">
            <span className="text-xs text-text-muted">
              {taken ? `taken by ${person.teamName}` : 'in the pool'}
            </span>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {canPick && !taken && (
              <button
                type="button"
                onClick={() => onPick?.(person)}
                className="px-3 py-1.5 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors"
              >
                Pick
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleShortlist(person.personKey)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                person.shortlistAt != null
                  ? 'border-gold/40 text-gold-light bg-gold/10'
                  : 'border-card-border hover:border-gold/40'
              }`}
            >
              {person.shortlistAt != null ? `★ Shortlisted · ${person.shortlistAt + 1}` : '☆ Shortlist'}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 pb-8 grid gap-5">
          <Section title="Their sign-up answers">
            {answers ? (
              <div className="grid gap-2">
                {formatHoursRange(answers.activeDailyHours) && (
                  <Row k="Active hours" v={`${formatHoursRange(answers.activeDailyHours)} / day`} />
                )}
                {formatHoursRange(answers.activeWeeklyHours) && (
                  <Row k="Active weekly" v={`${formatHoursRange(answers.activeWeeklyHours)} / week`} />
                )}
                {formatHoursRange(answers.afkDailyHours) && (
                  <Row k="AFK hours" v={`${formatHoursRange(answers.afkDailyHours)} / day`} />
                )}
                {answers.timezone && <Row k="Timezone" v={answers.timezone} />}
                {answers.bosses && answers.bosses.length > 0 && (
                  <div className="mt-1">
                    <div className="text-xs text-text-muted mb-1.5">Bosses they run</div>
                    <div className="flex flex-wrap gap-1.5">
                      {answers.bosses.map((b) => (
                        <span key={b} className="text-[11px] px-2 py-0.5 rounded-full bg-brown-light border border-card-border">
                          {BOSS_LABEL[b] ?? b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {answers.skills && answers.skills.length > 0 && (
                  <div className="mt-1">
                    <div className="text-xs text-text-muted mb-1.5">Skills they train</div>
                    <div className="flex flex-wrap gap-1.5">
                      {answers.skills.map((s) => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-brown-light border border-card-border">
                          {SKILL_LABELS[s] ?? s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {answers.notes && (
                  <div className="mt-1">
                    <div className="text-xs text-text-muted mb-1.5">Their note</div>
                    <p className="border-l-2 border-gold-dark pl-3 text-sm italic">{answers.notes}</p>
                  </div>
                )}
                <p className="text-[11px] text-text-muted mt-1">
                  Frozen when they signed up — editing a sign-up later doesn&rsquo;t rewrite what you drafted on.
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                No sign-up answers — they were added to the pool directly rather than signing up.
              </p>
            )}
          </Section>

          <Section title="Boss kill counts">
            {person.markers.length > 0 ? (
              <div className="grid gap-1.5">
                {person.markers.map((m) => (
                  <div
                    key={m.key}
                    className="flex items-center gap-2 text-[12.5px] border border-card-border rounded-lg px-2.5 py-1.5 bg-brown-dark/40"
                  >
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brown-light border border-card-border text-text-muted">
                      {DOMAIN_LABEL[m.domain] ?? m.domain}
                    </span>
                    <span className="truncate">{m.label}</span>
                    <span className="ml-auto font-mono text-[11.5px] text-text-muted">{m.kc.toLocaleString()} kc</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No marker bosses on the hiscores yet.</p>
            )}
          </Section>

          <Section
            title={
              <>
                Your note <span className="normal-case tracking-normal text-text-muted font-normal">— private to you</span>
              </>
            }
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => onNote(person.personKey, note)}
              maxLength={500}
              placeholder="e.g. take before pick 22, wants raids"
              className="w-full min-h-[62px] resize-y text-sm bg-brown-dark border border-card-border rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Saved on your shortlist. {person.shortlistAt == null && 'Adding a note shortlists them.'}
            </p>
          </Section>
        </div>
      </aside>
    </>
  );
}
