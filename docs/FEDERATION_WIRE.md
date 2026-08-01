# Anvil Federation — Wire Contract (v1)  — CANONICAL

The low-level, byte-level contract shared by **Site** (`/exchange`, `/meta`, `/board`, `/events`,
`/token`), **Admin broker** (`/assert`, `/jwks`, `/register`, `/directory`, `/assoc`), and the
**Plugin**. When `FEDERATION.md` (instance) or `FEDERATION_BROKER.md` (broker) disagree with this
file, **this file wins.** All three codebases MUST agree on everything here before coding L2.

Base path: `/api/federation/v1/`. Transport: **HTTPS only** (HSTS). JSON bodies.

---

## 1. instanceId

- The **instance** generates a stable UUIDv4 **once** on first boot and persists it in settings
  key `federation_instance_id`. This makes Layer 0 work with **no broker**.
- Exposed in `GET /meta` as `instanceId`.
- The broker **records** it at `POST /register` and enforces global uniqueness; the broker never
  invents instanceIds.

## 2. Assertion JWT  (broker `/assert` → instance `/exchange`)

**Algorithm: `EdDSA` (Ed25519 / OKP).** Nothing else is accepted.

Header: `{ "alg": "EdDSA", "kid": "<broker-key-id>", "typ": "JWT" }`

Claims:
| claim | meaning |
|---|---|
| `iss` | broker id (its base URL, e.g. `https://anvilosrs.com`) — must be in the instance's `brokerTrust[]` |
| `sub` | the authenticated **`discord_id`** (string) |
| `aud` | **exactly one** `instanceId` (the target). One JWT per target instance. |
| `iat` | issued-at (unix seconds) |
| `exp` | `iat + 60` (60-second lifetime) |
| `jti` | UUIDv4, single-use |

**Verifier (instance `/exchange`) MUST, in order:**
1. Parse header; **reject unless `alg === "EdDSA"`** (blocks `alg:none` + alg-confusion). Never
   derive alg from the token.
2. Resolve `kid` against the broker JWKS (fetch + cache; refetch on unknown `kid`).
3. Verify signature.
4. `iss` ∈ `brokerTrust[]`, else 403.
5. `aud` === own `instanceId`, else 403.
6. `exp` valid with **≤30s clock skew**; reject expired.
7. `jti` unseen → record it until `exp`; if seen → **409 replay**, reject.
8. Only then map `sub`→member and apply `exchangePolicy`.

Use `jose` (`jwtVerify` + `createRemoteJWKSet`) — do not hand-roll.

## 3. Broker JWKS  (`GET /jwks.json`)

- OKP/Ed25519 **public** JWKs, each with a unique `kid`. `{ "keys": [ ... ] }`.
- **Rotation:** publish new **and** old keys; sign new assertions with the newest; retire an old
  key after `> max assertion lifetime` (60s) — practically after a short grace (e.g. 1h).
- Instances cache per `jose` defaults and refetch on unknown `kid`. `Cache-Control: max-age=300`.
- The **private** key lives only in the broker's secret store (`admin.env` on-box for now);
  never leaves Admin.

## 4. Federation token  (plugin ↔ instance; from `/token` or `/exchange`)

- **Opaque random 256-bit** string (base64url), **NOT a JWT**. Presented as
  `Authorization: Bearer <token>`.
- Stored **hashed** (SHA-256) at the instance in `federation_tokens`:
  `{ tokenId, tokenHash, memberId/discordId, scopes[], createdAt, lastUsedAt, revokedAt, label }`.
- **Long-lived + revocable** (decision 3). Revoke = set `revokedAt`; `/token/revoke` + the
  "Connected plugins" UI operate on `tokenId`.
- **`/exchange` mints are machine-rotated**: the member's home re-runs the exchange on every
  connection re-sync (~5 min), each mint superseding that home's previous token. The instance labels
  them (`Federation relay`) and prunes each identity's superseded relay tokens down to the newest
  few on every mint — they are not user-created credentials and must not accumulate.
- Scopes: `board:read`, `events:write`.
- (Web session — the Discord OAuth site login — is separate: 30-day, unchanged.)

## 5. `/events` ingest  (thin wrapper — decision 2)

- The plugin still resolves tiles **client-side** and submits completions through the **existing
  submissions pipeline**, but authed with a federation token and wrapped with a fanout descriptor.
- **Fanout descriptor** (plugin-declared) on every event:
  `"fanout": { "count": <int>, "instanceIds": ["<uuid>", ...] }`
- **`sharedCredit` enforcement** (instance setting, default `accept`):
  - `accept` → credit normally.
  - `exclusive` → if `fanout.count > 1`, **do not credit**; respond `200 {credited:false, reason:"exclusive"}`.
- Trust: fanout is plugin-declared; same trust boundary as the drop report itself (§ FEDERATION.md).

