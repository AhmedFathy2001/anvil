# Setting up the Anvil RuneLite plugin

The **Anvil** plugin is the companion that makes tracking automatic: it captures
drops, boss kill-counts, skill XP, NPC kills, timed clears, achievement diaries and
more, burns a tamper-evident codeword + timestamp onto every screenshot, shows your
board in the collection log, and tracks weekly SotW/BotW — all with no manual
submitting. One shared plugin serves every clan: it always talks to
`https://anvilosrs.com` (there is no Site URL setting), and signing in is what ties it
to you and your clans.

This guide is for **members** (getting linked) and **clan admins** (helping members
and syncing the roster). The Plugin Hub build only works with `anvilosrs.com`;
self-hosted instances are not supported by it (see § 9).

> **Members should read the in-app guide instead.** Every instance serves a
> screenshot-annotated, instance-aware version at **`/guide/plugin`** (and a staff
> guide at `/guide/admin`) — it walks through the sign-in with screenshots, and it covers OBS clip
> capture, which this document does not. Source: `src/app/guide/`. Keep both in step
> when plugin behaviour changes.

---

## 1. Install

RuneLite → **Configuration** (wrench) → **Plugin Hub** → search **Anvil** → Install.
Publisher is `AhmedFathy2001`, entry point `com.anvil.AnvilPlugin`.

## 2. Sign in

Open the **Anvil** panel from the RuneLite sidebar (the Anvil icon in the icon strip)
and click **Sign in with Discord**. That's the whole setup — nothing to type or paste.
It is a device-code flow (RFC 8628 shape) that fills the **Account Token** in for you:

1. The plugin `POST`s `/api/plugin/auth/start` on `https://anvilosrs.com` and shows
   the returned user code.
2. It opens `https://anvilosrs.com/link-device?code=…` in the browser. The URL is
   pinned to `anvilosrs.com` — a response steering the browser anywhere else is refused.
3. You log in with Discord if needed, confirm the code matches and press **Approve**
   (only ever approve a code *your own* client is displaying).
4. The plugin polls `/api/plugin/auth/poll` and stores the token; the panel says
   *Signed in*. Codes are single-use and expire in 10 minutes.

See `src/lib/pluginDeviceAuth.ts`. If the browser doesn't open by itself, the panel
prints the address and code so you can open it manually.

Use the **Anvil side panel** as the day-to-day workspace: it shows clans, live events,
progress, starting shots, sync actions and support tools. **Configuration → Anvil** is
only for preferences and the manual token fallback below.

**Fallback — paste the token by hand.** If sign-in won't work for you, copy your token
from **Profile → RuneLite plugin → Reveal → Copy** and paste it into **Configuration →
Anvil → Account Token**. One token works across every event you're signed up for. It's
a secret — don't share it.

> **Where's the token?** On your clan's site, log in with Discord, open **Profile**,
> scroll to the **RuneLite plugin** card (`recommended` badge). Use **Reveal** →
> **Copy**. **Rotate** invalidates the old one if it ever leaks.

## 3. How linking works

You don't enter a link code. Once you are signed in, the plugin reports the account
you are playing. A brand-new account can link immediately. An account that is already
on a clan roster needs one ownership check first, because the RuneScape name is public
and the client-reported account hash is not authenticated. Use **Verify by XP** on the
profile or ask a clan moderator to approve the detected account.

Once that first proof is complete, the stored account hash is a stable anchor: the
plugin recognises the account automatically and the link survives name changes.

- Newly played accounts show up on your **Profile → "Accounts we noticed you
  playing"**. **Add** links safe new accounts immediately and directs established
  roster accounts to the one-time proof step.
- Add alts the same way — play them once, add them.

### Linking without the plugin (mobile / official client)

If you can't run the plugin, link on the website instead (Profile → linking
methods):

- **Verify by XP** — enter your RSN, the site picks a random skill; gain ≥1,000 XP
  in it within 30 minutes and you're verified (a moderator confirms; provisional
  until then).
- **Manual review** — for hidden Hiscores / low-level alts: submit your RSN + a
  note; a moderator approves.

Event sign-ups require at least one verified account, so do this before signing up.

---

## 4. Is it working? What you should see

When the plugin is linked and an event is live:

