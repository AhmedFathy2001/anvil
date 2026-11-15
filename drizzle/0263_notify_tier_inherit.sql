-- Combat-task and quest post tiers now inherit: users.notify_prefs.ca / .quests absent = follow the
-- clan's default, else Anvil's (Master). A stored 'MASTER' is the old default, almost certainly never
-- chosen, so it becomes "inherit"; any other tier (or OFF) stays the person's own.
DO $$
DECLARE r record; j jsonb; changed boolean;
BEGIN
  FOR r IN SELECT id, notify_prefs FROM users WHERE notify_prefs IS NOT NULL LOOP
    BEGIN
      j := r.notify_prefs::jsonb;
      changed := false;
      IF jsonb_typeof(j) = 'object' THEN
        IF j->>'ca' = 'MASTER' THEN j := j - 'ca'; changed := true; END IF;
        IF j->>'quests' = 'MASTER' THEN j := j - 'quests'; changed := true; END IF;
        IF changed THEN UPDATE users SET notify_prefs = j::text WHERE id = r.id; END IF;
      END IF;
    EXCEPTION WHEN others THEN
      NULL; -- unparseable JSON is read as "never set" by the app; leave it alone
    END;
  END LOOP;
END $$;
