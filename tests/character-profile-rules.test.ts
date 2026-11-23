import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickProfileCharacter, profileSections, type ProfileSectionInput } from '../src/lib/characterProfileRules';

const base: ProfileSectionInput = {
  context: 'clan',
  viewerOwns: false,
  signedIn: true,
  personId: 7,
  owner: { banned: false, linkAccountsPublicly: false },
};

test('clan-only sections never reach the public profile', () => {
  const pub = profileSections({ ...base, context: 'public' });
  assert.equal(pub.clanSections, false);
  assert.equal(pub.persona, false);
  assert.equal(pub.platformHeader, true);
  const clan = profileSections({ ...base });
  assert.equal(clan.clanSections, true);
  assert.equal(clan.persona, true);
  assert.equal(clan.platformHeader, false);
});

test('persona needs a signed-in viewer', () => {
  assert.equal(profileSections({ ...base, signedIn: false }).persona, false);
});

test('owner pictures show unless the owner is banned', () => {
  assert.equal(profileSections(base).personMedia, true);
  assert.equal(profileSections({ ...base, owner: { banned: false, linkAccountsPublicly: true } }).personMedia, true);
  assert.equal(profileSections({ ...base, owner: { banned: true, linkAccountsPublicly: true } }).personMedia, false);
  assert.equal(profileSections({ ...base, viewerOwns: true }).personMedia, true);
  assert.equal(profileSections({ ...base, personId: null, viewerOwns: true }).personMedia, false);
});

test('connected streams follow the "show me as one person" switch, or the owner', () => {
  assert.equal(profileSections(base).personStreams, false);
  assert.equal(profileSections({ ...base, owner: { banned: false, linkAccountsPublicly: true } }).personStreams, true);
  assert.equal(profileSections({ ...base, viewerOwns: true }).personStreams, true);
});

test('the display case needs a person', () => {
  assert.equal(profileSections(base).displayCase, true);
  assert.equal(profileSections({ ...base, personId: null }).displayCase, false);
});

test('editing and the /p/ switcher are the owner’s', () => {
  assert.equal(profileSections(base).ownerControls, false);
  assert.equal(profileSections({ ...base, viewerOwns: true }).ownerControls, true);
  assert.equal(profileSections({ ...base, viewerOwns: true }).publicSwitcher, false, 'the locker switches with its card');
  assert.equal(profileSections({ ...base, context: 'public', viewerOwns: true }).publicSwitcher, true);
});

test('the locker shows the picked character, else the main, else the first', () => {
  const seats = [
    { rsn: 'Alt', isPrimary: false },
    { rsn: 'Main', isPrimary: true },
  ];
  assert.equal(pickProfileCharacter(seats, 'Alt')?.rsn, 'Alt');
  assert.equal(pickProfileCharacter(seats, 'Somebody else')?.rsn, 'Main');
  assert.equal(pickProfileCharacter(seats, null)?.rsn, 'Main');
  assert.equal(pickProfileCharacter([{ rsn: 'Only', isPrimary: false }], null)?.rsn, 'Only');
  assert.equal(pickProfileCharacter([], null), null);
});

test('a person\'s own banner/avatar shows on their characters by default; streams still need public linking', async () => {
  const { personMediaVisible, personSectionsVisible } = await import('../src/lib/characterProfileRules.ts');
  const quiet = { personId: 7, owner: { banned: false, linkAccountsPublicly: false }, viewerOwns: false };
  assert.equal(personMediaVisible(quiet), true);
  assert.equal(personSectionsVisible(quiet), false);
  assert.equal(personMediaVisible({ ...quiet, owner: { banned: true, linkAccountsPublicly: true } }), false);
  assert.equal(personMediaVisible({ ...quiet, personId: null }), false);
});

