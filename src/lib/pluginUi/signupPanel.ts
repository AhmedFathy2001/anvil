import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { eventSignups, events, surveyQuestions, teams } from '@/db/schema';
import { verifyPluginTokenUser, resolvePluginMember } from '@/lib/auth';
import { BOSSES, SKILLS } from '@/lib/constants';
import { canSeeClan } from '@/lib/clanAccess';
import { parseModules, signupWindow } from '@/lib/clanEventModules';
import { liveClanEvent, mySignup, seatsFor, signUp } from '@/lib/clanEventSignups';
import { refreshClanEventPost } from '@/lib/clanEvents';
import { competitionForClan, entryStatus, setOptOut } from '@/lib/competitionTeamsDb';
import { accountCap } from '@/lib/accountCap';
import { mayJoinWith } from '@/lib/characterState';
import { loadQuestions } from '@/lib/clanEventQuestions';
import { parseEventRules } from '@/lib/eventRules';
import { eventForPluginRequest } from '@/lib/eventScope';
import { signupSeatsFor } from '@/lib/eventSeats';
import { submitEventSignup, withdrawEventSignup, type SignupBody } from '@/lib/eventSignupSubmit';
import { friendsHostOfEvent } from '@/lib/friendEvents';
import { isPracticeEvent } from '@/lib/practiceScope';
import { rateLimit } from '@/lib/rate-limit';
import { signedUpNames } from '@/lib/signupPublicList';
import { formatHoursRange, parseProfile, TIMEZONE_OPTIONS, signupWindowState, type HoursRange, type SignupProfile } from '@/lib/signup';
import { RATING_MAX, toQuestionView, validateAnswers, type SurveyQuestionView } from '@/lib/survey';
import { isTeamFull, placementOf } from '@/lib/teamPlacement';
import { teamLoads } from '@/lib/teamPlacementDb';

import { viewerPlayerId, visibleClan } from './load';
import { button, card, col, gap, muted, text, type Action, type Node, type View } from './nodes';
import { CARD_W, CORAL, FAINT, small } from './sections';
import type { BingoSignupState, WeeklyEntryState } from './signupPanelUi';

type Args = Record<string, string>;

// Signing up from the side panel: a board's sign-up form, a clan event's questions, and a weekly's
// opt in / out — each the SAME write the site makes (lib/eventSignupSubmit, lib/clanEventSignups,
// lib/competitionTeamsDb), drawn as panel inputs. Nothing is decided here that the site form doesn't
// decide too; this file only turns inputs into that call's body and its answer back into a page.

/** The plugin draws a one-line `text` input (1.17+). Older ones draw nothing there. */
export const hasTextInput = (request: Request) => request.headers.get('X-Anvil-Text-Input') === '1';

const REASONS: Record<string, string> = {
  not_open_yet: 'Sign-ups aren’t open yet.',
  closed: 'Sign-ups have closed.',
  event_started: 'It has started — sign-ups are closed.',
  off: 'The host adds players to this one.',
};

/** A post's request turned into a GET at the clan the button was drawn for (clanEventGoingAct). */
function atClan(request: Request, slug: string): Request {
  const url = new URL(request.url);
  url.search = new URLSearchParams({ clan: slug }).toString();
  return new Request(url, { headers: request.headers });
}

async function who(request: Request): Promise<{ userId: number; playerId: number | null } | null> {
  const user = await verifyPluginTokenUser(request).catch(() => null);
  if (!user) return null;
  return { userId: user.userId, playerId: await viewerPlayerId(request) };
}

// ---- A board on the schedule ------------------------------------------------------------------------

/** The board, at the clan the panel is on (or a co-host), and not a practice board. */
async function boardFor(request: Request, id: number) {
  if (!Number.isInteger(id) || id <= 0 || (await isPracticeEvent(id))) return null;
  const scoped = await eventForPluginRequest(request, id);
  if (!scoped) return null;
  // clan-scope: global -- the board eventForPluginRequest just proved this address may name.
  return (await db.query.events.findFirst({ where: eq(events.id, id) })) ?? null;
}

