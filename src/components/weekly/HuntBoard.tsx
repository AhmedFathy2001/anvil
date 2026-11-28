'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import DateTimePicker from '@/components/DateTimePicker';
import ImageUpload from '@/components/ImageUpload';
import Input from '@/components/Input';
import LocalTime from '@/components/LocalTime';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import Textarea from '@/components/Textarea';
import ThingIcon from '@/components/ThingIcon';
import { clanFetch } from '@/lib/clanFetch';
import { SKILLS, SKILL_LABELS } from '@/lib/constants';
import { bountyClaimWords, bountyLadderWords, dueWords, firstDoneWords, firstRuleWords, placeWords, rowProgressWords, type HuntRowProgress } from '@/lib/itemHunt';
import { formatGp } from '@/lib/adminEventsFormat';
import type { HuntView, HuntViewDrop, HuntViewRow } from '@/lib/itemHuntView';
import { itemIconUrl } from '@/lib/tileIcons';
import { EntrantTags } from './GameTags';
import { CountsOnChip } from './CompetitionHero';

/**
 * An item hunt's own page: who has the drop, when they got it and at what kill count, and how many
 * kills everyone else has put in without one. Not a board and not a week of XP: a list of drops.
 */

const MEDALS = ['🥇', '🥈', '🥉'];

function statGainWords(row: HuntViewRow, view: HuntView): string | null {
  if (row.rushWords) return row.rushWords;
  // A v2 hunt shows each row's own progress instead (ProgressChips).
  if (view.v2 || !view.statUnit) return null;
  if (row.statPending) return 'starting point not read yet';
  const n = (row.statGain ?? 0).toLocaleString();
  if (view.statUnit === 'kills') return `${n} ${row.statGain === 1 ? 'kill' : 'kills'}${row.count === 0 && (row.statGain ?? 0) > 0 ? ', no drop' : ''}`;
  return `${n} ${view.statLabel} XP gained`;
}

function DropLine({ drop, showItem }: { drop: HuntViewDrop; showItem: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
      {drop.score != null && (
        <span className={`font-mono font-bold tabular-nums ${drop.score > 0 ? 'text-emerald-400' : 'text-text-muted'}`} title={drop.score > 0 ? undefined : 'A repeat: only the first of each item scores'}>
          +{drop.score.toLocaleString()}
        </span>
      )}
      {showItem && (
        <span className="flex items-center gap-1.5 text-foreground/90">
          <ThingIcon src={drop.itemId != null ? itemIconUrl(drop.itemId) : null} alt="" size={18} />
          {drop.itemName}
          {drop.quantity > 1 && <span className="text-text-muted">×{drop.quantity.toLocaleString()}</span>}
        </span>
      )}
      <LocalTime date={drop.occurredAt} format="short" />
      {drop.source && <span>from {drop.source}</span>}
      {drop.stat && <span className="text-foreground/80">got it {drop.stat}</span>}
      <span className={`rounded-full border px-1.5 py-px text-[10px] ${drop.manual ? 'border-blue-400/40 text-blue-300' : 'border-card-border'}`}>
        {drop.origin}
      </span>
      {drop.awaiting && <span className="rounded-full border border-amber-400/50 px-1.5 py-px text-[10px] text-amber-300">awaiting staff confirmation</span>}
      {drop.screenshotUrl && (
        <a href={drop.screenshotUrl} target="_blank" rel="noreferrer" className="underline hover:text-gold">
          screenshot
        </a>
      )}
    </li>
  );
}

/** Hover text for one row's chip: where its share of Due comes from, or why it has none. */
function chipTitle(p: HuntRowProgress): string {
  if (p.gain == null) return `${p.name}: the starting point is not read yet.`;
  if (p.due != null && p.rate != null) return `${p.name}: ${Math.round(p.due * 100)}% of a 1 in ${Math.round(p.rate).toLocaleString()} drop rate worked through since the start.`;
  return p.unit === 'xp'
    ? `${p.name}: XP gained since the start. There is no XP-based drop rate in our data, so it does not add to Due.`
    : `${p.name}: kills since the start. There is no drop rate for it in our data, so it does not add to Due.`;
}

