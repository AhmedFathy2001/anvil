-- Owner decision (2026-11-04): creators may link their Linktree / beacons.ai pages. Taken back out
-- of the promo blocklist seeded in 0211. Staff can still block either again from /staff.
DELETE FROM "promo_blocked_domains" WHERE "domain" IN ('linktr.ee', 'beacons.ai');
