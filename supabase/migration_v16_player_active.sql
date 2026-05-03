-- Migration v16: add active flag to players
-- Run this AFTER migration_v15_player_identity_and_username.sql

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Index for filtering active players efficiently
CREATE INDEX IF NOT EXISTS players_active_idx ON players (active);