async function windowOf(event: typeof events.$inferSelect) {
  const friendsKind = (await friendsHostOfEvent(event.id)) != null ? 'friends' : null;
  return signupWindowState({ signupOpensAt: event.signupOpensAt, signupDeadline: event.signupDeadline, startDate: event.startDate, signupsEnabled: event.signupsEnabled, hostKind: friendsKind });
}

export async function bingoSignupState(request: Request, eventId: number): Promise<BingoSignupState | null> {
  const event = await boardFor(request, eventId);
  if (!event) return null;
  const me = await who(request);
  const window = await windowOf(event);
  const mine = me
    ? await db.query.eventSignups.findMany({ where: and(eq(eventSignups.eventId, eventId), eq(eventSignups.userId, me.userId)) })
    : [];
  const live = mine.filter((r) => r.status === 'pending' || r.status === 'approved');
  const status = live.some((r) => r.status === 'approved') ? 'approved' : live.length ? 'pending' : null;
  const seats = me?.playerId != null ? (await signupSeatsFor(event, me.playerId)).filter(mayJoinWith) : [];
  const shown = parseEventRules(event.rules).signupFields.publicList;
  const names = shown ? await signedUpNames(eventId) : null;
  return {
    open: window.open,
    reason: window.open ? null : REASONS[window.reason ?? ''] ?? 'Sign-ups are closed.',
    status,
    canWithdraw: !!status && window.open && event.draftStatus === 'none',
    canSign: !!me && seats.length > 0,
    noSeat: !!me && seats.length === 0,
    names,
    count: names ? names.length : 0,
  };
}

// The form. Field names: acct (one account) or acct_<seatId> (several), team, ad/aw/fd/fw _min/_max
// (active/AFK daily/weekly hours), tz, boss_<key>, skill_<key>, notes, q_<id> or q_<id>_<i> (a multi).

const HOURS: { key: keyof SignupProfile; f: string; label: string; max: number }[] = [
  { key: 'activeDailyHours', f: 'ad', label: 'Active hrs / day', max: 24 },
  { key: 'activeWeeklyHours', f: 'aw', label: 'Active hrs / week', max: 168 },
  { key: 'afkDailyHours', f: 'fd', label: 'AFK hrs / day', max: 24 },
  { key: 'afkWeeklyHours', f: 'fw', label: 'AFK hrs / week', max: 168 },
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SKILL_KEYS = SKILLS.filter((s) => s !== 'overall');

function questionInputs(q: SurveyQuestionView, value: number | string | string[] | undefined, typed: boolean): Node[] {
  const name = `q_${q.id}`;
  const label = text(q.prompt + (q.required ? ' *' : ''), 'white', { font: 'small', wrap: CARD_W });
  if (q.type === 'multi') {
    const picked = new Set(Array.isArray(value) ? value : []);
    return [label, ...q.options.map((o, i): Node => ({ t: 'input', name: `${name}_${i}`, kind: 'check', label: o, value: picked.has(o) ? '1' : '' }))];
  }
  if (q.type === 'single' || q.type === 'rating') {
    const options = q.type === 'rating' ? Array.from({ length: RATING_MAX }, (_, i) => ({ v: String(i + 1), label: `${i + 1} / ${RATING_MAX}` })) : q.options.map((o) => ({ v: o, label: o }));
    return [label, { t: 'input', name, kind: 'select', options: [{ v: '', label: '—' }, ...options], value: value == null ? '' : String(value) }];
  }
  // A typed answer: an old plugin can't type, so it says where to answer instead.
  return typed ? [label, { t: 'input', name, kind: 'text', value: typeof value === 'string' ? value : '' } as Node] : [];
}

/** A question's answer from the panel's fields, in the shape validateAnswers takes. */
function answerOf(q: SurveyQuestionView, f: Args): number | string | string[] | undefined {
  const name = `q_${q.id}`;
  if (q.type === 'multi') return q.options.filter((_, i) => f[`${name}_${i}`] === '1');
  const v = (f[name] ?? '').trim();
  if (!v) return undefined;
  return q.type === 'rating' ? Number(v) : v;
}

const answersFrom = (questions: SurveyQuestionView[], f: Args) =>
  Object.fromEntries(questions.map((q) => [String(q.id), answerOf(q, f)]).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));

