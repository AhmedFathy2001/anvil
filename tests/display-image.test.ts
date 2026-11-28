import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discordAttachment, discordAttachmentKey, discordExpiry, discordLinkStale, displayImageUrl } from '@/lib/displayImage';

const LINK = 'https://cdn.discordapp.com/attachments/1327520062655037482/1576025403762671863/anvil-drop.png?ex=6b0b6b89&is=6b0a1a09&hm=05d9';

test('only Discord attachment links over https are taken', () => {
  assert.ok(discordAttachment(LINK));
  assert.ok(discordAttachment(LINK.replace('cdn.discordapp.com', 'media.discordapp.net')));
  assert.ok(discordAttachment('https://cdn.discordapp.com/ephemeral-attachments/1/2/x.png?ex=1'));
  assert.equal(discordAttachment('http://cdn.discordapp.com/attachments/1/2/x.png'), null);
  assert.equal(discordAttachment('https://cdn.discordapp.com/avatars/1/abc.png'), null);
  assert.equal(discordAttachment('https://cdn.discordapp.com.evil.com/attachments/1/2/x.png'), null);
  assert.equal(discordAttachment('https://user:pw@cdn.discordapp.com/attachments/1/2/x.png'), null);
  assert.equal(discordAttachment('https://cdn.discordapp.com:8443/attachments/1/2/x.png'), null);
  assert.equal(discordAttachment('https://cdn.discordapp.com/attachments/1/2/../../x.png'), null);
  assert.equal(discordAttachment('javascript:alert(1)'), null);
  assert.equal(discordAttachment(null), null);
});

test('expiry comes from ex= (hex seconds); unsigned links never go stale', () => {
  const url = discordAttachment(LINK)!;
  assert.equal(discordExpiry(url), 0x6b0b6b89 * 1000);
  assert.equal(discordLinkStale(url, 0x6b0b6b89 * 1000 + 1), true);
  assert.equal(discordLinkStale(url, 0x6b0b6b89 * 1000 - 3 * 60 * 60 * 1000), false);
  assert.equal(discordLinkStale(discordAttachment('https://cdn.discordapp.com/attachments/1/2/x.png')!, Date.now()), false);
  assert.equal(discordAttachmentKey(url), 'cdn.discordapp.com/attachments/1327520062655037482/1576025403762671863/anvil-drop.png');
});

test('the display helper routes only Discord attachments through the refresher', () => {
  assert.equal(displayImageUrl(LINK), `/api/discord-image?u=${encodeURIComponent(LINK)}`);
  assert.equal(displayImageUrl('https://i.imgur.com/x.png'), 'https://i.imgur.com/x.png');
  assert.equal(displayImageUrl(null), null);
});
