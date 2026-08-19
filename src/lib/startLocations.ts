// The built-in start-location pool for the STARTING SHOT (lib/startProof), split out from it so the
// admin's map picker — a client component — can read the list without pulling in node:crypto and the
// keyword secret with it.

import type { StartLocation } from '@/lib/eventRules';

/** How close counts when a spot carries coordinates, in game squares. */
export const DEFAULT_START_RADIUS = 25;

/**
 * Where players are sent for the shot. Towns and bank steps only — never next to stackable content.
 *
 * Every coordinate here was checked against the rendered world map (the pin lands on the building,
 * not the field next to it). Somewhere the pin couldn't be confirmed simply isn't in this list:
 * a wrong pin refuses honest players at the right place, which is worse than not checking at all.
 * Hosts pin their own spots on the map picker in the event's Starting-shot panel.
 */
export const START_LOCATIONS: readonly StartLocation[] = [
  { label: 'Lumbridge castle courtyard', x: 3222, y: 3218, radius: null },
  { label: 'Grand Exchange centre', x: 3164, y: 3487, radius: null },
  { label: 'Varrock fountain', x: 3213, y: 3429, radius: null },
  { label: 'Falador east bank', x: 3013, y: 3355, radius: null },
  { label: 'Draynor Village market', x: 3082, y: 3251, radius: null },
  { label: 'Al Kharid bank', x: 3269, y: 3167, radius: null },
  { label: 'Edgeville bank', x: 3094, y: 3491, radius: null },
  { label: 'Barbarian Village bridge', x: 3105, y: 3420, radius: null },
  { label: 'Port Sarim docks', x: 3029, y: 3217, radius: null },
  { label: 'Catherby bank', x: 2809, y: 3441, radius: null },
  { label: "Seers' Village bank", x: 2725, y: 3491, radius: null },
  { label: 'Camelot castle entrance', x: 2757, y: 3477, radius: null },
  // Sprawling landmarks get a wider circle — the instruction is the town, not the paving slab.
  { label: 'Ardougne market', x: 2655, y: 3305, radius: 40 },
  { label: 'Yanille bank', x: 2613, y: 3093, radius: null },
  { label: 'Burthorpe castle steps', x: 2899, y: 3565, radius: 40 },
  { label: 'Canifis bank', x: 3512, y: 3480, radius: null },
  { label: 'Shilo Village bank', x: 2852, y: 2954, radius: null },
  { label: 'Kourend castle courtyard', x: 1608, y: 3673, radius: 40 },
  { label: 'Hosidius farming patches', x: 1745, y: 3550, radius: 40 },
  { label: 'Piscarilius fishing docks', x: 1826, y: 3690, radius: 40 },
  { label: 'Woodcutting Guild entrance', x: 1591, y: 3475, radius: 40 },
  { label: 'Farming Guild entrance', x: 1249, y: 3720, radius: null },
];
