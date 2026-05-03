-- Migration v17: allow team memberships that should not count in player lists
-- Run this AFTER migration_v16_player_active.sql

ALTER TABLE player_teams
  ADD COLUMN IF NOT EXISTS count_in_player_list boolean NOT NULL DEFAULT true;

-- Speeds up team roster queries that only include counted players.
CREATE INDEX IF NOT EXISTS player_teams_team_count_idx
ON player_teams (team_id, count_in_player_list);