## 6. Domain-ownership proof  (broker `/register`)

- Broker issues a `verificationToken`. Instance proves control via **either**:
  - **HTTP:** serve `GET /.well-known/anvil-federation` → `{ "instanceId": "...", "verificationToken": "..." }`, **or**
  - **DNS:** TXT record `_anvil-federation.<domain>` = `<verificationToken>`.
- Broker fetch is **SSRF-guarded**: HTTPS only, to the registered host, **no redirects**, resolve
  + reject private/loopback/link-local IPs, 5s timeout, 8KB body cap.
- State: `pending` → `verified`. Hosted clans provisioned by Admin are `verified` implicitly (we
  own the domain).

## 7. Capability negotiation

`GET /meta` → `{ instanceId, name, type: "hosted"|"self-hosted", version: "1", capabilities: [...],
brokerTrust: [ {iss, jwksUrl} ], publicKey }`. Capabilities ⊆ `["directory","identity-federation"]`.
Clients degrade: no `identity-federation` ⇒ L0/L1 only. Unknown future capabilities are ignored.

## 8. Error conventions

| HTTP | when |
|---|---|
| 401 | missing/invalid/expired/revoked federation token |
| 403 | **policy/trust reject — stop:** assertion `iss` not trusted, `aud` mismatch, member banned, or `exchangePolicy: reject` non-member |
| 409 | replayed `jti` — **do not retry the same assertion** |
| 422 | **assertion not acceptable — re-fetch a fresh one:** malformed, wrong `alg`, bad signature, or expired |
| 429 | rate-limited (`/exchange`, `/token`, `/register`, `/assert`, auto-guest creation) |

Client (plugin) semantics: `422` → request a new assertion from the broker and retry; `409` → the
assertion was already spent, get a fresh one (never resend the same JWT); `403` → stop, it's a
trust/policy decision the instance won't reverse. Also: `/exchange` success returns
`{token, tokenId, scopes, instanceId, guest, memberId}` (guests get `board:read` only; members
get `board:read`+`events:write`), and a non-token `200 {status:"request-to-join"}` when policy is
`request-to-join`.

---

## 9. Plugin ↔ broker (Layer-2 "Connect clans" flow)

The web broker login is a cookie flow (`anvil_federation_member`); a RuneLite plugin can't use
cookies, so it authenticates via an OAuth 2.0 **Device Authorization Grant** (RFC 8628 style) — system
browser + polling, **no embedded browser, no local loopback server** (hub-friendly). Broker endpoints
are on the Admin host under `/api/federation/v1/` unless noted.

### 9.1 Device-code login  *(NEW — broker builds)*
1. `POST /device/start` → `{ device_code, user_code, verification_url, interval, expires_in }`.
   `verification_url` is a broker page (`<broker>/federation/device`) where the user enters `user_code`
   and completes the existing broker Discord OAuth (scope `identify`). `device_code` is the plugin's
   secret poll handle; `user_code` is the short human code.
2. Plugin opens `verification_url` in the **system browser**.
3. `POST /device/poll { device_code }` →
   - `{ status: "pending" }` — keep polling every `interval` s
   - `{ status: "slow_down" }` — increase interval
   - `{ status: "denied" | "expired" }` — stop
   - `{ status: "complete", brokerToken, expiresIn }` — success. `brokerToken` is the broker member
     session (the same `signBrokerSession` token the web cookie carries), handed to the plugin to hold.

### 9.2 Broker member auth accepts Bearer  *(NEW — broker extends)*
`/assert` and `/me/instances` today read the broker session from the `anvil_federation_member` cookie;
they MUST **also** accept `Authorization: Bearer <brokerToken>` (same token, same verify path). Cookie
OR bearer satisfies auth — so the plugin uses the bearer it got from `/device/poll`.

### 9.3 Directory  *(built)*
`GET /directory` (public, weak ETag+304) → `{ version:1, count, instances:[{ instanceId, name, baseUrl,
type:"hosted"|"self-hosted", verified, selfHosted, capabilities[] }] }`.

### 9.4 Me / instances  *(built; conform shape)*
`GET /me/instances` (Bearer or cookie) → `{ version:1, instances:[…same entry shape as /directory…] }`,
filtered to the member's connectable instances (verified + `associationPush`).

### 9.5 Assert  *(built)*
`POST /assert` (Bearer or cookie) body `{ instanceIds: string[] }` (or `{ instanceId }`, ≤25) →
`{ assertions:[{ instanceId, assertion, exp }], errors:[{ instanceId, error }] }`. One EdDSA JWT per
target per §2. `errors[].error` ∈ { `invalid_instance_id`, `unknown_instance`, `instance_unverified` }.

