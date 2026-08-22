# Discord slash commands

Anvil's bot answers `/bingo …` inside a clan's Discord server: the board, the standings, the rules,
your own card. Everything it answers is read-only, and it needs no login — Discord already vouched
for who typed the command, and `users.discord_id` is Anvil's identity column.

```
/bingo board          the board that's running right now
/bingo rules          how this board scores + your clan's house rules
/bingo leaderboard    team standings
/bingo apply          how to get in — sign-ups, the fee, where you stand
/bingo next           what's coming — next reveal, mission or deadline
/bingo me             your team, your tiles, your standing
/bingo team [name]    a team card — score, roster, recent tiles
/bingo help           what the bot can answer in here
```

Every answer is **ephemeral** — only the person who ran it sees it. A bot that dumps a leaderboard
into general every time someone is curious gets muted.

---

## Sharing

Each private answer carries a **Share to channel** button. One click reposts it publicly, credited
to whoever pressed it.

There used to be a `share: true` option instead. It went because Discord has no valueless
option — every option carries a value, so the flag rendered as `share: True` in the picker, cost
two extra interactions to set, and essentially nobody found it. A button is one click and, unlike
an option, it's visible to people who never knew sharing was possible.

The button carries everything needed to rebuild the answer in its `custom_id` (`share:team:Reds`,
capped at Discord's 100 characters). Nothing is stored server-side, so a share still works after a
redeploy — and because the answer is rebuilt rather than replayed, a leaderboard shared ten minutes
later shows the standings as they are *now*, which is what a channel reading it would assume.

---

## Two of every command

Discord stores **guild** commands and **global** commands separately, and serves both. An
application registered in both scopes shows its whole tree twice in the picker.

The usual way in: a clan connects a bot before setting a server ID, so registration goes global;
the server ID arrives later and registration moves to guild scope; the global copy is still there.

```bash
# what is actually registered, in both scopes
npx tsx scripts/register-discord-commands.mts --list --guild <server-id>

# drop the global copy (guild-scoped registration is unaffected)
npx tsx scripts/register-discord-commands.mts --clear
```

`syncClanCommands` now empties the other scope on every run (`staleScopes`), so this heals itself
on the next boot. It reads before writing, so the normal case costs one GET that comes back empty.

If `--list` shows the command in **one** scope only and the picker still doubles it, the duplicate
is a second *application*: a clan on the managed shared bot that also invited its own bot named
Anvil sees both. Remove whichever bot you don't want from the server — the command lists are
per-application and neither one can clear the other.

## Languages

The bot speaks the same fifteen languages as the [guides](../src/lib/discordI18n/): English,
Danish, Arabic, Swedish, Norwegian, Finnish, German, Dutch, French, Italian, Polish, Spanish,
Brazilian Portuguese, Simplified Chinese, Japanese and Korean.

Nothing needs configuring. Discord sends the invoking member's own client language on every
interaction, so a Danish member gets Danish and the Norwegian beside them gets Norwegian.

| Answer | Language it uses | Why |
| --- | --- | --- |
| Private (the default) | `interaction.locale` — the member's own | Nobody else is reading it |
| Shared to the channel | `interaction.guild_locale` — the server's | The channel reads it, not the sharer |
| Either, with an override set | The clan's `discord_language` setting | Staff said something detection can't know |

The override (Integrations → Discord bot → Bot language) exists for two cases. Discord has no
Arabic client language, so an Arabic-speaking clan's members all report English and could never
otherwise reach the Arabic translation. And a mixed-locale server that would rather have one voice
can pick one.

Command *descriptions* are localized too, via `description_localizations` built from the same
dictionaries at registration time. Command **names** are not: a member reading a Danish answer
still types `/bingo board`, and a translated command name is a command nobody can find. The same
goes for `Powered by Anvil`.

Adding a language is one file plus one row in `src/lib/discordI18n/index.ts`; missing keys fall
back to English per key. `npm run test:discord-i18n` prints per-locale coverage and fails on a key
English doesn't have, a dropped `{placeholder}`, or a description over the 100 characters Discord
accepts.

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

### 3. Registration happens on its own

Commands are registered per **application**, not per guild, and registration is a full-set PUT —
whatever gets sent becomes exactly what exists. That makes it an idempotent reconcile rather than a
setup step, so it runs automatically and heals itself:

| Who | When | Scope |
| --- | --- | --- |
| Control plane (shared Anvil app) | every boot — `Anvil.Admin/src/instrumentation.ts` | **global**, so one write covers every managed clan including ones onboarding later |
| A clan with its own bot | when its token is saved, and every boot — `lib/discordCommandSync.ts` | **guild** when a server is configured (instant), else global |

A clan on the shared bot never registers anything itself: the control plane owns that application,
and N containers re-registering it would be N redundant writes racing each other. `getBotTokenSource()`
is what draws that line.

Nothing to do when a clan signs up — global registration already covers them.

**The manual escape hatch**, for testing or a one-off repair:

```bash
npm run discord:commands                 # global — every server, up to ~1h to appear
npm run discord:commands -- --guild <id> # one server, instantly (use this while testing)
npm run discord:commands -- --clear      # remove them again
```

Reads `DISCORD_BOT_TOKEN` (or `ANVIL_SHARED_BOT_TOKEN`). Run it locally, not on the box — the
container image carries only `scripts/migrate.mjs` and no dev dependencies, and registration talks
solely to Discord's API, so it needs nothing from the server but the token value.

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
3. Mirror it in `SHARED_COMMANDS` in `Anvil.Admin/src/lib/discordCommandSync.ts` — the control plane
   registers the shared app and can't import across the repo boundary. The test below fails if you
   forget.
4. Deploy. The boot reconcile registers it; no script to remember.

`tests/discord-interactions.test.ts` asserts those two lists are **equal**, not that one contains
the other: a command that autocompletes and then fails in front of a member is worse than one that
never existed. It also checks the names and descriptions against the constraints Discord enforces at
registration (a rejected PUT is a silent bot), and — when Anvil.Admin is checked out alongside —
that the control plane's mirrored copy hasn't drifted from this one.

Run it with `npm run test:discord`.