/** A required typed question on a plugin that can't type: the site has to take this one. */
const needsSite = (questions: SurveyQuestionView[], typed: boolean) => !typed && questions.some((q) => q.type === 'text' && q.required);

const formHead = (back: Action, backLabel: string, name: string, error: string | null): Node[] => [
  text(backLabel, 'muted', { on: back, tip: 'Back' }),
  gap(6),
  text(name, 'brand', { font: 'bold', wrap: 205 }),
  ...(error ? [gap(6), text(error, 'error', { wrap: true })] : []),
  gap(8),
];

async function boardQuestions(eventId: number): Promise<SurveyQuestionView[]> {
  const rows = await db.select().from(surveyQuestions).where(and(eq(surveyQuestions.eventId, eventId), eq(surveyQuestions.stage, 'signup'))).orderBy(surveyQuestions.position);
  return rows.map(toQuestionView);
}

/** The board's sign-up form. `typedIn`: the fields as last sent, kept when the host's rules refused them. */
export async function bingoSignupForm(request: Request, a: Args, error: string | null = null, typedIn: Args | null = null): Promise<View> {
  const eventId = Number(a.event);
  const req = a.clan ? atClan(request, a.clan) : request;
  const event = await boardFor(req, eventId);
  const back: Action = { a: 'load', v: 'home', args: { open: a.back || `event:${eventId}`, ...(a.clan ? { clan: a.clan } : {}) } };
  const backLabel = `‹ ${a.backLabel || 'Back'}`;
  if (!event) return { ui: card([...formHead(back, backLabel, 'Sign up', null), muted('That event isn’t here any more.', { wrap: true })]) };
  const me = await who(request);
  if (!me) return { ui: card([...formHead(back, backLabel, event.name, null), muted('Sign in to the plugin to sign up.', { wrap: true })]) };
  const seats = me.playerId != null ? (await signupSeatsFor(event, me.playerId)).filter(mayJoinWith) : [];
  if (!seats.length) return { ui: card([...formHead(back, backLabel, event.name, null), muted('Link a verified account in this clan to sign up.', { wrap: true })]) };

  const typed = hasTextInput(request);
  const questions = await boardQuestions(eventId);
  const fields = parseEventRules(event.rules).signupFields;
  const mine = await db.query.eventSignups.findMany({ where: and(eq(eventSignups.eventId, eventId), eq(eventSignups.userId, me.userId)) });
  const live = mine.filter((r) => r.status !== 'withdrawn' && r.status !== 'rejected');
  // What they said last: this board's own entry, else their newest sign-up anywhere (the site's prefill).
  const prior = live.find((r) => r.profileData && r.profileData !== '{}') ?? (live.length ? null : await db.query.eventSignups.findFirst({ where: eq(eventSignups.userId, me.userId), orderBy: (s, { desc }) => [desc(s.signedUpAt)] }));
  const p = parseProfile(prior?.profileData);
  const f = typedIn;
  const val = (name: string, fallback: string) => (f ? f[name] ?? '' : fallback);

  const parts: Node[] = [...formHead(back, backLabel, event.name, error)];
  if (needsSite(questions, typed)) {
    parts.push(muted('This sign-up asks for typed answers. Update the plugin to answer here, or sign up on the site.', { wrap: true }), gap(6), button('Sign up on Anvil', { a: 'site', path: `/events/${eventId}/signup` }));
    return { ui: card(parts) };
  }

  // Which account(s). The character you're playing first; several when the host takes more than one.
  const member = await resolvePluginMember(request).catch(() => null);
  const playing = seats.find((s) => s.accountId === member?.accountId)?.id;
  const entered = new Set(live.map((r) => r.clanMemberId));
  const max = accountCap(event.maxAccountsPerPerson);
  if (seats.length === 1) parts.push(muted(`Signing up as ${seats[0].rsn}`, { wrap: CARD_W }));
  else if (max > 1) {
    parts.push(text(`Accounts (up to ${max})`, 'white', { font: 'small' }));
    for (const s of seats) parts.push({ t: 'input', name: `acct_${s.id}`, kind: 'check', label: s.rsn, value: val(`acct_${s.id}`, entered.size ? (entered.has(s.id) ? '1' : '') : s.id === (playing ?? seats[0].id) ? '1' : '') });
  } else {
    const first = [...entered][0] ?? playing ?? seats[0].id;
    parts.push(text('Account', 'white', { font: 'small' }), { t: 'input', name: 'acct', kind: 'select', options: seats.map((s) => ({ v: String(s.id), label: s.rsn })), value: val('acct', String(first)) });
  }

  // The team, on a board where the player names it.
  const rules = parseEventRules(event.rules);
  const placement = placementOf(event);
  if (placement === 'pick' || rules.teamChoice) {
    const list = placement === 'pick'
      ? await teamLoads(eventId).then((ls) => ls.map((t) => ({ id: t.id, label: `${t.name}${isTeamFull(t, event.teamCap, ls) ? ' (full)' : ''}` })))
      : (await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.eventId, eventId)).orderBy(teams.name)).map((t) => ({ id: t.id, label: t.name }));
    if (list.length) {
      const was = live[0]?.requestedTeamId;
      parts.push(gap(4), text(placement === 'pick' ? 'Your team *' : 'Team you’d like', 'white', { font: 'small' }), {
        t: 'input',
        name: 'team',
        kind: 'select',
        options: [{ v: '', label: placement === 'pick' ? 'Pick a team' : 'No preference' }, ...list.map((t) => ({ v: String(t.id), label: t.label }))],
        value: val('team', was ? String(was) : ''),
      });
    }
  }

  if (fields.availability) {
    const grid: Node[] = [];
    for (const h of HOURS) {
      const r = p[h.key] as HoursRange | undefined;
      grid.push(
        { t: 'input', name: `${h.f}_min`, kind: 'number', label: 'from', min: 0, max: h.max, value: val(`${h.f}_min`, String(r?.min ?? 0)) },
        { t: 'input', name: `${h.f}_max`, kind: 'number', label: 'to', min: 0, max: h.max, value: val(`${h.f}_max`, String(r?.max ?? 0)) },
      );
    }
    parts.push(gap(4), {
      t: 'fold',
      head: text(`Hours you can play${p.activeDailyHours ? `, ${formatHoursRange(p.activeDailyHours)}/day` : ''}`, 'white', { font: 'small' }),
      chev: true,
      c: col(HOURS.flatMap((h, i) => [small(h.label, FAINT), { t: 'grid', cols: 2, gap: 4, c: grid.slice(i * 2, i * 2 + 2) } as Node]), { gap: 3 }),
    });
  }
  if (fields.timezone) {
    parts.push(gap(4), text('Timezone', 'white', { font: 'small' }), { t: 'input', name: 'tz', kind: 'select', options: [{ v: '', label: '—' }, ...TIMEZONE_OPTIONS.map((o) => ({ v: o.value, label: o.label }))], value: val('tz', p.timezone ?? '') });
  }
  const checks = (prefix: string, list: { v: string; label: string }[], had: string[] | undefined): Node => {
    const on = new Set(had ?? []);
    return { t: 'grid', cols: 2, gap: 2, c: list.map((o): Node => ({ t: 'input', name: `${prefix}_${o.v}`, kind: 'check', label: o.label, value: val(`${prefix}_${o.v}`, on.has(o.v) ? '1' : '') })) };
  };
  if (fields.bosses) {
    const list = [...BOSSES].sort((x, y) => x.label.localeCompare(y.label)).map((b) => ({ v: b.key, label: b.label }));
    parts.push(gap(4), { t: 'fold', head: text(`Bosses you do${p.bosses?.length ? ` (${p.bosses.length})` : ''}`, 'white', { font: 'small' }), chev: true, c: checks('boss', list, p.bosses) });
  }
  if (fields.skills) {
    parts.push(gap(4), { t: 'fold', head: text(`Skills you train${p.skills?.length ? ` (${p.skills.length})` : ''}`, 'white', { font: 'small' }), chev: true, c: checks('skill', SKILL_KEYS.map((s) => ({ v: s, label: cap(s) })), p.skills) });
  }
  for (const q of questions) {
    const nodes = questionInputs(q, f ? answerOf(q, f) : p.answers?.[String(q.id)], typed);
    if (nodes.length) parts.push(gap(4), ...nodes);
  }
  if (fields.notes && typed) parts.push(gap(4), text('Anything else for the captains?', 'white', { font: 'small' }), { t: 'input', name: 'notes', kind: 'text', value: val('notes', p.notes ?? '') } as Node);

  const fee = event.signupFee ?? 0;
  if (fee > 0) parts.push(gap(6), small(`Entry ${fee.toLocaleString('en-US')} gp — the host tells you how to pay.`, CORAL, { wrap: CARD_W }));
  parts.push(gap(8), button(live.length ? 'Save' : 'Sign up', { a: 'post', act: 'event-signup', args: { event: String(eventId), back: a.back ?? '', backLabel: a.backLabel ?? '', clan: a.clan ?? '' } }));
  return { ui: card(parts) };
}

