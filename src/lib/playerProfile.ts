import { db } from '@/db';
import { getSetting } from '@/lib/settings';
import { events, eventParticipants, playerSnapshots, playerEventFacts, clanRoster } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import defaultMarkers from '@/data/capabilityMarkers.json';

export const CAPABILITY_MARKERS_SETTING_KEY = 'capability_markers';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The longitudinal player profile (balance-engine plan B2/B4): a pre-event rating per person built
// from capability markers (hiscores snapshot), grind volume (KC breadth×depth + XP stock), recent
// activity (KC/XP deltas between consecutive event snapshots — flow, the strongest signal), and
// prior-event evidence (player_event_facts points, recency-decayed, shrinkage-blended).
//
// Constants are the v5 backtest values, validated on the July Bingo (2.2% mean team-share miss vs
// 6.3% uniform baseline, 4/6 exact ranks). Semantics that came out of that tuning and are NOT
// negotiable without a re-backtest:
//   - lifetime XP is STOCK (weak, 25% of volume, cubed); XP gained is FLOW (half of activity).
//   - unknown activity imputes the pool MEDIAN — never the player's own stock.
//   - unearned evidence weight flows to capability, the honest prior.
//   - reliability discounts events where the person's team collapsed (environmental, not personal).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const SHRINK_K = 2;
const DECAY_HALF_LIFE_DAYS = 180;
const CAP_WEIGHT = 0.35;
const VOLUME_WEIGHT = 0.15;
const ACTIVITY_WEIGHT = 0.3;
const EVIDENCE_WEIGHT = 0.2;

export interface CapabilityMarker {
  key: string;
  label: string;
  domain: string;
  weight: number;
  fullKc: number;
}

/** Curated markers ⊕ per-clan `capability_markers` setting override (merged by key). */
export async function loadCapabilityMarkers(clanId: number): Promise<CapabilityMarker[]> {
  const base = (defaultMarkers as { markers: CapabilityMarker[] }).markers;
  try {
    const value = await getSetting(clanId, CAPABILITY_MARKERS_SETTING_KEY);
    if (!value) return base;
    const parsed = JSON.parse(value) as { markers?: CapabilityMarker[] };
    if (!Array.isArray(parsed.markers)) return base;
    const byKey = new Map(base.map((m) => [m.key, m]));
    for (const m of parsed.markers) {
      if (m && typeof m.key === 'string') byKey.set(m.key, { ...byKey.get(m.key), ...m } as CapabilityMarker);
    }
    return [...byKey.values()];
  } catch {
    return base;
  }
}

// ── snapshot parsing (tolerant of every historical payload shape) ──────────────────────────────

function parseBosses(json: string | null | undefined): Record<string, number> {
  if (!json) return {};
  try {
    const snap = JSON.parse(json) as Record<string, unknown>;
    const bosses = (snap.bosses ?? snap) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, raw] of Object.entries(bosses)) {
      const kc = typeof raw === 'number' ? raw : Number((raw as { score?: number })?.score ?? 0);
      if (Number.isFinite(kc) && kc > 0) out[key] = kc;
    }
    return out;
  } catch {
    return {};
  }
}

function parseOverallXp(json: string | null | undefined): number {
  if (!json) return 0;
  try {
    const snap = JSON.parse(json) as Record<string, unknown>;
    const skills = (snap.skills ?? snap) as Record<string, unknown>;
    const xp = Number((skills?.overall as { xp?: number } | undefined)?.xp ?? 0);
    return Number.isFinite(xp) && xp > 0 ? xp : 0;
  } catch {
    return 0;
  }
}

const volumeScore = (bosses: Record<string, number>): number =>
  Object.values(bosses).reduce((v, kc) => v + Math.log1p(kc), 0);

// ── profile output ─────────────────────────────────────────────────────────────────────────────

export interface PlayerProfile {
  personKey: string;
  rsn: string; // lead display name
  clanMemberId: number | null;
  userId: number | null;
  playerIds: number[]; // this event's player rows (empty for clan-wide pools)
  teamId: number | null;
  rating: number; // 0..~1, normalized within the rated pool
  /** How much history backs the rating: 'wide' (0 events), 'medium' (1), 'tight' (2+). */
  band: 'wide' | 'medium' | 'tight';
  capability: number;
  capabilityMarkers: { key: string; label: string; domain: string; kc: number }[];
  domains: string[]; // domains where any marker is hit — team-coverage view
  volume: number;
  xpStock: number;
  /** KC-volume / XP gained since the previous event snapshot; null = no prior snapshot. */
  activityKc: number | null;
  activityXp: number | null;
  /** Recency-decayed avg points per prior event; 0 with no history. */
  evidence: number;
  evidenceEvents: number;
  /** 0..1 attendance signal from facts (activeDays/eventDays), collapse-discounted. Null = no history. */
  reliability: number | null;
  subbedOutBefore: boolean;
}