/** "General Graardor +2,140 kc 43%" per row a player is still missing: progress since the hunt started. */
function ProgressChips({ row }: { row: HuntViewRow }) {
  const have = new Set(row.heldIds);
  const chips = (row.progress ?? []).filter((p) => p.label && !have.has(p.id));
  if (chips.length === 0) return null;
  // The same stat on several rows (a pet and an item from one boss) is one chip, with the larger share.
  const byLabel = new Map<string, HuntRowProgress>();
  for (const p of chips) {
    const key = `${p.label}|${p.unit}`;
    const held = byLabel.get(key);
    if (!held || (p.due ?? -1) > (held.due ?? -1)) byLabel.set(key, p);
  }
  return (
    <span className="mt-1 flex flex-wrap gap-1.5 text-[11.5px]">
      {[...byLabel.values()].map((p) => {
        const moved = (p.gain ?? 0) > 0;
        return (
          <span key={`${p.id}-${p.label}`} title={chipTitle(p)} className={`rounded-md border px-1.5 py-0.5 ${moved ? 'border-card-border text-foreground/90' : 'border-card-border/60 text-text-dim'}`}>
            {moved ? rowProgressWords(p) : `${p.label} +0`}
            {moved && p.due != null && <span className="ml-1 text-text-muted">{dueWords(p.due)}</span>}
          </span>
        );
      })}
    </span>
  );
}