- **Login chat greeting:** `Bingo running: <event>.` (and `Skill of the Week is
  live: …` / `Boss of the Week…` when a weekly is active). If you're not yet a
  member you'll see `Tracked as a guest — a clan admin can promote you to member on
  the site.`
- **Side panel** populates with your event, team, your tracked tile progress, weekly
  competitions and upcoming events.
- **Screenshots** carry the plugin's overlay — `Anvil`, your **team** and the **UTC
  date** — rendered into the frame (that's the tamper-evidence: proofs can't be
  back-dated or attributed to another team). Requires **Show Overlay** to be on; the
  old per-day codeword was dropped since the server never validated it.
- **Per-tile chat confirmations** as things happen, e.g. `Tracked drop detected:
  <label> (n/req)`, `Tracked kill: …`, `Tracked timed clear: … in m:ss`.

## 5. Troubleshooting

The plugin tells you (in chat) when tracking is off — it waits ~90s before nagging
and repeats at most every 5 minutes:

| You see | Fix |
| --- | --- |
| `Anvil: your Account Token was rejected — tracking is OFF. Re-copy your token…` | Token is wrong/rotated. Sign in from the Anvil panel again, or Profile → Plugin → Reveal → Copy → repaste into **Account Token**. |
| `Anvil: can't reach the site … — tracking is OFF.` | The client can't reach `anvilosrs.com`: check the internet connection and any firewall/VPN blocking RuneLite; otherwise the site is briefly down (the plugin reconnects by itself). |
| `…you're logged in as "<RSN>" but isn't linked to your Anvil account — your drops won't count. Verify this RSN on the Anvil site.` | That account isn't linked. Add it from Profile → "Accounts we noticed you playing," or use Verify by XP / Manual review. |
| `Anvil: reconnected — tracking is back on.` | (Informational — it recovered.) |

Other places to look: pet and duplicate Champion's-scroll proofs are saved locally
to `~/.runelite/osrs-bingo-pending/` and surfaced as a **Saved proofs** row in the
Collection Log **Bingo** tab.

## 6. Notification toggles (optional)

Under **Configuration → Anvil**, the Bingo and notification sections let each member
control what posts to the clan's Discord channels (channels are configured on the
site, not the plugin). Defaults: rare-drop alerts on (≥ 5M or 1-in-5000), pets on,
deaths on, PvP-kill posts **off**, Combat Achievements on (Master+), level-99s and
diaries on, quests at Master & up. OBS clip capture is off by default.

## 7. Clips with OBS (optional)

The **Clips** section captures the last N seconds from OBS's replay buffer on a
hotkey and posts the file to a Discord webhook. Off by default. Unlike every other
notification, **clips never pass through the site**: the plugin uploads straight from
the member's machine to a webhook *they* paste in (multi-MB video would blow the
server's body limit, and the plugin hub forbids calling URLs handed out by a server
response). Admins therefore create the clips-channel webhook on the site and hand the
URL to members — see `webhook_clips` in **Advanced settings → Webhooks**.

**OBS side (once):** OBS Studio 28+ (WebSocket server is built in) → **Settings →
Output → Enable Replay Buffer** → **Tools → WebSocket Server Settings → Enable
WebSocket server**, then **Show Connect Info** for port (4455) and password. Nobody
has to start the buffer by hand: on connect the plugin checks `GetReplayBufferStatus`
and starts it if it's stopped.

**Plugin side:** `Enable clip capture`, a `Capture clip hotkey`, OBS host/port/password
(`localhost` unless OBS runs on another machine), `Max auto-post size (MB)` (default
25 — anything larger is kept local), `Clip length (seconds)` (written into the OBS
profile as `RecRBTime`; the buffer restarts to adopt it), `Save clips as MP4` (sets
OBS's recording format globally so Discord can preview inline), the webhook URL, and
`Post OBS-triggered clips too` (also handle saves fired by OBS or the "Save Replay
Buffer for OBS" plugin — leave off when two RuneLite clients share one OBS, or every
clip posts twice).

| You see | Meaning |
| --- | --- |
| `Clip capture: OBS isn't connected.` | OBS closed, WebSocket off, or wrong host/port/password. The plugin retries every 30s. |
| `OBS could not save the clip — is the Replay Buffer started?` | Buffer isn't running; check **Enable Replay Buffer**. |
| `Clip saved locally — paste a Clips Discord webhook URL…` | No webhook set (working as intended). |
| `Clip saved locally (NMB) — too big to auto-post to Discord.` | Over **Max auto-post size**, or over what the server accepts. |
| `Clip saved locally, but Discord didn't accept the upload.` | Too big, rate-limited, or timed out — the file is still on disk. |

## 8. For clan admins

- Once your token belongs to a site **admin**, a **Sync clan roster** button appears
  in the Collection Log **Bingo** tab — one click pushes your in-game clan roster to
  the site (this is how clan membership is granted; verify/link flows only create
  guests).
- Members who join mid-event just install, click **Sign in with Discord** in the
  Anvil panel, and play — no per-event setup.

## 9. Self-hosting note

The Plugin Hub build has no Site URL setting — it always talks to `anvilosrs.com`, so
it cannot be pointed at a self-hosted instance. Running your own instance means
building and distributing your own plugin build whose base URL is your domain (see
[`SELF_HOSTING.md`](./SELF_HOSTING.md) § 11), at the cost of maintaining it yourself
instead of using the shared **Anvil** plugin.
