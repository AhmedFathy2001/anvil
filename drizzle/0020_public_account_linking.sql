-- May the apex say that these characters are the same person?
--
-- `accounts.shared` (0016) publishes ONE character. It was also, accidentally, publishing the link
-- between them: /u/<id> lists every shared account of a person together, so sharing a second
-- character silently announced that both belonged to one human. Nobody opted into that, and it is
-- the disclosure most likely to matter — a main and an ironman can each be public without their
-- owner wanting them connected, which is exactly why sharing is per-account in the first place.
--
-- So linkage gets its own switch, and the same default as sharing: off, because the safe answer is
-- the one nobody has to think about. With it off, characters stay individually visible and /u/<id>
-- does not exist. With it on, the person page lists them and each character points at it.
--
-- Named for what it publishes rather than what it stores. There is no matching "unlink" — turning it
-- off is enough, since nothing is copied anywhere.

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "link_accounts_publicly" boolean DEFAULT false NOT NULL;
