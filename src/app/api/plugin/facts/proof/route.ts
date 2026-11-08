import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { events, proofUploads, submissions, teams, tiles } from '@/db/schema';
import { verifyPluginTokenOnEvent } from '@/lib/auth';
import { readBody, storeImage } from '@/lib/pluginFacts/request';
import { attachedKeyMark, claimsWithSplit, decodePendingProof, parseProofKey, proofOverdue, PROOF_TOO_LATE } from '@/lib/proofAfter';
import { afterReply, participantName, stampAndPost, sweepOverdueProofs } from '@/lib/proofFinish';
import { rateLimit } from '@/lib/rate-limit';
import { countTileProgress } from '@/lib/submissions';
import { claimUploads } from '@/lib/uploadClaims';

export const dynamic = 'force-dynamic';

// POST /api/plugin/facts/proof — the screenshot for credits already filed (lib/proofAfter).
//
// multipart: `key` = the `proofKey` a POST /api/plugin/facts reply named, `file` = the dual-frame JPEG,
// `body` (optional) = JSON `{ proof: { split } }` — where the two stacked frames meet; the banner's
// words were settled with the credit. Answers:
//   200 { ok: true, attached: n }            stored, the stamp and the Discord post follow
//   200 { ok: true, attached: 0 }            already attached (a repeat upload): nothing to do. On attach
//                                            the key is replaced by a one-way tombstone (attachedKeyMark),
//                                            so it can never attach anything again; reversal deletes the row
//   410 { error }                            too late: those credits were reversed (or never existed)
//   400 / 401 / 404                          a bad key, no token, or not this caller's credits — for good
//   503                                      a passing failure (storage): send it again
//
// The key is the client's, so it only finds rows; the caller must be the very character (same token,
// seat and team) that filed every one of them, checked per event the way the filing was.

export async function POST(request: Request) {
  const receivedAt = Date.now();
  const rl = await rateLimit(request, 'plugin-proof', { limit: 120, windowMs: 60_000 });
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 });
  if (!request.headers.get('Authorization')?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { body, file, form } = await readBody(request);
  const key = parseProofKey(form?.get('key') ?? body?.key);
  if (!key) return Response.json({ error: 'A proof key is required' }, { status: 400 });

  // clan-scope: global -- found by an unguessable key, then every row is checked against the caller below.
  const rows = await db.select().from(submissions).where(eq(submissions.proofKey, key));
  if (rows.length === 0) {
    // Already attached (a retry whose first answer was lost): the key was swapped for its tombstone, so
    // this is answered ok and nothing is stored twice. No row either way: reversed, too late.
    const done = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.proofKey, attachedKeyMark(key))).limit(1);
    return done.length ? Response.json({ ok: true, attached: 0 }) : Response.json({ error: PROOF_TOO_LATE }, { status: 410 });
  }
  const waiting = rows.filter((r) => r.proofDueAt != null);

  // WHOSE ROWS. One facts request can file on several boards; each board's rows are checked under the
  // clan address they were filed with, and must be the caller's own seat and team there.
  const tileRows = await db.select().from(tiles).where(inArray(tiles.id, [...new Set(rows.map((r) => r.tileId))]));
  const tileById = new Map(tileRows.map((t) => [t.id, t]));
  const authed = new Map<number, { request: Request; playerId: number; teamId: number } | null>();
  for (const r of rows) {
    const tile = tileById.get(r.tileId);
    if (!tile) return Response.json({ error: 'Not found' }, { status: 404 });
    if (!authed.has(tile.eventId)) {
      const pending = decodePendingProof(r.proofPending);
      const headers = new Headers(request.headers);
      if (pending.clan) headers.set('x-anvil-clan-slug', pending.clan);
      const scoped = new Request(request.url, { method: 'POST', headers });
      const auth = await verifyPluginTokenOnEvent(scoped, tile.eventId);
      authed.set(tile.eventId, auth ? { request: scoped, playerId: auth.playerId, teamId: auth.teamId } : null);
    }
    const a = authed.get(tile.eventId);
    if (!a || a.teamId !== r.teamId || a.playerId !== r.playerId) return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Past the window: reversed now if the sweep hasn't yet, and too late either way.
  const late = waiting.filter((r) => proofOverdue(r.proofDueAt, receivedAt));
  if (late.length) await sweepOverdueProofs(receivedAt, late.length, late.map((r) => r.id));
  const live = waiting.filter((r) => !late.includes(r));
  if (live.length === 0) return Response.json({ error: PROOF_TOO_LATE }, { status: 410 });

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });
  const first = tileById.get(live[0].tileId)!;
  const stored = await storeImage(authed.get(first.eventId)!.request, file);
  if ('error' in stored) return Response.json({ error: stored.error }, { status: stored.status });
  const upload = await db.query.proofUploads.findFirst({ where: eq(proofUploads.url, stored.url) });
  await claimUploads([stored.url], first.eventId);

  // Attach: only rows STILL waiting (a sweep that got there first wins, and the row is gone).
  const attached = await db.update(submissions)
    .set({ imageUrl: stored.url, imageSha256: upload?.sha256 ?? null, proofKey: attachedKeyMark(key), proofDueAt: null, proofPending: null })
    .where(and(inArray(submissions.id, live.map((r) => r.id)), isNotNull(submissions.proofDueAt)))
    .returning();
  if (attached.length === 0) return Response.json({ error: PROOF_TOO_LATE }, { status: 410 });

  afterReply(async () => {
    for (const s of attached) {
      try {
        const tile = tileById.get(s.tileId)!;
        const pending = decodePendingProof(waiting.find((w) => w.id === s.id)?.proofPending);
        const [event, team, current, creditPlayerName] = await Promise.all([
          db.query.events.findFirst({ where: eq(events.id, tile.eventId), columns: { id: true, name: true, clanId: true } }),
          db.query.teams.findFirst({ where: eq(teams.id, s.teamId), columns: { id: true, name: true, color: true } }),
          countTileProgress(s.tileId, s.teamId, tile.trackingMode, tile),
          participantName(s.creditPlayerId),
        ]);
        if (!event || !team) continue;
        await stampAndPost({
          submissionId: s.id,
          clanId: event.clanId,
          event: { id: event.id, name: event.name },
          tile,
          team,
          claims: claimsWithSplit(pending.claims, body?.proof ?? body),
          imageUrl: stored.url,
          upload: upload ? { userId: upload.userId, sha256: upload.sha256 } : null,
          rsn: pending.rsn,
          receivedAt: pending.receivedAt,
          isCap: pending.cap,
          superseded: pending.superseded,
          completed: pending.completed,
          creditPlayerName,
          currentTotal: current.current,
          amount: s.amount,
          note: s.note,
          durationSeconds: s.durationSeconds,
        });
      } catch (e) {
        console.error('[plugin/facts/proof] after attach', e);
      }
    }
  });
  return Response.json({ ok: true, attached: attached.length });
}
