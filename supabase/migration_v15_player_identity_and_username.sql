-- Migration v15: prepare players for server-side create-or-link flow
-- Run this AFTER migration_v14_ms2_team.sql

-- 1) Ensure new player rows can allocate IDs without manual scripts.
CREATE SEQUENCE IF NOT EXISTS players_id_seq;

SELECT setval(
  'players_id_seq',
  COALESCE((SELECT MAX(id) FROM players), 0),
  true
);

ALTER SEQUENCE players_id_seq OWNED BY players.id;
ALTER TABLE players ALTER COLUMN id SET DEFAULT nextval('players_id_seq');

-- 2) Normalize usernames and enforce case-insensitive uniqueness for new inserts.
UPDATE players
SET username = lower(username)
WHERE username <> lower(username);

CREATE UNIQUE INDEX IF NOT EXISTS players_username_lower_idx
ON players ((lower(username)));
