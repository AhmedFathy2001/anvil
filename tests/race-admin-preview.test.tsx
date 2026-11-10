// The admin previews draw a tile race as the members' race map (roads), never the old numbered
// snake — a fresh board with no roads laid out included.
//
// Run: npx tsx --test tests/race-admin-preview.test.tsx

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import EventBoard from '../src/components/EventBoard.tsx';

const tiles = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, eventId: 16, position: i, label: `Tile ${i + 1}`, tileType: 'standard', raceStep: null, raceNext: null }));

function render(raceLayout?: 'full' | 'track') {
  return renderToString(
    <EventBoard format="tilerace" boardSize={10} tiles={tiles as never} completions={[]} teams={[]} onTileClick={() => {}} raceLayout={raceLayout} />,
  );
}

test('the admin preview (raceLayout="full") draws a race with no steps as the race map', () => {
  const html = render('full');
  assert.match(html, /aria-label="Race route map"/);
  // One road from start to finish: the step names along the top, not a numbered track.
  assert.match(html, />Start</);
  assert.match(html, />Finish</);
  // Every tile is a clickable waypoint.
  for (const t of tiles) assert.ok(html.includes(`title="${t.label}"`), t.label);
});

test('without a layout, an unlaid race still falls back to the snake (member surfaces not moved yet)', () => {
  assert.doesNotMatch(render(), /aria-label="Race route map"/);
});

test('the Map view: the editable race map, blank tiles marked, shapes as cards, the open tile selected', async () => {
  const { default: RaceRouteEditor } = await import('../src/app/admin/events/[eventId]/tiles/RaceRouteEditor.tsx');
  const written = tiles.map((t, i) => (i === 0 ? { ...t, label: 'Zenyte shard', tileType: 'drop', trackedItemIds: '[19529]' } : t));
  const html = renderToString(
    <RaceRouteEditor
      eventId={16}
      tiles={written as never}
      eventStarted={false}
      raceBank={false}
      raceRoad="achieve"
      onTileCreated={() => {}}
      onSaved={() => {}}
      onRaceBankChanged={() => {}}
      onOpenTile={() => {}}
      openTileId={101}
      panelBeside
    />,
  );
  assert.match(html, /aria-label="Race route map"/);
  // Nine blank tiles read as not written yet; the written one does not.
  assert.equal(html.match(/not written yet<\/span>/g)?.length, 9);
  for (const shape of ['Diamond', 'Two roads', 'Braid', 'Straight line']) assert.ok(html.includes(`>${shape}<`), shape);
  // The tile open in the panel is selected on the map, with its road actions in the strip.
  assert.match(html, />Split into 2 roads</);
  assert.match(html, />Remove</);
  // A "+" between every pair of steps, plus before the start and after the finish.
  assert.equal(html.match(/aria-label="Add a tile (before the start|after the finish|between step)/g)?.length, 11);
});
