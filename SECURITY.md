# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately instead, with reproduction steps and the affected route/component:

- GitHub: [Report a vulnerability](https://github.com/AhmedFathy2001/anvil/security/advisories/new) (preferred)
- Email: ahmedfathy075@gmail.com

You should get a first response within a few days. Please give us a reasonable window to
ship a fix before any public disclosure — hosted clans and self-hosted instances both need
time to update.

## Supported versions

Security fixes land on the latest release. Self-hosters should track the newest tagged
version (see `docs/SELF_HOSTING.md` → *Versioning & updates*); older versions receive fixes
only when upgrading is not a reasonable path.

## Scope notes

- The plugin never receives Discord webhook URLs or other secrets — it posts to the site,
  which forwards server-side. Anything that breaks that boundary is in scope.
- Self-hosted instances are configured by their operators; misconfigured deployments
  (exposed `.env`, missing TLS) are out of scope, but insecure *defaults* are in scope.
