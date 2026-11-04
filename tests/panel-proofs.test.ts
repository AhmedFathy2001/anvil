// A tile's proofs in the plugin's side panel: who may delete one (lib/proofAccess, the web's rule),
// the list's shape (lib/pluginUi/proofsUi) and the signed picture links (lib/proofImage). Pure.
//
// Run: npm run test:panelproofs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canDeleteProof, isProofModerator, proofDeleterRole, type ProofDeleteCheck } from '../src/lib/proofAccess';
import type { Node } from '../src/lib/pluginUi/nodes';
import { PROOFS_MAX, PROOFS_STEP, type ProofRow, deleteAction, proofsUi } from '../src/lib/pluginUi/proofsUi';
import { proofImagePath, proofImageSig, proofImageSigOk } from '../src/lib/proofImage';

const base: ProofDeleteCheck = { userId: 7, playerIds: [70], managers: new Set([1]), grant: null, submission: { playerId: 70 } };

test('the submitter may delete their own proof, and nobody else’s', () => {
  assert.equal(canDeleteProof(base), true);
  assert.equal(canDeleteProof({ ...base, submission: { playerId: 71 } }), false);
  assert.equal(canDeleteProof({ ...base, submission: { playerId: null } }), false, 'an orphaned row is staff’s');
  assert.equal(canDeleteProof({ ...base, playerIds: [] }), false, 'no seat on the event, no own proofs');
});

test('the team’s captain or staff may delete any of the team’s proofs', () => {
  const other = { ...base, submission: { playerId: 99 } };
  assert.equal(canDeleteProof({ ...other, managers: new Set([7]) }), true);
  assert.equal(proofDeleterRole({ ...other, managers: new Set([7]) }, { captainUserId: 7 }), 'captain');
  assert.equal(proofDeleterRole({ ...other, managers: new Set([7]) }, { captainUserId: 3 }), 'team staff');
  assert.equal(canDeleteProof({ ...other, userId: null, managers: new Set([7]) }), false, 'no login, no seat');
});

test('host-clan moderators and up delete anything; board-scoped grants and members do not', () => {
  const other = { ...base, submission: { playerId: 99 }, managers: new Set<number>() };
  for (const role of ['moderator', 'treasurer', 'admin', 'owner']) assert.equal(canDeleteProof({ ...other, grant: { role } }), true, role);
  assert.equal(canDeleteProof({ ...other, grant: { role: 'member' } }), false);
  assert.equal(canDeleteProof({ ...other, grant: { role: 'treasurer', treasurerScope: 'assigned' } }), false);
  assert.equal(isProofModerator({ role: 'editor', editorScope: 'all' }), true);
  assert.equal(isProofModerator({ role: 'editor', editorScope: 'assigned' }), false);
  assert.equal(proofDeleterRole({ ...other, grant: { role: 'admin' } }, null), 'admin');
});

const row = (id: number, extra: Partial<ProofRow> = {}): ProofRow => ({
  id,
  who: 'Alice',
  credit: null,
  team: 'Red',
  at: '2026-11-01T10:00:00.000Z',
  amount: 1,
  thumb: `/api/plugin/proof-image/${id}?t=1&s=x`,
  full: `/api/plugin/proof-image/${id}?s=x`,
  canDelete: false,
  ...extra,
});
const opts = { args: { ev: '5', tile: '9', event: '0', q: '', status: 'all', page: '0', pre: '' }, n: PROOFS_STEP, more: false, images: true, unit: ' KC', teams: false };

function all(n: Node, out: Node[] = []): Node[] {
  out.push(n);
  const any = n as unknown as Record<string, unknown>;
  for (const k of ['c', 'l', 'r']) {
    const v = any[k];
    if (Array.isArray(v)) v.forEach((x) => all(x as Node, out));
    else if (v && typeof v === 'object' && 't' in (v as object)) all(v as Node, out);
  }
  return out;
}

test('a plugin that draws images gets a thumbnail that opens the full picture on the site', () => {
  const nodes = all(proofsUi([row(1)], opts, 'none'));
  const img = nodes.find((n) => n.t === 'img') as Extract<Node, { t: 'img' }>;
  assert.ok(img);
  assert.equal(img.src, '/api/plugin/proof-image/1?t=1&s=x');
  assert.deepEqual([img.w, img.h], [64, 40]);
  assert.deepEqual(img.on, { a: 'site', path: '/api/plugin/proof-image/1?s=x' });
});

test('an older plugin never gets an image node — the picture is a link instead', () => {
  const nodes = all(proofsUi([row(1)], { ...opts, images: false }, 'none'));
  assert.equal(nodes.some((n) => n.t === 'img'), false);
  assert.ok(nodes.some((n) => n.t === 'text' && n.s === 'View screenshot' && n.on?.a === 'site'));
});

test('delete is offered only where allowed, asks first, and answers with the tile again', () => {
  const none = all(proofsUi([row(1)], opts, 'none'));
  assert.equal(none.some((n) => n.on?.a === 'post'), false);
  const yes = all(proofsUi([row(1, { canDelete: true })], opts, 'none'));
  const del = yes.find((n) => n.on?.a === 'post')!.on as Extract<NonNullable<Node['on']>, { a: 'post' }>;
  assert.equal(del.act, 'proof-delete');
  assert.equal(del.into, 'tiles');
  assert.ok(del.ask);
  assert.equal(del.args?.id, '1');
  assert.equal(del.args?.part, 'rows');
  assert.equal(del.args?.tile, '9');
  assert.equal('n' in (deleteAction({ ...opts.args, n: '12' }, 1) as { args: object }).args, false);
});

test('six at a time: "Show more" loads the next six into the same slot, up to the cap', () => {
  const six = Array.from({ length: PROOFS_STEP }, (_, i) => row(i + 1));
  const more = all(proofsUi(six, { ...opts, more: true }, 'none')).find((n) => n.t === 'button');
  assert.deepEqual(more?.on, { a: 'load', v: 'proofs', args: { ...opts.args, n: String(PROOFS_STEP * 2) }, into: 'proofs' });
  assert.equal(all(proofsUi(six, { ...opts, more: false }, 'none')).some((n) => n.t === 'button'), false);
  assert.equal(all(proofsUi(six, { ...opts, more: true, n: PROOFS_MAX }, 'none')).some((n) => n.t === 'button'), false);
});

test('an empty list keeps its heading and says why', () => {
  const nodes = all(proofsUi([], opts, 'Proofs show for your own team.'));
  assert.ok(nodes.some((n) => n.t === 'text' && n.s === 'Proofs'));
  assert.ok(nodes.some((n) => n.t === 'text' && n.s === 'Proofs show for your own team.'));
});

test('picture links are signed to the submission AND its image, so a new picture is a new link', () => {
  const sig = proofImageSig(4, 'https://media.example/a.webp');
  assert.equal(proofImageSigOk(4, 'https://media.example/a.webp', sig), true);
  assert.equal(proofImageSigOk(5, 'https://media.example/a.webp', sig), false);
  assert.equal(proofImageSigOk(4, 'https://media.example/b.webp', sig), false);
  assert.equal(proofImageSigOk(4, 'https://media.example/a.webp', null), false);
  assert.equal(proofImageSigOk(4, 'https://media.example/a.webp', 'short'), false);
  assert.match(proofImagePath(4, 'https://media.example/a.webp'), /^\/api\/plugin\/proof-image\/4\?t=1&s=[\w-]{22}$/);
  assert.match(proofImagePath(4, 'https://media.example/a.webp', true), /^\/api\/plugin\/proof-image\/4\?s=[\w-]{22}$/);
});
