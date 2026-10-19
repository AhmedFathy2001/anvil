'use client';

import { createContext } from 'react';

/**
 * Where the tile editor's lookups (item, NPC and combat-achievement search) live. Inside a clan
 * that's /api/admin; the Anvil library editor on the apex has no clan, so it points the editor at
 * /api/library, which serves the same handlers to library editors.
 */
export const AuthoringApiContext = createContext<string>('/api/admin');
