import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withOtherCharacters } from '../src/lib/personLabel';

test('one character stays as is', () => assert.equal(withOtherCharacters('dead person', 0), 'dead person'));
test('one other character', () => assert.equal(withOtherCharacters('dead person', 1), 'dead person and 1 other character'));
test('several other characters', () => assert.equal(withOtherCharacters('dead person', 3), 'dead person and 3 other characters'));
