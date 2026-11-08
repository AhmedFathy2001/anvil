import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { pluginPanelImage } from '../src/lib/pluginPanelMedia.ts';
import { clanCardUi } from '../src/lib/pluginUi/clanUi.ts';
import type { ClanCard } from '../src/lib/clanCard.ts';

process.env.S3_PUBLIC_BASE_URL = 'https://media.example.com/b';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function animated(fmt: 'gif' | 'webp') {
  const W = 120, H = 60, n = 3;
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(await sharp({ create: { width: W, height: H, channels: 3, background: { r: i * 90, g: 60, b: 60 } } }).raw().toBuffer());
  return sharp(Buffer.concat(frames), { raw: { width: W, height: H * n, channels: 3, pageHeight: H } })[fmt]({ loop: 0, delay: [80, 80, 80] }).toBuffer();
}

async function served(buf: Buffer, w: number, h: number, motion: boolean) {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response(new Uint8Array(buf), { headers: { 'content-length': String(buf.length) } })) as typeof fetch;
  try {
    const r = await pluginPanelImage('https://media.example.com/b/x', w, h, motion, 50);
    return { r, bytes: Buffer.from(await r.arrayBuffer()) };
  } finally {
    globalThis.fetch = real;
  }
}

test('without motion an animated GIF or WebP is served as its first frame, a PNG', async () => {
  for (const fmt of ['gif', 'webp'] as const) {
    const { r, bytes } = await served(await animated(fmt), 36, 36, false);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.deepEqual(bytes.subarray(0, 4), PNG);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, 36);
    assert.equal(meta.height, 36);
  }
});

test('with motion the same upload is served as an animated GIF', async () => {
  const { r, bytes } = await served(await animated('webp'), 220, 73, true);
  assert.equal(r.headers.get('content-type'), 'image/gif');
  assert.ok(((await sharp(bytes, { animated: true }).metadata()).pages ?? 1) > 1);
});

const card = (boostLevel: number): ClanCard => ({
  slug: 'afk', name: 'AFK', kind: 'clan', logoUrl: 'https://media.example.com/b/l.webp', bannerUrl: 'https://media.example.com/b/b.webp',
  boostLevel, members: 3, activeThisWeek: 1, weekHours: 0, totalEhp: 0, totalEhb: 0, topWeek: [], topPlayers: [], clog: null, highlights: [], competitions: [],
}) as unknown as ClanCard;

test('the clan card carries the banner and the logo as panel media paths, unboosted too', () => {
  for (const level of [0, 2]) {
    const json = JSON.stringify(clanCardUi(card(level), false, true, true, true));
    assert.match(json, /"src":"\/api\/plugin\/media\/clan\/afk\?kind=banner&v=[^"]+&level=\d"/);
    assert.match(json, /"src":"\/api\/plugin\/media\/clan\/afk\?kind=logo&v=[^"]+&level=\d"/);
    assert.ok(!json.includes('media.example.com'), 'storage URLs never reach the plugin');
  }
  assert.ok(!JSON.stringify(clanCardUi(card(0), false, true, true, false)).includes('"t":"img"'), 'no images for a plugin that cannot draw them');
});

test('a source that cannot be served answers 404 and logs why', async () => {
  const warn = console.warn;
  const lines: string[] = [];
  console.warn = (m: string) => void lines.push(String(m));
  try {
    const { r } = await served(Buffer.from('not an image'), 36, 36, false);
    assert.equal(r.status, 404);
    const foreign = await pluginPanelImage('https://elsewhere.example.org/x.webp', 36, 36, false);
    assert.equal(foreign.status, 404);
  } finally {
    console.warn = warn;
  }
  assert.ok(lines.some((l) => l.includes('decode failed')));
  assert.ok(lines.some((l) => l.includes('S3_PUBLIC_BASE_URL')));
});