### 9.6 Plugin "Connect clans" sequence
1. Device-code login (§9.1/9.2) → hold `brokerToken`.
2. `GET /me/instances` (Bearer) → connectable instances.
3. `POST /assert { instanceIds }` (Bearer) → assertions.
4. Per assertion → `POST <baseUrl>/api/federation/v1/exchange { assertion }` → `{ token, … }` (§8
   errors: 422 re-fetch, 409 don't-resend, 403 stop). Store `(baseUrl, token)` as a connection.
5. Populate `ConnectionManager`; sidebar lights up. **No token is ever hand-pasted** — the raw
   "Extra clan connections" CSV stays only as an advanced/self-host fallback.

---

## 10. Site-relayed federation  (the default path — supersedes plugin-direct §9)

**The plugin never connects to the broker or to other clan sites.** It only ever calls its own
configured home site — one host, unchanged posture (⇒ no RuneLite external-connection/IP warning, no
URL injection, trivial hub sign-off). All broker + inter-site traffic is **server-to-server**; the
member's IP only ever reaches their home site. The §9 endpoints (`/device/*`, `/me/instances`,
`/assert`, `/exchange`) still exist but are now called **site→broker / site→site**, not by the plugin.

### 10.1 Enable — a site-admin setting
Setting `federationEnabled`. On enable, the site registers itself with the broker (`/register`,
domain-verified — existing) and starts relaying. **The broker URL is site-side config** — the single
Anvil broker (`anvilosrs.com`); the plugin also hard-pins this host to validate the `verificationUrl`
it opens. Never sent to the plugin. One toggle federates
every member of that clan — hosted and self-host use the exact same path.

### 10.2 Plugin ↔ home site  (the ONLY federation endpoints the plugin calls)
- `GET  /api/plugin/federation/state` → `{ enabled, connected, needsLogin, verificationUrl?, clans:[{ id, name, board, activity, member, … }] }` — the plugin polls this and renders `clans[]`. `member` is our CACHED `/exchange` verdict for that clan (`false` = we're an auto-created federation guest there), re-stamped on each re-sync; the plugin opens its sidebar on a clan the player really belongs to and falls back to the configured home when they're a guest everywhere. Absent on an older home → the plugin keeps its old home-first default.
- `POST /api/plugin/federation/connect` → `{ status:"connected" }` (an existing broker session) **or** `{ status:"login", verificationUrl }` (device-code — plugin opens verificationUrl for the member's one-time Discord login on the broker's domain).
The plugin holds **no** clan tokens and opens **no** clan connections.

### 10.3 Identity — the member always proves their own Discord (no clan vouching)
**Every clan is untrusted; a clan's server is only a relay.** No clan — hosted OR self-hosted — may
assert identity for a member: the `/vouch` endpoint is **REMOVED** and there is no "trusted home" tier.
*Every* member authenticates via device-code (§9.1) — the home site relays `/device/start`+`/poll`, and
the Discord login happens in the member's browser on the **broker's own domain**. One-time (a 30-day
broker session; later connects reuse it). The broker mints assertions **only for the `discord_id` that
logged in itself**, so a compromised/malicious clan can relay traffic but can never forge a member.
Each target clan then independently re-checks membership at `/exchange` (the member must exist in that
clan's DB / be created per its `exchangePolicy`) — the relay grants nothing. `/assoc` is now only a
directory hint (which clans to *offer* a member); a spurious entry just fails at `/exchange`.

### 10.4 Fan-out is server-side too
The plugin submits each game event to its home site **once** (exactly as today). The home site relays
the credit to the member's other federated clans (server-to-server, using the instance tokens it holds
from `/exchange`), honoring `sharedCredit`/`exclusive`. The broker stays identity/directory only — NOT
in the data hot path.

### 10.5 Manual direct-connect — vestigial escape hatch
The advanced CSV path (user-typed clan URLs → plugin connects directly) remains ONLY for a site not
registered with the broker. Hub-accepted because URLs are manually entered; it is the sole mode that
carries direct multi-connect (and thus its own IP disclosure), and it is opt-in/advanced.

### 10.6 Clog tab vs sidebar
The in-game clog tab always shows the **home** board (the single site the plugin is configured with,
connection #0). Federation is additive to the **sidebar** only and never moves the clog. It is decided
by "the site you configured," not member-vs-guest.

---

## Frozen decisions (from design, do not relitigate mid-build)

1. Credit **all** connected clans; per-clan `sharedCredit: exclusive` opt-out (§5).
2. Association push default **on** for hosted (at provision), **off** for self-hosted (opt-in).
3. Plugin token **long-lived + revocable**; web session **30-day**.
4. Guest-on-exchange default **`auto-guest`** — inert (read-only, never auto-placed on a team) +
   **sticky ban** (denylist keyed on `discord_id`, blocks re-exchange) + rate-limit + audit.
5. `instanceId` = instance-self-declared stable UUID; broker records it.