/** An old plugin draws no typed questions: what was typed on the site for them stays as it was. */
function keepTyped(questions: SurveyQuestionView[], prior: Record<string, unknown> | null | undefined, next: Record<string, unknown>) {
  const out = { ...next };
  for (const q of questions) if (q.type === 'text' && prior?.[String(q.id)] !== undefined) out[String(q.id)] = prior[String(q.id)];
  return out;
}

function hoursFrom(f: Args, key: string): HoursRange | undefined {
  const min = Number(f[`${key}_min`] ?? 0);
  const max = Number(f[`${key}_max`] ?? 0);
  if (!Number.isFinite(min) || !Number.isFinite(max) || (min <= 0 && max <= 0)) return undefined;
  return { min, max };
}

/** The panel's fields as the site form's body (lib/eventSignupSubmit SignupBody). */
function bodyFrom(f: Args, questions: SurveyQuestionView[]): NonNullable<SignupBody> {
  const ids = Object.keys(f).filter((k) => /^acct_\d+$/.test(k) && f[k] === '1').map((k) => Number(k.slice(5)));
  if (f.acct) ids.push(Number(f.acct));
  const keys = (prefix: string) => Object.keys(f).filter((k) => k.startsWith(`${prefix}_`) && f[k] === '1').map((k) => k.slice(prefix.length + 1));
  const profile: Record<string, unknown> = { bosses: keys('boss'), skills: keys('skill'), answers: answersFrom(questions, f) };
  for (const h of HOURS) {
    const r = hoursFrom(f, h.f);
    if (r) profile[h.key] = r;
  }
  if (f.tz) profile.timezone = f.tz;
  if (f.notes) profile.notes = f.notes;
  const team = Number(f.team);
  return { clanMemberIds: ids, profile, requestedTeamId: Number.isInteger(team) && team > 0 ? team : null };
}

