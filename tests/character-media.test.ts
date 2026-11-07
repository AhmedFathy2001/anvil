// Per-character avatar/banner overrides (account_media), the pure half: which part comes from the
// character and which from the person, and the same tier gating as the person's own media.
//
// Run: node --import tsx --test tests/character-media.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  characterMediaOverrides,
  characterMediaRow,
  isProfileMediaUrl,
  shownCharacterMedia,
  type ProfileMediaRowLike,
} from '../src/lib/profileMediaRules.ts';
import { mediaRevision } from '../src/lib/pluginUi/mediaRevision.ts';

const BASE = 'https://media.example.com';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = (n: number) => `${BASE}/profiles/7/${uuid(n)}.webp`;
const acct = (n: number, accountId = 42) => `${BASE}/profiles/accounts/${accountId}/${uuid(n)}.webp`;

const PERSON: ProfileMediaRowLike = {
  avatarUrl: person(1),
  avatarStillUrl: person(2),
  bannerUrl: person(3),
  bannerStillUrl: person(4),
  bannerPosition: 20,
};
const EMPTY: ProfileMediaRowLike = { avatarUrl: null, avatarStillUrl: null, bannerUrl: null, bannerStillUrl: null, bannerPosition: null };

test('account override objects are our own media URLs; look-alikes are not', () => {
  assert.equal(isProfileMediaUrl(acct(1), BASE), true);
  assert.equal(isProfileMediaUrl(`${BASE}/profiles/accounts/x/${uuid(1)}.webp`, BASE), false);
  assert.equal(isProfileMediaUrl(`${BASE}/profiles/accounts/42/extra/${uuid(1)}.webp`, BASE), false);
  assert.equal(isProfileMediaUrl(`https://evil.example.net/profiles/accounts/42/${uuid(1)}.webp`, BASE), false);
});

test('no override: the person\'s media, unchanged', () => {
  assert.deepEqual(characterMediaRow(null, PERSON, BASE), PERSON);
  assert.deepEqual(characterMediaRow(EMPTY, PERSON, BASE), PERSON);
  assert.equal(characterMediaRow(null, null, BASE), null);
});

test('banner-only override keeps the person\'s avatar, and brings its own focal point', () => {
  const own = { ...EMPTY, bannerUrl: acct(5), bannerStillUrl: acct(6), bannerPosition: 80 };
  assert.deepEqual(characterMediaOverrides(own, BASE), { avatar: false, banner: true });
  const row = characterMediaRow(own, PERSON, BASE)!;
  assert.equal(row.avatarStillUrl, PERSON.avatarStillUrl);
  assert.equal(row.bannerStillUrl, acct(6));
  assert.equal(row.bannerPosition, 80);
  // A null focal point on the override is centred, not the person's.
  assert.equal(characterMediaRow({ ...own, bannerPosition: null }, PERSON, BASE)!.bannerPosition, null);
});

test('avatar-only override keeps the person\'s banner and its position', () => {
  const own = { ...EMPTY, avatarUrl: acct(7), avatarStillUrl: acct(8) };
  const row = characterMediaRow(own, PERSON, BASE)!;
  assert.equal(row.avatarUrl, acct(7));
  assert.equal(row.bannerStillUrl, PERSON.bannerStillUrl);
  assert.equal(row.bannerPosition, 20);
});

test('both parts overridden; works when the person has uploaded nothing', () => {
  const own = { avatarUrl: acct(1), avatarStillUrl: acct(2), bannerUrl: acct(3), bannerStillUrl: acct(4), bannerPosition: 10 };
  assert.deepEqual(characterMediaRow(own, PERSON, BASE), own);
  assert.deepEqual(characterMediaRow(own, null, BASE), own);
});

test('an override part that is not our object falls back to the person\'s', () => {
  const own = { ...EMPTY, avatarUrl: 'https://evil.example.net/x.webp', avatarStillUrl: 'https://evil.example.net/x.webp' };
  assert.deepEqual(characterMediaOverrides(own, BASE), { avatar: false, banner: false });
  assert.equal(characterMediaRow(own, PERSON, BASE)!.avatarStillUrl, PERSON.avatarStillUrl);
});

test('tier gating: animated override for Champion/Patron, still frame otherwise and in lists', () => {
  const own = { ...EMPTY, avatarUrl: acct(1), avatarStillUrl: acct(2) };
  for (const tier of ['champion', 'patron'] as const) {
    const m = shownCharacterMedia(own, PERSON, tier, { publicBase: BASE });
    assert.deepEqual(m.avatar, { src: acct(1), still: acct(2), animated: true });
    assert.deepEqual(m.banner, { src: person(3), still: person(4), animated: true, position: 20 });
  }
  for (const tier of [null, 'supporter'] as const) {
    const m = shownCharacterMedia(own, PERSON, tier, { publicBase: BASE });
    assert.deepEqual(m.avatar, { src: acct(2), still: acct(2), animated: false }, 'lapsed keeps the still');
    assert.equal(m.banner?.src, person(4));
  }
  const listed = shownCharacterMedia(own, PERSON, 'patron', { still: true, publicBase: BASE });
  assert.equal(listed.avatar?.animated, false);
  assert.equal(listed.avatar?.src, acct(2));
});

test('the panel media revision changes when an override appears, changes or its focal point moves', () => {
  const rev = (row: ProfileMediaRowLike | null) => {
    const m = shownCharacterMedia(row, PERSON, 'champion', { publicBase: BASE });
    return mediaRevision(m.avatar?.src, m.banner?.src, m.banner ? `p${m.banner.position}` : null);
  };
  const base = rev(null);
  const withBanner = rev({ ...EMPTY, bannerUrl: acct(5), bannerStillUrl: acct(6), bannerPosition: 50 });
  const moved = rev({ ...EMPTY, bannerUrl: acct(5), bannerStillUrl: acct(6), bannerPosition: 70 });
  const withAvatar = rev({ ...EMPTY, avatarUrl: acct(7), avatarStillUrl: acct(8) });
  assert.equal(new Set([base, withBanner, moved, withAvatar]).size, 4);
  assert.equal(rev(EMPTY), base, 'clearing the override goes back to the default\'s revision');
});
