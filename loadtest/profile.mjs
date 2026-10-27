#!/usr/bin/env node
/**
 * Caddy access logs → loadtest/.out/profile.json (+ a readable summary on stdout).
 *
 *   node loadtest/profile.mjs access.log access-2026-10-25.log.gz \
 *     [--host '^(anvilosrs\.com|.*\.anvilosrs\.com)$'] [--from 2026-10-25T18:00Z] [--to 2026-10-25T23:00Z] \
 *     [--out loadtest/.out/profile.json]
 *
 * Pick the window on purpose. A profile of a quiet Tuesday makes k6 model quiet Tuesdays; run once
 * without --from/--to, read the hourly table, then re-run on the busiest event evening.
 * The beta host shares the box's Caddy — leave it out with --host unless beta is what's being modelled.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { entryFromCaddy, profileBuilder } from './profile-core.mjs';
import { routeMatcher, routeTableFromApp } from './routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const files = [];
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
  else files.push(args[i]);
}
if (files.length === 0) {
  console.error('usage: node loadtest/profile.mjs <access.log[.gz]>... [--host re] [--from iso] [--to iso] [--out file]');
  process.exit(1);
}

const table = routeTableFromApp(opt.app ?? path.join(here, '..', 'src', 'app'));
const secs = (iso) => (iso ? Date.parse(iso) / 1000 : null);
const builder = profileBuilder({
  match: routeMatcher(table),
  hostRe: opt.host ? new RegExp(opt.host) : null,
  from: secs(opt.from),
  to: secs(opt.to),
});

let lines = 0;
let bad = 0;
for (const file of files) {
  let stream = fs.createReadStream(file);
  if (file.endsWith('.gz')) stream = stream.pipe(zlib.createGunzip());
  for await (const line of readline.createInterface({ input: stream, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    lines++;
    let json;
    try {
      json = JSON.parse(line);
    } catch {
      bad++;
      continue;
    }
    // Raw tokens or cookies in the log means the Caddy filter is not doing its job. Stop, loudly:
    // this file should not exist in that state, let alone be summarised.
    const h = json?.request?.headers;
    const auth = h?.Authorization?.[0];
    const cookie = h?.Cookie?.[0];
    if ((auth && /^Bearer\s/i.test(auth)) || (cookie && cookie.includes('='))) {
      console.error(`[profile] ${file}: a credential header (Authorization / Cookie) is in the clear. Fix the Caddy log filter (loadtest/README.md) and delete this log.`);
      process.exit(2);
    }
    builder.add(entryFromCaddy(json));
  }
}

const profile = builder.finish();
const out = opt.out ?? path.join(here, '.out', 'profile.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(profile, null, 2));

// ── Summary ───────────────────────────────────────────────────────────────────────────────────
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
const all = profile.totals.plugin + profile.totals.web + profile.totals.bot + profile.totals.asset;
console.log(`[profile] ${lines} lines (${bad} unparseable, ${profile.skipped} filtered) → ${out}`);
console.log(`window ${profile.window.from} → ${profile.window.to} (${profile.window.minutes} min)`);
console.log(
  `requests: plugin ${profile.totals.plugin} (${pct(profile.totals.plugin, all)}) · web ${profile.totals.web} (${pct(profile.totals.web, all)}) · ` +
    `bot ${profile.totals.bot} · asset ${profile.totals.asset}`,
);
for (const cls of ['plugin', 'web']) {
  const c = profile.classes[cls];
  console.log(`${cls.padEnd(6)} sessions ${c.sessions} · present peak ${c.present.peak} / p95 ${c.present.p95} / median ${c.present.median}`);
}
if (profile.peakMinute) {
  const p = profile.peakMinute;
  console.log(`peak minute ${p.at}: ${p.requests} req (${p.rps} rps) with ${p.present.plugin} plugin + ${p.present.web} web present`);
}
console.log(`sockets: ${profile.sockets.total} closed, peak held ${profile.sockets.peakHeld}`);

console.log('\nhourly (pick a window):');
for (const h of profile.hourly) {
  console.log(`  ${h.hour.slice(0, 13)}h  plugin ${String(h.plugin).padStart(7)}  web ${String(h.web).padStart(6)}  present ${h.peakPresent.plugin}p/${h.peakPresent.web}w`);
}

console.log('\ntop routes:');
console.log('  count      share   /actor-min   p50ms   p95ms  304     route');
for (const r of profile.routes.slice(0, 30)) {
  console.log(
    `  ${String(r.count).padStart(8)}  ${pct(r.count, all).padStart(6)}  ${String(r.perActorMinute ?? '-').padStart(10)}  ` +
      `${String(r.p50ms).padStart(6)}  ${String(r.p95ms).padStart(6)}  ${pct(r.status['304'] ?? 0, r.count).padStart(5)}  [${r.cls}] ${r.key}`,
  );
}
const unmatched = profile.routes.filter((r) => r.kind === 'unmatched');
if (unmatched.length) {
  console.log(`\n${unmatched.length} unmatched path shape(s) (probes, removed routes): ${unmatched.slice(0, 8).map((r) => r.key).join(', ')}`);
}