/** Fields the site form would leave alone: a board whose form hides a section keeps what was there. */
function keepHidden(body: NonNullable<SignupBody>, prior: SignupProfile, shown: ReturnType<typeof parseEventRules>['signupFields'], typed: boolean) {
  const p = body.profile!;
  if (!shown.bosses) p.bosses = prior.bosses;
  if (!shown.skills) p.skills = prior.skills;
  if (!shown.timezone) p.timezone = prior.timezone;
  if (!shown.availability) for (const h of HOURS) p[h.key] = prior[h.key];
  if (!shown.notes || !typed) p.notes = prior.notes;
}

async function backHome(request: Request, a: Args, home: (r: Request, a: Args) => Promise<View>, note: string): Promise<View> {
  const v = await home(a.clan ? atClan(request, a.clan) : request, { open: a.back || `event:${a.event}`, ...(a.clan ? { clan: a.clan } : {}) });
  return { ...v, ui: col([text(note, 'done', { wrap: true }), gap(6), v.ui]) };
}

export async function bingoSignupAct(request: Request, a: Args, f: Args, home: (r: Request, a: Args) => Promise<View>): Promise<View> {
  const me = await who(request);
  if (!me) return bingoSignupForm(request, a, 'Sign in to the plugin first.', f);
  if (!(await rateLimit(request, `plugin-signup:${me.userId}`, { limit: 20, windowMs: 60_000 })).ok) return bingoSignupForm(request, a, 'Too many tries — give it a minute.', f);
  const eventId = Number(a.event);
  const event = await boardFor(a.clan ? atClan(request, a.clan) : request, eventId);
  if (!event) return bingoSignupForm(request, a, null, f);
  const questions = await boardQuestions(eventId);
  // The required questions, held to here: the site form asks for them before it sends.
  const checked = validateAnswers(questions, answersFrom(questions, f));
  if (!checked.ok) return bingoSignupForm(request, a, checked.error, f);
  const body = bodyFrom(f, questions);
  if (!body.clanMemberIds?.length) return bingoSignupForm(request, a, 'Pick the account to sign up with.', f);
  // The answers live on one row of the person's (the primary's); the others carry '{}'.
  const rows = await db.query.eventSignups.findMany({ where: and(eq(eventSignups.eventId, eventId), eq(eventSignups.userId, me.userId), inArray(eventSignups.status, ['pending', 'approved'])) });
  const prior = rows.find((r) => r.profileData && r.profileData !== '{}') ?? rows[0];
  const priorProfile = parseProfile(prior?.profileData);
  keepHidden(body, priorProfile, parseEventRules(event.rules).signupFields, hasTextInput(request));
  if (!hasTextInput(request)) (body.profile as { answers: Record<string, unknown> }).answers = keepTyped(questions, priorProfile.answers, body.profile!.answers as Record<string, unknown>);
  const res = await submitEventSignup({ userId: me.userId, playerId: me.playerId }, eventId, body);
  const out = (await res.json().catch(() => ({}))) as { error?: string; team?: { name: string } | null; held?: boolean };
  if (!res.ok) return bingoSignupForm(request, a, out.error ?? 'That didn’t go through — try again.', f);
  const note = prior ? 'Saved ✓' : out.team ? `You’re in ✓ — on ${out.team.name}` : 'You’re signed up ✓';
  return backHome(request, a, home, note);
}

