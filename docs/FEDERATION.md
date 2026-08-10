# Anvil Federation — Instance Contract (v1)

**This is the source-available, versioned public API that every Anvil instance (hosted or
self-hosted) exposes.** Self-hosters implement exactly this. The broker (Anvil.Admin) is
proprietary; only its *client-facing* endpoint shapes are documented here, under "Talking to
the broker."

---

## Invariants

1. **The instance is always the authority over its own tokens and membership.** The broker
   never issues an instance's token — it can only vouch for a Discord identity; the instance
   decides whether that identity is a member and mints its own token. Self-hosters keep their
   own Discord app and their own token issuance at every layer.
2. **The broker is connect-time only, never a runtime proxy.** Board/progress/event data never
   flows through it. Broker down ≠ instance down.
3. **Tokens are instance-scoped ⇒ blast radius is one instance.** No cross-instance credential.
4. **This contract is a stable, versioned public API.** Capability negotiation, never forced
   upgrades. New features ship as new capabilities; v1 clients keep working.
5. **Federation depth is the operator's dial** (Layer 0 → 2), set on this instance's own site.

---

## Layers (instance POV) — each ADDS behaviour, removes nothing

- **L0 Manual multi-home** — plugin holds `{baseUrl, token}`; token from this instance's own
  `/token`. No broker.
- **L1 Directory** — this instance registers its URL with the broker for discovery. Tokens
  still instance-issued; broker never sees one.
- **L2 Identity federation** *(opt-in)* — this instance trusts a broker in `brokerTrust[]` and
  accepts broker assertions at `/exchange`, minting its own token. The instance's own `/token`
  login keeps working alongside it — L2 is additive.

---

## Endpoints this instance exposes  (`/api/federation/v1/`)

| Endpoint | Layer | Auth | Purpose |
|---|---|---|---|
| `GET  /meta` | 0 | none | `{ instanceId, name, type, version, capabilities[], brokerTrust[], publicKey }` |
| `POST /token` | 0 | own login | **Own issuance** — instance's own Discord OAuth / link code → **plugin API token** |
| `POST /exchange` | 2 | broker assertion | Validate assertion vs broker JWKS → mint **plugin API token** |
| `GET  /board` | 0 | plugin token | Progress/board data (sidebar). ETag/304. |
| `POST /events` | 0 | plugin token | Plugin pushes game events for crediting. See **Cross-clan crediting**. |
| `POST /token/revoke` | 0 | plugin token / admin | Revoke a plugin token by `jti`. |

## Talking to the broker  (client side of the proprietary broker — shapes only)

| Broker endpoint | Layer | Used by instance/plugin to… |
|---|---|---|
| `POST /register` | 1 | Self-register this instance's URL (returns `pending` until domain-verified). |
| `GET  /directory` | 1 | (Plugin) list instances for discovery. |
| `GET  /jwks.json` | 2 | Fetch broker signing keys to validate assertions. |
| `POST /assert` | 2 | (Plugin) get per-instance assertions after a broker Discord login. |

---

## Token & session model  *(decision 3)*

Two distinct instance-issued credentials:

- **Plugin API token** (plugin ↔ site): **long-lived + revocable.** Members link once and stay
  linked. Store hashed with a `jti`. Site must expose a **"Connected plugins"** list with a
  per-token **Revoke** action (and revoke-all). Optional bind to a plugin install id.
- **Web session** (Discord OAuth site login): **30 days**, then re-auth.

Separate from both: a **broker assertion** (L2 only) is a ~60s, single-use, `aud`-pinned JWT —
*not* a bearer credential for data, only exchangeable once at the named instance.

---

## Cross-clan crediting  *(decision 1)*

**Default: credit all.** The plugin broadcasts each game event to every connected instance;
each instance independently credits any matching tile. A drop counts everywhere you're eligible.

**Per-clan opt-out, set on this instance's own site:** setting `sharedCredit: accept | exclusive`
(default `accept`).
- `accept` — credit regardless of where else the player is connected.
- `exclusive` — do **not** credit an event the player is simultaneously crediting elsewhere.

Enforcement: each `/events` payload carries a `fanout: { count, instanceIds[] }` the plugin
declares. `exclusive` rejects events with `fanout.count > 1`. This rides on the plugin's
*existing* trusted position — it already reports the drop itself, so disclosing fanout is the
same trust boundary, not a new one. **L2 hardening:** the broker's association data can
corroborate fanout for instances that also run identity federation.

---

## Association push  *(decision 2)*

Controls whether this instance tells the broker "discord_id X is a member here," which powers
the plugin's auto-populate ("your clans").

- **Hosted instances:** `associationPush` is **auto-enabled at registration** (via the admin
  provisioning flow) and toggleable afterward on this site.
- **Self-hosted instances:** register self-service; `associationPush` **defaults OFF** (opt-in),
  preserving sovereignty. Enable it here if you want your members auto-populated.

Push carries only the `(discord_id, instanceId)` association — never board or game data.

---

## Guest-on-exchange policy  *(decision 4)*

When a broker asserts a `discord_id` at `/exchange` and that user is **not** yet a member:
`exchangePolicy: auto-guest | request-to-join | reject` (default **`auto-guest`**).

`auto-guest` connects them immediately, gated by three guardrails (knowing the URL is *not* a
gate for directory-listed clans, so these carry the weight):

1. **Inert by default.** An exchange-created guest gets a **read-only board view** and is **not
   placed on any team** — it cannot credit tiles, submit, or affect anything until an admin
   drafts/promotes it. `/exchange` must never auto-place a guest on a team.
   *Anchoring:* when the identity already has a real, active row at the instance (account-token
   link, claimed roster row), the guest token anchors to **that** row; only an identity with no
   rows at all gets a synthetic `guest:<discord_id>` placeholder row (retired automatically once a
   real row appears). Either way the token stays `board:read`-only.
2. **Sticky ban.** Admin has both **Remove** (delete the guest row) and **Ban** (a persistent
   denylist keyed on `discord_id` that blocks future `/exchange` from re-creating them). Remove
   alone is whack-a-mole; Ban stops the re-spawn.
3. **Rate-limit + audit** auto-guest creation. A spammed clan can flip `exchangePolicy` to
   `request-to-join` or `reject` on its own site — no code change.

---

## Versioning / capability negotiation

`/meta` advertises `version` + `capabilities[]` (e.g. `["directory","identity-federation"]`).
Clients negotiate per instance: no `identity-federation` capability ⇒ treated as L0/L1. Old
self-hosted versions degrade gracefully, never break.

## Security notes for instance implementers

- HTTPS-only + HSTS; reject plaintext.
- Validate assertions strictly: signature vs trusted-broker JWKS, `aud` == self, `exp`, single-use `jti`.
- A broker (even compromised) can only *assert identity* — this instance still enforces its own
  membership list, so it cannot grant access to a non-member (subject to `exchangePolicy`).
- `/events` keeps your existing anti-cheat (credit off real KC/loot signals). Federation loosens nothing.
- Rate-limit per token; ETag/304 on `/board`; expect plugin fan-out across N instances.
