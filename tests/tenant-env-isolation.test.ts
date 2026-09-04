// Per-clan identity must never come from the environment.
//
// An environment variable configures a BOX. A guild id, an invite link, a role id and a clan name
// identify ONE clan. While the readers for those fell back to env vars, every clan on a managed
// instance inherited the operator's: a real customer clan (guild unset, role + nickname sync on)
// was pointed at the operator's Discord server, its admin panel reported it "connected as Anvil in
// <operator's guild>", and its roles-and-channels picker listed the operator's channels. The
// interaction router had the same fallback, so a slash command from ANY unbound guild resolved to
// the operator's clan — contradicting that function's own docstring.
//
// Five readers had it independently, which is what makes this a rule rather than a fix: the
// fallback always looks like a harmless convenience at the call site, and it is only wrong when you
// know how many clans the process serves.
//
// The one legitimate reader is lib/clanCreate, which COPIES env into the first clan's settings once
// at creation, so a self-hosted single-clan instance still configures itself from its env file —
// visibly, on the settings page, instead of via an invisible default that outranked it.
//
// Run: npm run test:tenantenv

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Env vars that name something belonging to a single clan. */
const PER_CLAN = [
  'DISCORD_GUILD_ID',
  'DISCORD_INVITE_URL',
  'DISCORD_MEMBER_ROLE_ID',
  'CLAN_NAME',
  'CLAN_INGAME_NAME',
];

/** Writes it into one clan's settings on purpose; see the file for why that is the safe shape. */
const ALLOWED = ['src/lib/clanCreate.ts'];

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('no per-clan value is read from the environment', () => {
  const offenders: string[] = [];

  for (const file of sources('src')) {
    const rel = file.replace(/\\/g, '/');
    if (ALLOWED.includes(rel)) continue;
    const text = readFileSync(file, 'utf8');

    text.split('\n').forEach((line, i) => {
      // Comments explain the rule and cite the variables by name — they are not reads.
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      for (const name of PER_CLAN) {
        if (code.includes(`process.env.${name}`)) {
          offenders.push(`${rel}:${i + 1} reads ${name}`);
        }
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `Per-clan identity read from the environment — every clan on the instance would inherit the ` +
      `operator's:\n  ${offenders.join('\n  ')}\n\n` +
      `Read it from that clan's settings instead (lib/discord-roles clanGuildId is the shape).`,
  );
});
