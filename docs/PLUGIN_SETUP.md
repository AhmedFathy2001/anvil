# Setting up the Anvil RuneLite plugin

The **Anvil** plugin is the companion that makes tracking automatic: it captures
drops, boss kill-counts, skill XP, NPC kills, timed clears, achievement diaries and
more, burns a tamper-evident codeword + timestamp onto every screenshot, shows your
board in the collection log, and tracks weekly SotW/BotW — all with no manual
submitting. One shared plugin serves every clan (hosted or self-hosted); you point
it at your clan's site.

This guide is for **members** (getting linked) and **clan admins** (helping members
and syncing the roster). It applies to both hosted (`yourclan.anvilosrs.com`) and
self-hosted instances.

---

## 1. Install

RuneLite → **Configuration** (wrench) → **Plugin Hub** → search **Anvil** → Install.
Publisher is `AhmedFathy2001`, entry point `com.anvil.AnvilPlugin`.

## 2. Configure (two fields)

Open **Configuration → Anvil**. Only the **Setup** section matters to get going:

| Field | What to enter |
| --- | --- |
| **Site URL** | Your clan's Anvil address, e.g. `https://yourclan.anvilosrs.com` (no trailing slash; `https://` is added if you omit it). **Required** — this field ships empty, so you must set it. Ask your clan admin if unsure. |
| **Account Token** | Your personal token from the site: **Profile → Plugin → Reveal → Copy**, then paste here. One token works across every event you're signed up for. It's a secret — don't share it. |

That's the whole setup. A side panel appears once connected.

> **Where's the token?** On your clan's site, log in with Discord, open **Profile**,
> scroll to the **RuneLite plugin** card (`recommended` badge). Use **Reveal** →
> **Copy**. **Rotate** invalidates the old one if it ever leaks.

## 3. How linking works — you just play

You don't enter a code or click "link." After the token is pasted, **the account
you log into automatically links to your profile.** The plugin sends your in-game
name and a stable, unforgeable account hash with each request; the site matches you
**hash-first** (so it survives name changes) and, when the account is one you own,
verifies it — no separate link-code dance.

- Newly played accounts show up on your **Profile → "Accounts we noticed you
  playing"** with a one-click **Add**.
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
- **Side panel** populates with your event, team, the daily **codeword**, your
  tracked tile progress, and upcoming events.
- **Screenshots** get the day's **codeword + UTC timestamp** burned in (that's the
  tamper-evidence — proofs can't be back-dated or faked).
- **Per-tile chat confirmations** as things happen, e.g. `Tracked drop detected:
  <label> (n/req)`, `Tracked kill: …`, `Tracked timed clear: … in m:ss`.

## 5. Troubleshooting

The plugin tells you (in chat) when tracking is off — it waits ~90s before nagging
and repeats at most every 5 minutes:

| You see | Fix |
| --- | --- |
| `Anvil: your Account Token was rejected — tracking is OFF. Re-copy your token…` | Token is wrong/rotated. Profile → Plugin → Reveal → Copy → repaste into **Account Token**. |
| `Anvil: can't reach the site (host) — tracking is OFF. Check the Site URL…` | Wrong/typo'd **Site URL**, or the site is down. Confirm the address (no trailing slash). |
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
diaries on. OBS clip capture is off by default.

## 7. For clan admins

- Once your token belongs to a site **admin**, a **Sync clan roster** button appears
  in the Collection Log **Bingo** tab — one click pushes your in-game clan roster to
  the site (this is how clan membership is granted; verify/link flows only create
  guests).
- Members who join mid-event just install, set Site URL + token, and play — no
  per-event setup.

## 8. Self-hosting note

If you run your own instance, everything above is identical — members simply set
**Site URL** to your domain. If you want to spare them typing it, you can ship a
build whose `apiUrl()` default is your domain (see
[`SELF_HOSTING.md`](./SELF_HOSTING.md) § 8), at the cost of maintaining your own Hub
listing instead of using the shared **Anvil** plugin.
