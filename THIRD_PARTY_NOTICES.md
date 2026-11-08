# Third-party notices

Anvil bundles or derives from third-party work whose licences require attribution. Those notices are
collected here, in one place, so the rest of the codebase can stay about Anvil.

---

## Game data (drop tables, kill rates, XP rates)

Drop-rate tables (`src/data/npcDrops.json`), the rate tables in `src/data/hourRates.json` and
`src/data/activityRates.json`, and related game datasets are derived from the Old School RuneScape
Wiki (via its Bucket API, money-making guides and skill training guides). Each rate in
`hourRates.json` names the wiki page it came from.

- **Source:** Old School RuneScape Wiki — <https://oldschool.runescape.wiki>
- **Licence:** CC BY-SA 3.0

The item sprites in `public/og/sprites/` (the art on the platform's link card) come from the same
wiki, enlarged without smoothing.

---

## Fonts on the link cards

`public/og/fonts/` holds the Latin subsets of Fraunces and Geist / Geist Mono, the faces the site
already loads from Google Fonts, bundled so the server can draw them onto link cards.

- **Fraunces:** © The Fraunces Project Authors — <https://github.com/undercasetype/Fraunces>
- **Geist, Geist Mono:** © Vercel — <https://github.com/vercel/geist-font>
- **Licence:** SIL Open Font License 1.1 — <https://openfontlicense.org>

---

Old School RuneScape is a trademark of Jagex Ltd. Anvil is not affiliated with or endorsed by Jagex.
