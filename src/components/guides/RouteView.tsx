'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clanFetch } from '@/lib/clanFetch';

import ClanLink from '@/components/ClanLink';
import DialogFrame from '@/components/DialogFrame';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { GUIDE_ACCOUNTS, type GuideAccount } from '@/lib/guideSetups';
import { goalLabel, routeProgress, type RouteBlock, type RouteProgress, type StepState } from '@/lib/guideRoutes';
import { ItemSprite } from './osrs';

async function post(url: string, body: unknown) {
  const res = await clanFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, error: j.error };
}

/**
 * A progression route: ordered chapters of goals, ticked from what the site knows. Quest steps name
 * the quest and hand over to Quest Helper — no walkthroughs here.
 */
export default function RouteView({
  guide,
  route,
  progress,
  following,
  followers,
  signedIn,
  account,
  credit,
}: {
  guide: { id: number; slug: string; title: string; summary: string; categoryLabel: string };
  route: RouteBlock | null;
  progress: RouteProgress | null;
  following: boolean;
  followers: number;
  signedIn: boolean;
  account: GuideAccount | null;
  credit: string;
}) {
  const router = useRouter();
  const [acct, setAcct] = useState<GuideAccount | null>(account ?? route?.accounts?.[0] ?? null);
  const [suggest, setSuggest] = useState(false);
  const [showDone, setShowDone] = useState<Record<number, boolean>>({});
  if (!route || !progress) return <p className="text-sm text-text-muted">This route could not be read.</p>;
  // The account switch re-runs the forks over the same facts the server ticked.
  const p = acct === account ? progress : withAccount(progress, route, acct);
  const nextUp = p.next[0] ?? null;

  async function follow(on: boolean) {
    await post(`/api/guides/${guide.id}/follow`, { on });
    router.refresh();
  }
  async function tick(s: StepState) {
    await post(`/api/guides/${guide.id}/follow`, { stepId: s.step.id, done: !s.done });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-4">
        <ClanLink href="/guides" className="text-xs text-text-muted hover:text-gold">
          ‹ Guides / {guide.categoryLabel}
        </ClanLink>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold">{guide.title}</h1>
            <p className="mt-1 text-sm text-text-muted">
              {credit ? `${credit} · ` : ''}
              {followers} following · ordered milestones, not quest walkthroughs
            </p>
          </div>
          {signedIn ? (
            <button type="button" aria-pressed={following} onClick={() => follow(!following)} className={`h-11 rounded-lg px-4 text-sm font-semibold ${following ? 'border border-gold bg-gold/15 text-gold' : 'bg-gold text-brown-dark'}`}>
              {following ? 'Following ✓' : 'Follow this route'}
            </button>
          ) : (
            <span className="text-xs text-text-muted">Sign in to follow it and tick steps.</span>
          )}
        </div>
        <div role="group" aria-label="Account type" className="flex flex-wrap gap-1.5">
          {GUIDE_ACCOUNTS.filter((a) => !route.accounts?.length || route.accounts.includes(a.key)).map((a) => (
            <button key={a.key} type="button" aria-pressed={acct === a.key} onClick={() => setAcct(a.key)} className={`h-9 rounded-full border px-3 text-xs ${acct === a.key ? 'border-gold bg-gold font-semibold text-brown-dark' : 'border-card-border bg-card-bg'}`}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <div className="flex items-baseline justify-between text-sm">
            <strong>
              {p.done} of {p.total} steps done
            </strong>
            <span className="text-xs text-text-muted">Ticked from your hiscores, quests, collection log and the plugin</span>
          </div>
          <div role="progressbar" aria-valuenow={p.done} aria-valuemin={0} aria-valuemax={p.total} aria-label="Route progress" className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gold" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {nextUp && (
            <section aria-label="Next up" className="flex items-center gap-4 rounded-xl border border-gold bg-[#2a2114] p-4">
              {nextUp.step.icon ? <ItemSprite id={nextUp.step.icon} size={40} /> : null}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-widest text-gold">Next up · step {nextUp.n}</div>
                <strong className="text-lg">{nextUp.step.title}</strong>
                <p className="text-sm text-text-muted">{nextUp.line}</p>
              </div>
              <div className="text-right text-xs text-text-muted">{nextUp.reqs.length ? 'all reqs met' : ''}</div>
            </section>
          )}
          {route.chapters.map((ch, ci) => {
            const steps = p.steps.filter((s) => s.chapter === ci);
            const done = steps.filter((s) => s.done && !s.skipped).length;
            const counted = steps.filter((s) => !s.skipped).length;
            // Done steps before the first open one fold away.
            const firstOpen = steps.findIndex((s) => !s.done && !s.skipped);
            const hideUpTo = showDone[ci] ? 0 : Math.max(0, firstOpen);
            return (
              <section key={ci} className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
                <div className="flex items-center gap-2 border-b border-card-border px-5 py-3">
                  <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
                  <h2 className="flex-1 text-lg font-bold">{ch.name}</h2>
                  <span className="text-xs text-text-muted">
                    {done} of {counted} done
                  </span>
                </div>
                {hideUpTo > 0 && (
                  <button type="button" onClick={() => setShowDone({ ...showDone, [ci]: true })} className="w-full border-b border-card-border px-5 py-2 text-left text-xs text-gold hover:bg-white/5">
                    Show steps {steps[0].n}–{steps[hideUpTo - 1].n} (all done)
                  </button>
                )}
                {steps.slice(hideUpTo).map((s) => (
                  <div key={s.step.id} className={`flex gap-3 border-b border-card-border px-5 py-3.5 last:border-b-0 ${s.skipped ? 'opacity-50' : ''}`}>
                    <button
                      type="button"
                      disabled={!signedIn || !following || s.step.goal.kind !== 'manual'}
                      onClick={() => tick(s)}
                      title={s.step.goal.kind === 'manual' ? (following ? 'Tick it yourself' : 'Follow the route to tick steps') : s.source ?? 'Ticks itself'}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${s.done ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-card-border text-text-muted'}`}
                      aria-label={s.done ? 'Done' : 'Not done'}
                    >
                      {s.done ? '✓' : s.n}
                    </button>
                    {s.step.icon ? <ItemSprite id={s.step.icon} size={30} /> : <span className="w-[30px]" />}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className={s.done ? 'text-text-muted line-through' : ''}>{s.step.title}</strong>
                        {s.source && <span className="text-[11px] text-emerald-300">{s.source}</span>}
                        {s.step.by && <span className="text-[11px] text-text-muted">suggested by {s.step.by.name}</span>}
                      </div>
                      {s.line && <p className="text-sm text-text-muted">{s.line}</p>}
                      {s.reqs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {s.reqs.map((r, i) => (
                            <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs ${r.met === false ? 'border border-[#6b5326] bg-[#2a2114] font-semibold' : 'border border-card-border bg-black/20 text-text-muted'}`}>
                              {goalLabel(r.goal)}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.step.goal.kind === 'quest' && <span className="inline-block rounded-md border border-card-border bg-black/20 px-2 py-0.5 text-xs">Quest Helper takes it from here</span>}
                      {s.skipped && <span className="block text-xs text-amber-200">{s.line}</span>}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
        <aside className="space-y-3">
          <div className="space-y-2 rounded-xl border border-card-border bg-card-bg p-4">
            <h3 className="font-bold">Help build it</h3>
            <p className="text-xs text-text-muted">Suggestions go to the curators. Steps name quests and link out to Quest Helper; they never walk you through them.</p>
            {signedIn && (
              <button type="button" onClick={() => setSuggest(true)} className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm text-gold hover:bg-gold/10">
                Suggest a step
              </button>
            )}
            <ClanLink href="/guides/propose" className="block text-xs text-gold hover:underline">
              Write a community route
            </ClanLink>
          </div>
        </aside>
      </div>
      {suggest && <SuggestStep guideId={guide.id} chapters={route.chapters.map((c) => c.name)} onClose={() => setSuggest(false)} />}
    </div>
  );
}

function withAccount(progress: RouteProgress, route: RouteBlock, acct: GuideAccount | null): RouteProgress {
  // Re-derive forks from the steps' own done/reqs: facts don't change with the switch.
  const manual = new Set(progress.steps.filter((s) => s.done && s.source === 'ticked by you').map((s) => s.step.id));
  const doneAuto = new Set(progress.steps.filter((s) => s.done && s.source !== 'ticked by you').map((s) => s.step.id));
  const p = routeProgress(route, { manual: new Set([...manual, ...doneAuto]) }, acct);
  // Keep the real sources and requirement truths from the server pass.
  const byId = new Map(progress.steps.map((s) => [s.step.id, s]));
  const steps = p.steps.map((s) => ({ ...s, source: byId.get(s.step.id)?.source ?? null, reqs: byId.get(s.step.id)?.reqs ?? s.reqs, ready: byId.get(s.step.id)?.ready ?? s.ready }));
  const open = steps.filter((s) => !s.skipped && !s.done);
  return { ...p, steps, next: open.filter((s) => s.ready).slice(0, 3) };
}

function SuggestStep({ guideId, chapters, onClose }: { guideId: number; chapters: string[]; onClose: () => void }) {
  const [chapter, setChapter] = useState('0');
  const [kind, setKind] = useState('manual');
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [target, setTarget] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function send() {
    const goal =
      kind === 'quest' ? { kind, name: target || title } : kind === 'level' ? { kind, skill: target.split(' ')[0]?.toLowerCase(), level: Number(target.split(' ')[1]) } : kind === 'item' ? { kind, id: Number(target) } : { kind: 'manual' };
    const r = await post(`/api/guides/${guideId}/suggest`, { chapter: Number(chapter), step: { title, why, goal } });
    setMsg(r.ok ? 'Sent for review — usually within a day.' : r.error ?? 'Could not send it.');
  }
  return (
    <DialogFrame dirty={!!title} onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" panelClassName="w-full max-w-lg rounded-xl border border-card-border bg-card-bg p-5" ariaLabel="Suggest a step">
      {(close) => (
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Suggest a step</h2>
          <label className="block text-xs text-text-muted">
            Chapter
            <Select value={chapter} onChange={setChapter} options={chapters.map((c, i) => ({ value: String(i), label: c }))} ariaLabel="Chapter" />
          </label>
          <label className="block text-xs text-text-muted">
            Kind
            <Select
              value={kind}
              onChange={setKind}
              ariaLabel="Kind"
              options={[
                { value: 'manual', label: 'Manual (the player ticks it)' },
                { value: 'quest', label: 'Quest (named only)' },
                { value: 'level', label: 'Level' },
                { value: 'item', label: 'Item obtained' },
              ]}
            />
          </label>
          <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="What to get, e.g. Ava's accumulator" />
          {kind !== 'manual' && <Input value={target} onChange={(e) => setTarget(e.target.value.slice(0, 80))} placeholder={kind === 'level' ? 'Skill and level, e.g. agility 70' : kind === 'item' ? 'Item id' : 'Quest name'} />}
          <Input value={why} onChange={(e) => setWhy(e.target.value.slice(0, 200))} placeholder="Why it matters, in one line" />
          {msg && <p className="text-xs text-amber-200">{msg}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-lg border border-card-border px-3 py-2 text-sm">
              Cancel
            </button>
            <button type="button" disabled={!title.trim()} onClick={send} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-40">
              Send suggestion
            </button>
          </div>
        </div>
      )}
    </DialogFrame>
  );
}