export async function bingoWithdrawAct(request: Request, a: Args, home: (r: Request, a: Args) => Promise<View>): Promise<View> {
  const me = await who(request);
  if (!me) return { ui: card([muted('Sign in to the plugin first.')]) };
  const eventId = Number(a.event);
  const event = await boardFor(a.clan ? atClan(request, a.clan) : request, eventId);
  if (!event) return { ui: card([muted('That event isn’t here any more.')]) };
  const res = await withdrawEventSignup({ userId: me.userId, playerId: me.playerId }, eventId);
  const out = (await res.json().catch(() => ({}))) as { error?: string };
  return backHome(request, a, home, res.ok ? 'You’re off this one.' : out.error ?? 'That didn’t go through.');
}

// ---- A clan event with questions --------------------------------------------------------------------

export async function clanEventForm(request: Request, a: Args, error: string | null = null, typedIn: Args | null = null): Promise<View> {
  const back: Action = { a: 'load', v: 'home', args: { open: `clan-event:${a.id}`, clan: a.clan ?? '' } };
  const head = (name: string) => formHead(back, '‹ Back', name, error);
  const clan = await visibleClan(request, a.clan ?? '');
  const id = Number(a.id);
  const e = clan ? await liveClanEvent(clan.id, id) : null;
  if (!clan || !e) return { ui: card([...head('Sign up'), muted('That event isn’t on any more.', { wrap: true })]) };
  const me = await who(request);
  if (!me) return { ui: card([...head(e.title), muted('Sign in to the plugin to sign up.', { wrap: true })]) };
  const w = signupWindow(parseModules(e.modules), e, Date.now());
  if (!w.open) return { ui: card([...head(e.title), muted(w.reason, { wrap: true })]) };
  const typed = hasTextInput(request);
  const questions = await loadQuestions(clan.id, id, 'signup');
  const parts = head(e.title);
  if (needsSite(questions, typed)) {
    parts.push(muted('This sign-up asks for typed answers. Update the plugin to answer here, or sign up on the site.', { wrap: true }));
    return { ui: card(parts) };
  }
  const seats = await seatsFor(clan.id, me.playerId);
  const prior = await mySignup(clan.id, id, w.key, me.userId);
  if (seats.length > 1) {
    parts.push(text('Account', 'white', { font: 'small' }), { t: 'input', name: 'acct', kind: 'select', options: seats.map((s) => ({ v: String(s.id), label: s.rsn })), value: typedIn?.acct ?? String(prior?.clanMemberId ?? seats[0].id) });
  } else if (seats[0]) parts.push(muted(`Signing up as ${seats[0].rsn}`, { wrap: CARD_W }));
  for (const q of questions) {
    const nodes = questionInputs(q, typedIn ? answerOf(q, typedIn) : prior?.answers?.[String(q.id)], typed);
    if (nodes.length) parts.push(gap(4), ...nodes);
  }
  const live = prior && (prior.status === 'pending' || prior.status === 'approved');
  parts.push(gap(8), button(live ? 'Save' : 'Sign up', { a: 'post', act: 'clan-event-signup', args: { id: String(id), clan: a.clan ?? '' } }));
  return { ui: card(parts) };
}