interface PoolMember {
  personKey: string;
  rsn: string;
  clanMemberId: number | null;
  userId: number | null;
  playerIds: number[];
  teamId: number | null;
  snapshotJson: string | null;
}

const normalizeRsn = (name: string) => name.toLowerCase().replaceAll('-', ' ').replaceAll('_', ' ').trim();

/**
 * Rate a pool of people. Two pool shapes:
 *  - eventId set: every player row of that event (drafted or not) — the draft/pre-start view.
 *  - no eventId: every active, non-guest clan member with a stored snapshot — the clan-wide view.
 */
export async function computePlayerProfiles(clanId: number, opts: { eventId?: number } = {}): Promise<PlayerProfile[]> {
  const markers = await loadCapabilityMarkers(clanId);
  const members = await db
    .select({
      id: clanRoster.id,
      accountId: clanRoster.accountId,
      userId: clanRoster.playerId,
      rsn: clanRoster.rsn,
      rsnNormalized: clanRoster.rsnNormalized,
      previousRsns: clanRoster.previousRsns,
      leftAt: clanRoster.leftAt,
      kind: clanRoster.kind,
    })
    .from(clanRoster)
    // THIS clan's roster. Without the filter this loaded every clan's members and rated a pool drawn
    // from the whole platform — and it is why the snapshot read below matched nothing until the ids
    // were also corrected: it was groping a global table with this clan's seat ids.
    .where(eq(clanRoster.clanId, clanId));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const memberByAlias = new Map<string, (typeof members)[number]>();
  for (const m of members) {
    const aliases = [m.rsnNormalized];
    try {
      const prev = JSON.parse(m.previousRsns ?? '[]');
      if (Array.isArray(prev)) aliases.push(...prev.map((r) => normalizeRsn(String(r))));
    } catch {
      /* ignore */
    }
    for (const a of aliases) if (a && !memberByAlias.has(a)) memberByAlias.set(a, m);
  }
  const personKeyOfMember = (m: { id: number; userId: number | null }) =>
    m.userId != null ? `u${m.userId}` : `m${m.id}`;

  // ── assemble the pool ──
  const pool = new Map<string, PoolMember>();
  let eventStartIso: string | null = null;
  if (opts.eventId != null) {
    // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to their own.
    const event = await db.query.events.findFirst({ where: eq(events.id, opts.eventId) });
    eventStartIso = event?.startDate ?? null;
    const roster = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, opts.eventId));
    for (const p of roster) {
      const member = p.clanMemberId != null ? memberById.get(p.clanMemberId) : memberByAlias.get(normalizeRsn(p.name));
      const key = member ? personKeyOfMember(member) : `n${normalizeRsn(p.name)}`;
      let entry = pool.get(key);
      if (!entry) {
        pool.set(
          key,
          (entry = {
            personKey: key,
            rsn: p.name,
            clanMemberId: member?.id ?? null,
            userId: member?.userId ?? null,
            playerIds: [],
            teamId: p.teamId,
            snapshotJson: null,
          }),
        );
      }
      entry.playerIds.push(p.id);
      if (entry.teamId == null && p.teamId != null) entry.teamId = p.teamId;
      // Merge multi-account snapshots by taking the richer one for capability and summing XP later
      // is overkill here — the enrollment snapshot of the LEAD (first) account is the profile body,
      // and extra accounts contribute via facts history instead.
      if (!entry.snapshotJson && p.statsSnapshot) entry.snapshotJson = p.statsSnapshot;
    }
  } else {
    const active = members.filter((m) => !m.leftAt && m.kind !== 'guest');
    // Keyed by ACCOUNT — player_snapshots is account-keyed, and filtering it by seat ids (m.id) found
    // nothing, so every clan-wide profile came back with a null baseline snapshot.
    const snapRows = active.length
      ? await db
          .select({
            accountId: playerSnapshots.accountId,
            payload: playerSnapshots.payload,
            capturedAt: playerSnapshots.capturedAt,
          })
          .from(playerSnapshots)
          .where(inArray(playerSnapshots.accountId, active.map((m) => m.accountId)))
          .orderBy(desc(playerSnapshots.capturedAt))
      : [];
    const latestByAccount = new Map<number, string>();
    for (const r of snapRows) if (!latestByAccount.has(r.accountId)) latestByAccount.set(r.accountId, r.payload);
    for (const m of active) {
      const key = personKeyOfMember(m);
      if (pool.has(key)) continue; // alts collapse onto the linked user
      pool.set(key, {
        personKey: key,
        rsn: m.rsn,
        clanMemberId: m.id,
        userId: m.userId,
        playerIds: [],
        teamId: null,
        snapshotJson: latestByAccount.get(m.accountId) ?? null,
      });
    }
  }
  if (pool.size === 0) return [];

  // ── prior snapshots (activity baselines) + facts (evidence + reliability) ──
  // A person's baseline = their most recent enrollment snapshot from an event that STARTED before
  // the pool's reference time (the event's start, or now for clan-wide pools).
  const referenceIso = eventStartIso ?? new Date().toISOString();
  // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to their own.
  const allEvents = await db.select({ id: events.id, startDate: events.startDate }).from(events);
  const priorEventIds = allEvents
    .filter((e) => e.startDate && e.startDate < referenceIso && e.id !== opts.eventId)
    .map((e) => e.id);
  const startByEvent = new Map(allEvents.map((e) => [e.id, e.startDate]));

  const priorRows = priorEventIds.length
    ? await db
        .select({
          eventId: eventParticipants.eventId,
          name: eventParticipants.name,
          clanMemberId: eventParticipants.clanMemberId,
          statsSnapshot: eventParticipants.statsSnapshot,
        })
        .from(eventParticipants)
        .where(inArray(eventParticipants.eventId, priorEventIds))
    : [];
  const baselineByPerson = new Map<string, { vol: number; xp: number; startDate: string }>();
  for (const r of priorRows) {
    if (!r.statsSnapshot) continue;
    const member =
      r.clanMemberId != null ? memberById.get(r.clanMemberId) : memberByAlias.get(normalizeRsn(r.name));
    const key = member ? personKeyOfMember(member) : `n${normalizeRsn(r.name)}`;
    const startDate = startByEvent.get(r.eventId) ?? '';
    const existing = baselineByPerson.get(key);
    if (existing && existing.startDate >= (startDate ?? '')) continue; // keep the most recent baseline
    const bosses = parseBosses(r.statsSnapshot);
    baselineByPerson.set(key, {
      vol: volumeScore(bosses),
      xp: parseOverallXp(r.statsSnapshot),
      startDate: startDate ?? '',
    });
  }

  const facts = await db.select().from(playerEventFacts);
  const factsByPerson = new Map<string, typeof facts>();
  for (const f of facts) {
    if (opts.eventId != null && f.eventId === opts.eventId) continue; // strictly prior evidence
    const start = startByEvent.get(f.eventId);
    if (!start || start >= referenceIso) continue;
    const arr = factsByPerson.get(f.personKey);
    if (arr) arr.push(f);
    else factsByPerson.set(f.personKey, [f]);
  }

  // ── per-person raw signals ──
  interface Raw extends PoolMember {
    cap: number;
    capHits: PlayerProfile['capabilityMarkers'];
    vol: number;
    xp: number;
    actKc: number | null;
    actXp: number | null;
    evidence: number;
    evidenceEvents: number;
    reliability: number | null;
    subbedOutBefore: boolean;
  }
  const raws: Raw[] = [];
  for (const person of pool.values()) {
    const bosses = parseBosses(person.snapshotJson);
    let cap = 0;
    const capHits: PlayerProfile['capabilityMarkers'] = [];
    for (const m of markers) {
      const kc = bosses[m.key] ?? 0;
      if (kc <= 0) continue;
      const ramp = Math.min(1, Math.log1p(kc) / Math.log1p(Math.max(2, m.fullKc)));
      cap += m.weight * (0.3 + 0.7 * ramp);
      capHits.push({ key: m.key, label: m.label, domain: m.domain, kc });
    }
    const vol = volumeScore(bosses);
    const xp = parseOverallXp(person.snapshotJson);
    const baseline = baselineByPerson.get(person.personKey);
    const actKc = baseline ? Math.max(0, vol - baseline.vol) : null;
    const actXp = baseline && xp > 0 ? Math.max(0, xp - baseline.xp) : null;

    // Evidence: recency-decayed points per prior event. Reliability: attendance share, with a
    // collapse discount — a bottom-ranked team at <35% of the winner's points demoralizes; those
    // events count at 30% weight so the ghosting reads as environmental.
    const personFacts = factsByPerson.get(person.personKey) ?? [];
    let evidence = 0;
    let wsum = 0;
    let relSum = 0;
    let relW = 0;
    let subbedOutBefore = false;
    for (const f of personFacts) {
      const start = startByEvent.get(f.eventId) ?? referenceIso;
      const ageDays = Math.max(0, (Date.parse(referenceIso) - Date.parse(start!)) / 86_400_000);
      const w = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
      evidence += w * f.points;
      wsum += w;
      if (f.subbedOut) subbedOutBefore = true;
      if (f.eventDays && f.eventDays > 0) {
        const collapsed =
          f.teamRank != null &&
          f.teamsTotal != null &&
          f.teamRank === f.teamsTotal &&
          (f.topTeamPoints ?? 0) > 0 &&
          (f.teamPoints ?? 0) < 0.35 * (f.topTeamPoints ?? 0);
        const rw = w * (collapsed ? 0.3 : 1);
        relSum += rw * Math.min(1, f.activeDays / f.eventDays);
        relW += rw;
      }
    }
    raws.push({
      ...person,
      cap,
      capHits,
      vol,
      xp,
      actKc,
      actXp,
      evidence: wsum > 0 ? evidence / wsum : 0,
      evidenceEvents: personFacts.length,
      reliability: relW > 0 ? relSum / relW : null,
      subbedOutBefore,
    });
  }

  // ── normalize + v5 blend ──
  const max = (xs: number[]) => Math.max(1e-9, ...xs);
  const capMax = max(raws.map((r) => r.cap));
  const volMax = max(raws.map((r) => r.vol));
  const xpMax = max(raws.map((r) => r.xp));
  const actKcMax = max(raws.map((r) => r.actKc ?? 0));
  const actXpMax = max(raws.map((r) => r.actXp ?? 0));
  const evMax = max(raws.map((r) => r.evidence));
  const actBlendOf = (r: Raw): number | null =>
    r.actKc == null && r.actXp == null ? null : 0.5 * ((r.actKc ?? 0) / actKcMax) + 0.5 * ((r.actXp ?? 0) / actXpMax);
  const measured = raws.map(actBlendOf).filter((v): v is number => v != null).sort((a, b) => a - b);
  const medianAct = measured.length ? measured[Math.floor(measured.length / 2)] : 0;

  const profiles: PlayerProfile[] = raws.map((r) => {
    const evTrust = r.evidenceEvents / (r.evidenceEvents + SHRINK_K);
    const evW = EVIDENCE_WEIGHT * evTrust;
    const capW = CAP_WEIGHT + (EVIDENCE_WEIGHT - evW);
    const volBlend = 0.75 * Math.pow(r.vol / volMax, 3) + 0.25 * Math.pow(r.xp / xpMax, 3);
    const actBlend = actBlendOf(r) ?? medianAct;
    const rating =
      capW * (r.cap / capMax) + VOLUME_WEIGHT * volBlend + ACTIVITY_WEIGHT * actBlend + evW * (r.evidence / evMax);
    return {
      personKey: r.personKey,
      rsn: r.rsn,
      clanMemberId: r.clanMemberId,
      userId: r.userId,
      playerIds: r.playerIds,
      teamId: r.teamId,
      rating,
      band: r.evidenceEvents >= 2 ? 'tight' : r.evidenceEvents === 1 ? 'medium' : 'wide',
      capability: r.cap,
      capabilityMarkers: r.capHits.sort((a, b) => b.kc - a.kc),
      domains: [...new Set(r.capHits.map((h) => h.domain))],
      volume: r.vol,
      xpStock: r.xp,
      activityKc: r.actKc,
      activityXp: r.actXp,
      evidence: r.evidence,
      evidenceEvents: r.evidenceEvents,
      reliability: r.reliability,
      subbedOutBefore: r.subbedOutBefore,
    };
  });
  return profiles.sort((a, b) => b.rating - a.rating);
}
