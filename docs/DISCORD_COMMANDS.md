# Discord slash commands

Anvil's bot answers `/bingo …` inside a clan's Discord server: the board, the standings, the rules,
your own card. Everything it answers is read-only, and it needs no login — Discord already vouched
for who typed the command, and `users.discord_id` is Anvil's identity column.

```
/bingo board          the board that's running right now
/bingo rules          how this board scores + your clan's house rules
/bingo leaderboard    team standings
/bingo me             your team, your tiles, your standing
/bingo team [name]    a team card — score, roster, recent tiles
```

Every answer is **ephemeral** (only the person who ran it sees it) unless they pass `share: true`.
A bot that dumps a leaderboard into general every time someone is curious gets muted.

---

## Why slash commands and not `!bingo`

| Syntax | What it needs | Status |
| --- | --- | --- |
| `/bingo` | An HTTPS endpoint Discord POSTs to. No persistent process, no intents. | **What Anvil does** |
| `@anvil bingo` | A gateway WebSocket. No privileged intent — mentions are exempt from the message-content gate. | Possible, needs a daemon |
| `!bingo` | A gateway **and** the Message Content privileged intent. | Avoided |

Message Content is privileged: past 100 servers an app must apply to Discord for it, with "I want to
read every message looking for `!`" as the justification — the exact pattern slash commands were
introduced to replace. Building on an intent that can be revoked is a bad foundation.

The gateway is also the wrong shape for Anvil. A clan runs as its own container, so a gateway bot
means either one WebSocket per clan or a new always-on daemon that then has to fan back into each
clan. An HTTP endpoint is just another route in an app that already exists.

---

## How a command reaches the right clan

The awkward part is that **a Discord application has exactly one interactions URL**, no matter how
many servers its bot is in. Managed clans share one Anvil application, so every managed clan's
commands arrive at the same URL and something has to tell them apart.

```
                    ┌──────────────────────────────────────────┐
   /bingo board     │ Anvil.Admin  /api/discord/interactions    │
  ───────────────►  │  1. verify Ed25519 (shared app key)      │
   (shared app)     │  2. guild_id → clans.discordGuildId      │
                    │  3. forward with clanDiscordSecret(slug) │
                    └───────────────────┬──────────────────────┘
                                        │  internal Docker network
                                        ▼
                    ┌──────────────────────────────────────────┐
   /bingo board     │ Anvil.Site  /api/discord/interactions     │
  ───────────────►  │  verify Ed25519 (own app key) OR trust    │
   (own app)        │  the control plane's derived secret       │
                    │  → handleCommand()                        │
                    └──────────────────────────────────────────┘
```

**Managed clans** (shared bot): Discord → control plane → clan container. The control plane verifies
the signature once, resolves the guild, and forwards the verified payload with the clan's derived
secret (`clanDiscordSecret(slug)`, same construction as the cron secret). If a clan doesn't answer
within 2.2s the control plane sends a deferred ack and patches the real answer in afterwards, so a
mid-deploy container blip doesn't show the member "the application did not respond".

**Self-hosted / bring-your-own-bot clans**: their own application posts straight to their own site,
which verifies the signature itself against that application's `verify_key` (fetched once from
`GET /applications/@me` and cached — nobody types it).

Both land in the same `handleCommand`, so a command behaves identically however the clan is hosted.

---

## Context: which clan, which board, who else is in it

A Discord command carries less context than a web request — no session, no host header, no page you
were already on. `lib/discordContext.ts` re-establishes three things before any command answers:

1. **Which clan.** The site knows its own `discord_guild_id` and refuses anything else, even if the
   control plane routed it here. A routing bug that served clan A's board into clan B's Discord
   would leak a private board to the wrong clan, so it's checked twice.
2. **Which board.** Running first, then the soonest upcoming, then the most recently ended.
3. **Who else is in it.** An Anvil event isn't always one clan's — federation lets other clans'
   members join. Teams carrying visiting players are marked 🤝 on the standings, whole visiting
   teams are named, and every embed carries a subtext line naming the clan and the board so a
   screenshot is never ambiguous about whose leaderboard it is.

A visiting player is a roster row with `source: 'federation'` — specifically **not** `isGuest`,
which on a normal roster is mostly friends and alts. Their home clan is not recorded anywhere (the
`/exchange` path stores only that they arrived through federation), so Anvil reports how many are
visiting and which teams they're on, never which clan they came from. Naming the clans needs a
home-instance column on `clan_members`.

Unrevealed boards stay unrevealed: no tile names anywhere, and team cards refuse outright. Discord
is a member-facing surface with no way to prove a staff role, so it shows what a member would see.

---

## Setting it up

### 1. Invite the bot with the right scope

Slash commands need the **`applications.commands`** scope, which is granted separately from `bot`.
A bot invited with `bot` alone sits in the server working perfectly and shows no commands at all,
with nothing in the UI explaining why.

The invite link on **Admin → Integrations → Discord bot** now requests both. Clans onboarded through
the hosted setup wizard already have it. A clan that used an older invite link re-opens that link
and re-authorizes — it doesn't kick the bot, reset permissions, or disturb any channels.

### 2. Point the application at the endpoint

In the Discord developer portal, set **Interactions Endpoint URL** on the application:

| Setup | URL |
| --- | --- |
| Managed clans (shared Anvil app) | `https://<control-plane>/api/discord/interactions` |
| Self-host / own bot | `https://<your-anvil>/api/discord/interactions` |

Discord validates the URL by sending a PING plus deliberately **invalid** signatures; it only
accepts the URL if the bad ones get a 401. Both routes do exactly that.

### 3. Register the commands

```bash
npm run discord:commands                 # global — every server, up to ~1h to appear
npm run discord:commands -- --guild <id> # one server, instantly (use this while testing)
npm run discord:commands -- --clear      # remove them again
```

Reads `DISCORD_BOT_TOKEN` (or `ANVIL_SHARED_BOT_TOKEN`). Registration is a PUT of the full set, so
it's idempotent and a renamed command never lingers in members' autocomplete.

Global registration is cached by Discord for up to an hour. Use `--guild` while iterating; waiting
an hour to see a typo is how an afternoon disappears.

### 4. Write the house rules

**Admin → Integrations → Board → House rules.** Prose only: how each board scores (points, lockout,
reveals, decay, starting shot, fee, prize pool) is read off the event itself and never typed here,
so the mechanics half of `/bingo rules` is always correct and always current. `board_rules_url`
links the long version and is the fallback when the ruleset outgrows a Discord embed.

---

## Environment

| Variable | Where | What for |
| --- | --- | --- |
| `DISCORD_PUBLIC_KEY` | either | Pin the application's verify key instead of fetching it. Optional. |
| `DISCORD_INTERACTION_SECRET` | clan container | Proves a forwarded interaction came from the control plane. Injected by the provisioner. |
| `SHARED_BOT_TOKEN` | control plane | The shared app's bot token; also how the control plane reads its verify key. |

## Adding a command

1. Add the subcommand to `COMMAND_DEFINITIONS` in `lib/discordCommandDefs.ts` (no DB imports — the
   registration script loads this module directly).
2. Add a handler with the same name to `SUBCOMMANDS` in `lib/discordCommands.ts`.
3. Re-run `npm run discord:commands`.

`tests/discord-interactions.test.ts` asserts those two lists are **equal**, not that one contains
the other: a command that autocompletes and then fails in front of a member is worse than one that
never existed. It also checks the names and descriptions against the constraints Discord enforces at
registration, since a rejected PUT is a silent bot.

Run it with `npm run test:discord`.
