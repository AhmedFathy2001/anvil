import { Readable, PassThrough } from 'node:stream';
import archiver from 'archiver';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  clanRoster,
  completions,
  eventParticipants,
  eventSignups,
  eventStartProofs,
  events,
  payouts,
  signupFees,
  submissions,
  teams,
  tiles,
} from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { eventForRequest } from '@/lib/eventScope';
import { log } from '@/lib/logger';
import { csvOf, safeName, archiveIndexHtml, type ArchiveProof } from '@/lib/eventArchive';
import { isExpiredProof } from '@/lib/eventMediaRetentionRules';
import { isManagedMediaUrl } from '@/lib/storage';

// The whole event as one zip, for the clan's own records: the board, teams, every completion and
// submission with who, when and for what, the payouts and fees — and every proof image, filed by tile
// and team, with an index.html to browse it offline. Proof images are deleted 90 days after an event
// ends (lib/eventMediaRetention); this is how a clan keeps them. After that the zip still carries all
// the records, and says which proofs had already been deleted.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Images fetched at once while zipping. The zip streams; this only bounds the outgoing requests. */
const FETCH_CONCURRENCY = 6;

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await verifyAdminOrModerator())) return new Response('Unauthorized', { status: 401 });
  const { eventId } = await params;
  const id = Number(eventId);
  if (!Number.isInteger(id) || !(await eventForRequest(request, id))) return new Response('Not found', { status: 404 });

  // clan-scope: global -- eventForRequest above settled that this event is the caller's clan's.
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) return new Response('Not found', { status: 404 });

  const [tileRows, teamRows, players, completionRows, payoutRows, startRows, signupRows] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, id)),
    db
      .select({ id: eventParticipants.id, name: eventParticipants.name, teamId: eventParticipants.teamId })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, id)),
    db
      .select()
      .from(completions)
      .innerJoin(tiles, eq(tiles.id, completions.tileId))
      .where(eq(tiles.eventId, id)),
    db.select().from(payouts).where(eq(payouts.eventId, id)),
    db.select().from(eventStartProofs).where(eq(eventStartProofs.eventId, id)),
    // clan-scope: this clan -- sign-ups of the one event eventForRequest settled; the roster join only names them.
    db
      .select({ id: eventSignups.id, status: eventSignups.status, signedUpAt: eventSignups.signedUpAt, rsn: clanRoster.rsn })
      .from(eventSignups)
      .leftJoin(clanRoster, eq(clanRoster.id, eventSignups.clanMemberId))
      .where(eq(eventSignups.eventId, id)),
  ]);
  const tileIds = tileRows.map((t) => t.id);
  const signupIds = signupRows.map((s) => s.id);
  const [subRows, feeRows] = await Promise.all([
    tileIds.length ? db.select().from(submissions).where(inArray(submissions.tileId, tileIds)) : Promise.resolve([]),
    signupIds.length ? db.select().from(signupFees).where(inArray(signupFees.signupId, signupIds)) : Promise.resolve([]),
  ]);

  const tileById = new Map(tileRows.map((t) => [t.id, t]));
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const signupById = new Map(signupRows.map((s) => [s.id, s]));
  const tileName = (tileId: number) => {
    const t = tileById.get(tileId);
    return t ? `${String(t.position + 1).padStart(2, '0')} ${t.label}` : `tile ${tileId}`;
  };
  const teamName = (teamId: number | null) => (teamId != null ? teamById.get(teamId)?.name ?? `team ${teamId}` : 'No team');
  const playerName = (pid: number | null) => (pid != null ? playerById.get(pid)?.name ?? `player ${pid}` : '');

  // Every image the zip should carry, with where it goes inside it.
  const proofs: ArchiveProof[] = [];
  for (const s of subRows) {
    if (!s.imageUrl) continue;
    const who = playerName(s.creditPlayerId ?? s.playerId) || 'unknown';
    proofs.push({
      kind: 'submission',
      url: s.imageUrl,
      path: `proofs/${safeName(tileName(s.tileId))}/${safeName(teamName(s.teamId))}/${safeName(`${s.createdAt.slice(0, 16).replace(':', '')} ${who} #${s.id}`)}`,
      tileId: s.tileId,
      teamId: s.teamId,
      caption: `${who} · ${s.createdAt}${s.note ? ` · ${s.note}` : ''}`,
    });
  }
  for (const p of startRows) {
    proofs.push({
      kind: 'start',
      url: p.imageUrl,
      path: `start-proofs/${safeName(teamName(p.teamId))}/${safeName(`${p.rsn ?? playerName(p.playerId)} #${p.id}`)}`,
      teamId: p.teamId ?? undefined,
      caption: `${p.rsn ?? playerName(p.playerId)} · starting shot`,
    });
  }
  for (const p of payoutRows) {
    if (!p.proofBlobUrl) continue;
    proofs.push({
      kind: 'payout',
      url: p.proofBlobUrl,
      path: `payouts/${safeName(`${p.place != null ? `#${p.place} ` : ''}${p.teamName ?? p.rsn ?? ''} ${p.id}`)}`,
      caption: `Payout ${p.amount.toLocaleString('en-US')} gp → ${p.rsn ?? p.teamName ?? ''}`,
    });
  }
  for (const f of feeRows) {
    if (!f.proofBlobUrl) continue;
    proofs.push({
      kind: 'fee',
      url: f.proofBlobUrl,
      path: `fees/${safeName(`${signupById.get(f.signupId)?.rsn ?? 'signup'} #${f.id}`)}`,
      caption: `Sign-up fee ${f.amount.toLocaleString('en-US')} gp`,
    });
  }

  const origin = new URL(request.url).origin;
  const zip = archiver('zip', { zlib: { level: 1 } }); // images are already compressed; spend no CPU on them
  const out = new PassThrough();
  zip.on('warning', (e) => log.warn('event-archive.warning', { eventId: id, error: e.message }));
  zip.on('error', (e) => {
    log.warn('event-archive.failed', { eventId: id, error: e.message });
    out.destroy(e);
  });
  zip.pipe(out);

  // Fill the zip in the background; the response streams as entries are added.
  void (async () => {
    // Images first, so the index knows which ones made it in.
    const queue = [...proofs];
    await Promise.all(
      Array.from({ length: FETCH_CONCURRENCY }, async () => {
        while (queue.length) {
          const p = queue.shift()!;
          if (isExpiredProof(p.url)) {
            p.status = 'deleted';
            continue;
          }
          // Only our own stored files are fetched. A URL from anywhere else is listed in the index as
          // a link but never requested from the server — fetching it would let a stored URL make this
          // box call any address it can reach.
          if (!isManagedMediaUrl(p.url)) {
            p.status = 'external';
            continue;
          }
          try {
            const res = await fetch(new URL(p.url, origin), { signal: AbortSignal.timeout(20_000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const type = res.headers.get('content-type') ?? '';
            const ext = /png/.test(type) ? 'png' : /jpe?g/.test(type) ? 'jpg' : /gif/.test(type) ? 'gif' : /mp4/.test(type) ? 'mp4' : 'webp';
            p.file = `${p.path}.${ext}`;
            zip.append(Buffer.from(await res.arrayBuffer()), { name: p.file });
            p.status = 'ok';
          } catch {
            p.status = 'missing';
          }
        }
      }),
    );

    const json = {
      exportedAt: new Date().toISOString(),
      note: 'Anvil event archive. Proof images are kept on Anvil for 90 days after an event ends; this file keeps them for good.',
      event,
      teams: teamRows,
      participants: players,
      tiles: tileRows,
      completions: completionRows.map((r) => r.completions),
      submissions: subRows.map((s) => ({ ...s, image: proofs.find((p) => p.kind === 'submission' && p.url === s.imageUrl)?.file ?? null })),
      payouts: payoutRows,
      signups: signupRows,
      fees: feeRows,
      startProofs: startRows,
    };
    zip.append(JSON.stringify(json, null, 2), { name: 'event.json' });
    zip.append(
      csvOf(
        ['position', 'label', 'type', 'points', 'description'],
        tileRows.map((t) => [t.position + 1, t.label, t.tileType, t.points, t.description]),
      ),
      { name: 'tiles.csv' },
    );
    zip.append(
      csvOf(
        ['team', 'tile', 'completed_at', 'credited_to', 'points'],
        completionRows.map(({ completions: c }) => [teamName(c.teamId), tileName(c.tileId), c.completedAt, playerName(c.creditPlayerId), c.awardedPoints]),
      ),
      { name: 'completions.csv' },
    );
    zip.append(
      csvOf(
        ['id', 'submitted_at', 'team', 'tile', 'player', 'amount', 'note', 'image'],
        subRows.map((s) => [
          s.id,
          s.createdAt,
          teamName(s.teamId),
          tileName(s.tileId),
          playerName(s.creditPlayerId ?? s.playerId),
          s.amount,
          s.note,
          proofs.find((p) => p.kind === 'submission' && p.url === s.imageUrl)?.file ?? (s.imageUrl && isExpiredProof(s.imageUrl) ? 'deleted after 90 days' : ''),
        ]),
      ),
      { name: 'submissions.csv' },
    );
    zip.append(
      csvOf(['team', 'player'], players.map((p) => [teamName(p.teamId), p.name])),
      { name: 'teams.csv' },
    );
    zip.append(
      archiveIndexHtml({
        eventName: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        tiles: tileRows.map((t) => ({ id: t.id, name: tileName(t.id) })).sort((a, b) => a.name.localeCompare(b.name)),
        teams: teamRows,
        completions: completionRows.map(({ completions: c }) => ({ teamId: c.teamId, tileId: c.tileId })),
        proofs,
      }),
      { name: 'index.html' },
    );
    await zip.finalize();
  })().catch((e) => {
    log.warn('event-archive.failed', { eventId: id, error: (e as Error).message });
    out.destroy(e as Error);
  });

  const filename = `${safeName(event.name)} - Anvil archive.zip`;
  return new Response(Readable.toWeb(out) as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
