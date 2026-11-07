import { test } from 'node:test';
import assert from 'node:assert/strict';

import { profileLinkState } from '../src/lib/profileLink.ts';

test('a display-case collection page opens the Collection tab, with or without an explicit tab', () => {
  assert.deepEqual(profileLinkState({ tab: 'collection', page: 'Chambers of Xeric' }), {
    tab: 'collection',
    stat: undefined,
    page: 'Chambers of Xeric',
  });
  assert.deepEqual(profileLinkState({ page: 'Chambers of Xeric' }), {
    tab: 'collection',
    stat: undefined,
    page: 'Chambers of Xeric',
  });
});

test('unknown tabs cannot override a collection page destination', () => {
  assert.deepEqual(profileLinkState({ tab: 'nope', page: ['Zulrah', 'Other'] }), {
    tab: 'collection',
    stat: undefined,
    page: 'Zulrah',
  });
});