export async function clanEventSignupAct(request: Request, a: Args, f: Args, home: (r: Request, a: Args) => Promise<View>): Promise<View> {
  const clan = await visibleClan(request, a.clan ?? '');
  const me = await who(request);
  if (!clan || !me) return clanEventForm(request, a, 'Sign in to the plugin first.', f);
  if (!(await canSeeClan({ clanId: clan.id, visibility: 'private', playerId: me.playerId, userId: me.userId }))) return clanEventForm(request, a, 'Only members of this clan can sign up.', f);
  if (!(await rateLimit(request, `plugin-clan-event-signup:${me.userId}`, { limit: 20, windowMs: 60_000 })).ok) return clanEventForm(request, a, 'Too many tries — give it a minute.', f);
  const id = Number(a.id);
  const questions = await loadQuestions(clan.id, id, 'signup');
  let answers: Record<string, unknown> = answersFrom(questions, f);
  if (!hasTextInput(request)) {
    const e = await liveClanEvent(clan.id, id);
    const w = e ? signupWindow(parseModules(e.modules), e, Date.now()) : null;
    const prior = w?.open ? await mySignup(clan.id, id, w.key, me.userId) : null;
    answers = keepTyped(questions, prior?.answers, answers);
  }
  const r = await signUp(clan.id, id, { ...me, displayName: null }, { clanMemberId: f.acct ? Number(f.acct) : undefined, answers });
  if (!r.ok) return clanEventForm(request, a, r.error, f);
  await refreshClanEventPost(clan.id, id);
  const v = await home(atClan(request, a.clan ?? ''), { clan: a.clan ?? '', open: `clan-event:${id}` });
  return { ...v, ui: col([text(r.value.status === 'pending' ? 'Signed up — waiting on the host.' : 'You’re signed up ✓', 'done', { wrap: true }), gap(6), v.ui]) };
}

// ---- A weekly: in or out, before it starts and while it runs ------------------------------------------

export async function weeklyEntryState(request: Request, competitionId: number): Promise<WeeklyEntryState | null> {
  const member = await resolvePluginMember(request).catch(() => null);
  if (!member || !(await competitionForClan(member.clanId, competitionId))) return null;
  const s = await entryStatus(competitionId, { accountId: member.accountId });
  return s.entered ? s : null;
}

export async function weeklyOptAct(request: Request, a: Args, home: (r: Request, a: Args) => Promise<View>): Promise<View> {
  const member = await resolvePluginMember(request).catch(() => null);
  const id = Number(a.id);
  const back = () => home(request, { open: `weekly:${id}` });
  if (!member) return { ui: card([muted('Sign in to the plugin first.')]) };
  if (!(await competitionForClan(member.clanId, id))) return back();
  if (!(await rateLimit(request, `plugin-weekly-opt:${member.accountId}`, { limit: 20, windowMs: 60_000 })).ok) return back();
  const r = await setOptOut(id, { accountId: member.accountId }, a.out === '1');
  const v = await back();
  return r.ok ? v : { ...v, ui: col([text(r.error, 'error', { wrap: true }), gap(6), v.ui]) };
}