/** "Baron · 20m / 10m / 5m · 1 of 3 claimed (Minyol)": each bounty, and how far it has gone. */
function BountyList({ view }: { view: HuntView }) {
  const unit = view.currency === 'hcw' ? ' HCW gp' : '';
  return (
    <div className="mt-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Bounties{unit && ` · paid in${unit}`}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5 text-xs">
        {view.bounties.map((b) => {
          const open = b.claimedBy.length < b.amounts.length;
          return (
            <li key={b.itemId} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${open ? 'border-gold/40 text-foreground/90' : 'border-card-border text-text-muted'}`}>
              <ThingIcon src={itemIconUrl(b.itemId)} alt="" size={16} />
              <span>
                {b.name} · <b className="tabular-nums text-gold-light">{bountyLadderWords(b.amounts, formatGp)}</b> · {bountyClaimWords(b.amounts, b.claimedBy)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] text-text-muted">Each is paid to the first players whose drop of it counts, in that order, once each. Paid with the prizes when the hunt ends.</p>
    </div>
  );
}

function Row({ row, view, pinned }: { row: HuntViewRow; view: HuntView; pinned?: boolean }) {
  const stat = statGainWords(row, view);
  const has = row.count > 0;
  // "First to get it": one drop and they are finished, in their place. The rows still to get and the
  // progress toward them only matter while a player is still hunting.
  const done = view.rule === 'first' && has;
  return (
    <div
      className={`border-b border-card-border/60 px-3 py-2.5 last:border-b-0 ${
        row.isMe ? 'bg-gradient-to-r from-accent-green/20 to-card-bg shadow-[inset_3px_0_0_#34d058]' : 'bg-card-bg'
      } ${pinned ? 'rounded-xl border border-accent-green/25' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-8 shrink-0 font-mono text-xs ${has && row.rank <= 3 ? 'text-gold' : 'text-text-muted'}`}>
          {has && row.rank <= 3 ? MEDALS[row.rank - 1] : `#${row.rank}`}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {row.rsn}
            <EntrantTags hcw={row.hcw} stopped={row.stopped} />
            {row.isMe && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-accent-green-light">you</span>}
          </span>
          {/* "2 of 3": the rows they hold, as their icons. */}
          {done && <span className="block text-xs font-semibold text-accent-green-light">{firstDoneWords(row.rank)}</span>}
          {view.v2 && !done && view.rule !== 'rush' && view.targets.length > 1 && row.held > 0 && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
              {row.heldIds.slice(0, 6).map((id) => (
                <ThingIcon key={id} src={itemIconUrl(id)} alt="" size={18} />
              ))}
              {row.held} of {view.targets.length}
              {row.completeAt && <span className="ml-1 rounded-full border border-gold/50 px-1.5 text-[10px] text-gold-light">has all of them</span>}
            </span>
          )}
          {view.v2 && !done && <ProgressChips row={row} />}
          {stat && <span className={`block text-xs ${!has && (row.statGain ?? 0) > 0 && !row.rushWords ? 'text-amber-300/90' : 'text-text-muted'}`}>{stat}</span>}
          {/* A hunt over several bosses: where those kills were, and each count's start and now on hover. */}
          {/* A Boss Rush lists only the targets they have kills at: "ToA: Expert 2, CoX 1". */}
          {(() => {
            const parts = row.statParts && view.rule === 'rush' ? row.statParts.filter((p) => p.gained > 0) : row.statParts;
            return parts && parts.length > 0 ? (
              <span className="block text-[11px] text-text-dim">
                {parts.map((p, i) => (
                  <span key={p.label} title={`${p.label}: ${p.from.toLocaleString()} at the start, ${p.now.toLocaleString()} now`}>
                    {i > 0 ? ', ' : ''}
                    {p.label} {p.gained.toLocaleString()}
                  </span>
                ))}
              </span>
            ) : null;
          })()}
        </span>
        {/* Due: how much of the rows' drop rates a player without a drop has worked through. */}
        {view.v2 && view.rated && !has && (
          <span className="shrink-0 text-right" title="How much of the drop rates they have worked through since the start. 100% means one is expected by now.">
            <span className={`block font-mono text-lg font-bold leading-none tabular-nums ${(row.due ?? 0) >= 0.5 ? 'text-amber-300' : 'text-foreground/80'}`}>{row.due != null ? dueWords(row.due) : '—'}</span>
            <span className="block text-[10px] uppercase tracking-wider text-text-muted">due</span>
          </span>
        )}
        <span className="shrink-0 text-right">
          <span className={`block font-mono text-lg font-bold leading-none tabular-nums ${has ? 'text-gold-light' : 'text-text-muted'}`}>{done ? placeWords(row.rank) : row.count.toLocaleString()}</span>
          <span className="block text-[10px] uppercase tracking-wider text-text-muted">{done ? 'place' : view.rule === 'points' || view.rule === 'rush' ? (row.count === 1 ? 'point' : 'points') : row.count === 1 ? 'drop' : 'drops'}</span>
        </span>
      </div>
      {row.drops.length > 0 && (
        <ul className="mt-1.5 space-y-1 pl-11">
          {row.drops.map((d) => (
            <DropLine key={d.id} drop={d} showItem={view.multipleTargets || d.quantity > 1} />
          ))}
        </ul>
      )}
      {/* Boss Rush: your own deaths that cost points, each with its screenshot (only you and staff see these). */}
      {row.deathShots && row.deathShots.length > 0 && (
        <details className="mt-1.5 pl-11 text-xs text-text-muted">
          <summary className="cursor-pointer hover:text-foreground">Your deaths ({row.deathShots.length}). Only you and staff see these.</summary>
          <ul className="mt-1 space-y-1">
            {row.deathShots.map((d) => (
              <li key={d.at}>
                <LocalTime date={d.at} format="short" />
                {d.source && <>, {d.source}</>}
                {d.url ? (
                  <>, <a href={d.url} target="_blank" rel="noreferrer" className="underline hover:text-gold">screenshot</a></>
                ) : (
                  <>, no screenshot</>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function HuntStandingsTable({ view }: { view: HuntView }) {
  const started = view.status !== 'upcoming';
  return (
    <div>
      <h2 className="mb-2 flex flex-wrap items-center gap-2 text-lg font-bold text-foreground">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Standings
        <span className="text-xs font-normal text-text-muted">
          {view.rows.length} entered · {view.rule === 'first' ? 'in the order they got their first' : view.rule === 'points' || view.rule === 'rush' ? 'most points first' : 'most drops first'}
          {view.rushRules && ` · ${view.rushRules}`}
          {!view.v2 && view.statLabel && view.statUnit === 'kills' && ` · kills at ${view.statLabel} since the start`}
        </span>
      </h2>
      {view.rule === 'first' && <p className="mb-1 max-w-3xl text-xs text-foreground/80">{firstRuleWords(view.targets.length)}</p>}
      <p className="mb-3 text-xs text-text-muted">
        {view.rule === 'rush' && 'Deaths count from the Anvil plugin. '}Drops count from the Anvil plugin, or from a screenshot with the kill count or XP that staff approve.
      </p>

      {view.awaiting.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2.5 text-sm">
          <p className="font-semibold text-amber-300">
            {view.awaiting.length === 1 ? 'Drop reported: awaiting staff confirmation' : `${view.awaiting.length} drops reported: awaiting staff confirmation`}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            This hunt ends {view.endingWords}. {view.awaiting.map((a) => `${a.rsn}'s ${a.itemName}`).join(', ')} would end it, once staff confirm. Until then it keeps
            running and every drop still counts.
          </p>
        </div>
      )}

      {/* Your own rows — every character of yours on this hunt — pinned above the list: only the ones
          that would otherwise be below the first few, so none is the same row twice. */}
      {started && view.mine.some((m) => view.rows.findIndex((r) => r.rsn === m.rsn) >= 5) && (
        <div className="mb-3 space-y-2">
          {view.mine
            .filter((m) => view.rows.findIndex((r) => r.rsn === m.rsn) >= 5)
            .map((m) => (
              <Row key={m.rsn} row={m} view={view} pinned />
            ))}
        </div>
      )}

      {view.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border py-10 text-center text-sm text-text-muted">Nobody is entered yet.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-card-border [&>div:last-child>div:last-child]:border-b-0">
          {view.rows.map((r, i) => (
            <div key={r.rsn}>
              {/* Where the players with a drop end and the rest, ordered by Due, begin. */}
              {view.v2 && view.rated && r.count === 0 && (i === 0 || view.rows[i - 1].count > 0) && (
                <p className="border-b border-card-border/60 bg-brown-dark/40 px-3 py-1.5 text-xs text-text-muted">No drop yet: ordered by how due they are</p>
              )}
              <Row row={r} view={view} />
            </div>
          ))}
        </div>
      )}
      {view.v2 && view.rated && started && (
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-text-muted">
          <b className="text-foreground/80">Due</b> adds up how much of each row&rsquo;s drop rate a player has worked through since the start: 2,140 kills toward a 1 in 5,000 pet is 43%.
          100% means one is expected by now. Kills and XP are never added together. A row with no drop rate in our data (a skilling pet&rsquo;s XP) shows its gain and adds nothing.
        </p>
      )}
      {started && view.drops === 0 && view.rows.length > 0 && (
        <p className="mt-2 text-xs text-text-muted">No drops yet. {view.v2 && view.rated ? 'The list is in order of Due, so the top is whoever is driest.' : view.statUnit === 'kills' ? 'The list is in order of kills, so the top is whoever is driest.' : ''}</p>
      )}
    </div>
  );
}

/**
 * The manual proof form. The member's "I got it" and the staff "Add a drop" are the same questions:
 * which item, where from, when, a screenshot (required) and the kill count or XP at the drop
 * (required). A member's goes to staff; a staff one counts at once.
 */
export function HuntProofForm({
  competitionId,
  proof,
  characters,
  staff = false,
  onDone,
}: {
  competitionId: number;
  proof: HuntView['proof'];
  /** Who it can be for: the member's own entered characters, or every entrant for staff. */
  characters: { id: number; rsn: string }[];
  staff?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState(characters.length === 1 ? String(characters[0].id) : '');
  const [itemId, setItemId] = useState(proof.targets.length === 1 ? String(proof.targets[0].itemId) : '');
  const target = proof.targets.find((t) => String(t.itemId) === itemId) ?? null;
  const [source, setSource] = useState('');
  const [when, setWhen] = useState('');
  const [statKind, setStatKind] = useState<'kc' | 'xp'>(proof.statKind === 'xp' ? 'xp' : 'kc');
  const [stat, setStat] = useState(0);
  const [xpSkill, setXpSkill] = useState(proof.xpSkill ?? '');
  const [quantity, setQuantity] = useState(1);
  const [screenshot, setScreenshot] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  // One accepted source needs no question; several is a choice; "any source" is free text with the
  // dataset's sources offered.
  const fixedSource = target && !target.free && target.sources.length === 1 ? target.sources[0] : null;
  const effectiveSource = fixedSource ?? source;

  async function submit() {
    setError('');
    if (!participantId) return setError('Choose the character.');
    if (!itemId) return setError(proof.pets ? 'Choose the pet.' : 'Choose the item.');
    if (target && !target.free && !effectiveSource) return setError('Choose where it came from.');
    if (!when) return setError('Pick when the drop happened.');
    if (!screenshot) return setError('Add a screenshot of the drop. It is required.');
    if (!(stat > 0)) return setError(statKind === 'kc' ? 'Enter the kill count at the drop.' : 'Enter the exact XP at the drop.');
    if (statKind === 'xp' && !xpSkill) return setError('Choose the skill the XP is in.');
    setBusy(true);
    try {
      const res = await clanFetch(staff ? `/api/admin/weekly/${competitionId}/hunt` : `/api/weekly/${competitionId}/hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          participantId: Number(participantId),
          itemId: Number(itemId),
          itemName: target?.name ?? '',
          source: effectiveSource || null,
          occurredAt: when,
          quantity,
          kc: statKind === 'kc' ? stat : null,
          xp: statKind === 'xp' ? stat : null,
          xpSkill: statKind === 'xp' ? xpSkill : null,
          screenshotUrl: screenshot,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'That did not work.');
        return;
      }
      setSent(true);
      router.refresh();
      onDone?.();
    } catch {
      setError('That did not work. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent && !staff) {
    return <p className="rounded-xl border border-accent-green/30 bg-accent-green/10 px-3 py-2.5 text-sm">Sent. It counts once staff have approved it.</p>;
  }

  const label = 'mb-1 block text-xs font-medium text-foreground/70';
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {(staff || characters.length > 1) && (
          <div>
            <label className={label}>{staff ? 'Who got it' : 'Which character'}</label>
            <Select value={participantId} onChange={setParticipantId} ariaLabel="Character" placeholder="Choose a character" options={characters.map((c) => ({ value: String(c.id), label: c.rsn }))} />
          </div>
        )}
        {proof.targets.length > 1 && (
          <div>
            <label className={label}>{proof.pets ? 'Which pet' : 'Which item'}</label>
            <Select
              value={itemId}
              onChange={(v) => {
                setItemId(v);
                setSource('');
              }}
              ariaLabel={proof.pets ? 'Pet' : 'Item'}
              placeholder={proof.pets ? 'Choose the pet' : 'Choose the item'}
              options={proof.targets.map((t) => ({ value: String(t.itemId), label: t.name }))}
            />
          </div>
        )}
        {target && !fixedSource && !proof.pets && !target.pet && (
          <div>
            <label className={label}>Where it came from</label>
            {target.free && target.sources.length === 0 ? (
              <Input value={source} onChange={(e) => setSource(e.target.value)} maxLength={80} placeholder="The boss, monster or activity" aria-label="Where it came from" />
            ) : (
              <Select
                value={source}
                onChange={setSource}
                ariaLabel="Where it came from"
                placeholder="Choose the source"
                options={target.sources.map((s) => ({ value: s, label: s }))}
              />
            )}
          </div>
        )}
        <div>
          <label className={label}>When</label>
          <DateTimePicker value={when} onChange={setWhen} ariaLabel="When the drop happened" placeholder="Pick the date and time" />
        </div>
      </div>
      {fixedSource && <p className="text-xs text-text-muted">Counts from {fixedSource} in this hunt.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {proof.statKind === 'either' && (
          <div>
            <label className={label}>The number at the drop</label>
            <Select
              value={statKind}
              onChange={(v) => setStatKind(v === 'xp' ? 'xp' : 'kc')}
              ariaLabel="Kill count or XP"
              options={[
                { value: 'kc', label: 'Kill count' },
                { value: 'xp', label: 'Exact XP in a skill' },
              ]}
            />
          </div>
        )}
        {statKind === 'xp' && !proof.xpSkill && (
          <div>
            <label className={label}>Skill</label>
            <Select value={xpSkill} onChange={setXpSkill} ariaLabel="Skill" placeholder="Choose the skill" options={SKILLS.filter((s) => s !== 'overall').map((s) => ({ value: s, label: SKILL_LABELS[s] ?? s }))} />
          </div>
        )}
        <div>
          <label className={label}>
            {statKind === 'kc' ? (staff ? 'Kill count at the drop' : 'Kill count when you got it') : `Exact ${SKILL_LABELS[xpSkill] ?? ''} XP ${staff ? 'at the drop' : 'when you got it'}`.replace(/\s+/g, ' ')}
          </label>
          <NumberInput value={stat} onChange={setStat} min={0} max={statKind === 'kc' ? 1_000_000 : 200_000_000} aria-label={statKind === 'kc' ? 'Kill count at the drop' : 'XP at the drop'} />
        </div>
        {!proof.pets && !target?.pet && (
          <div>
            <label className={label}>How many</label>
            <NumberInput value={quantity} onChange={setQuantity} min={1} max={1_000_000} fallback={1} aria-label="Quantity" />
          </div>
        )}
      </div>

      <div>
        <label className={label}>Screenshot of the drop (required)</label>
        <ImageUpload onImageSelected={setScreenshot} currentUrl={screenshot || undefined} />
        <p className="mt-1 text-xs text-text-muted">Show the drop and the kill count or XP in the same picture where you can.</p>
      </div>
      <div>
        <label className={label}>Note (optional)</label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={staff ? 'Why this is added by hand' : 'Anything staff should know'} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="min-h-11 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
      >
        {busy ? 'Sending…' : staff ? 'Add the drop' : 'Send to staff'}
      </button>
      {!staff && <p className="text-xs text-text-muted">Staff look at the screenshot and the number before it counts.</p>}
    </div>
  );
}

/** "I got it": the member's way in, folded until asked for. */
export function HuntClaim({ competitionId, proof, characters }: { competitionId: number; proof: HuntView['proof']; characters: { id: number; rsn: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">Got one without the plugin running?</p>
          <p className="text-xs text-text-muted">Send a screenshot with the kill count or XP. It counts once staff approve it.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-h-11 rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10"
        >
          {open ? 'Close' : 'I got it'}
        </button>
      </div>
      {open && (
        <div className="mt-4 border-t border-card-border pt-4">
          <HuntProofForm competitionId={competitionId} proof={proof} characters={characters} />
        </div>
      )}
    </div>
  );
}

/** The hunt's header: what is hunted and by which rule, where it stands, and who has it. */
export function HuntHero({ title, view, startDate, endDate, countsOn }: { title: string; view: HuntView; startDate: string; endDate: string; countsOn?: string | null }) {
  const ended = view.status === 'completed';
  const upcoming = view.status === 'upcoming';
  const top = view.rows[0]?.count > 0 ? view.rows[0] : null;
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-gold/25 bg-card-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_80%_at_8%_0%,rgba(212,175,55,0.15),transparent_62%)]" />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          {view.iconUrl && (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-gold/25 bg-brown-dark/60">
              <ThingIcon src={view.iconUrl} alt="" size={36} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest ${ended ? 'text-text-muted' : upcoming ? 'text-blue-400' : 'text-accent-green-light'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ended ? 'bg-text-muted' : upcoming ? 'bg-blue-400' : 'animate-pulse bg-accent-green-light'}`} />
              {ended ? 'Finished · final standings' : upcoming ? 'Starts soon' : 'Live'}
            </div>
            <h1 className="mt-1 break-words text-2xl font-extrabold leading-tight text-gold sm:text-3xl">{title}</h1>
            <p className="mt-1.5 break-words text-sm text-foreground/90">
              <span className="font-semibold">{view.kindWord}:</span> {view.line}
            </p>
            {view.points && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {view.points.map((p) => (
                  <span key={p.name} className="rounded-full border border-card-border px-2.5 py-0.5 text-foreground/90">
                    {p.name} <b className="tabular-nums text-gold-light">{p.points.toLocaleString()}</b>
                  </span>
                ))}
                {view.firstOfEach && <span className="px-1 py-0.5 text-text-muted">only each player&rsquo;s first of each item scores</span>}
              </div>
            )}
            {view.bounties.length > 0 && <BountyList view={view} />}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-card-border bg-brown-dark/60 px-2.5 py-0.5 text-text-muted">
                <LocalTime date={startDate} format="short" /> – <LocalTime date={endDate} format="short" />
              </span>
              {!ended && <span className="rounded-full border border-card-border bg-brown-dark/60 px-2.5 py-0.5 text-text-muted">ends {view.endingWords}</span>}
              <CountsOnChip countsOn={countsOn} />
              <span className="rounded-full border border-card-border bg-brown-dark/60 px-2.5 py-0.5 text-text-muted">
                {view.rows.length} entered · no sign-up
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Drops</div>
            <div className="mt-1.5 font-mono text-3xl font-bold leading-none tabular-nums text-gold-light">{view.drops.toLocaleString()}</div>
            <div className="mt-1.5 text-[11.5px] text-text-muted">
              {view.hunters === 0 ? 'nobody has one yet' : `${view.hunters} ${view.hunters === 1 ? 'player has' : 'players have'} one`}
            </div>
          </div>
          {top && (
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {ended ? 'Winner' : view.rule === 'first' ? 'First to get it' : 'Leading'}
              </div>
              <div className="mt-1.5 truncate font-mono text-lg font-bold leading-none">{top.rsn}</div>
              <div className="mt-1.5 text-[11.5px] text-text-muted">
                {view.rule === 'first' ? (
                  <>
                    {top.firstAt && <LocalTime date={top.firstAt} format="short" />}
                    {top.drops[0]?.stat && <> · {top.drops[0].stat}</>}
                  </>
                ) : (
                  <>
                    {top.count.toLocaleString()} {view.rule === 'points' || view.rule === 'rush' ? (top.count === 1 ? 'point' : 'points') : top.count === 1 ? 'drop' : 'drops'}
                    {top.rushWords && <> · {top.rushWords}</>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
