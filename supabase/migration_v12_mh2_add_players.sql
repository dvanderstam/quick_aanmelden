-- Migration v12: Add additional MH-2 players and memberships
-- Run this AFTER migration_v11_mh2_team.sql

-- Ensure additional MH-2 players exist
INSERT INTO players (id, name, role, username, must_change_password, disclaimer_accepted)
VALUES
  (34, 'Sven Maureau', 'speler', 'sven.maureau', true, false),
  (35, 'Eric Bernhard', 'speler', 'eric.bernhard', true, false),
  (36, 'Martin van Unen', 'speler', 'martin.vanunen', true, false),
  (37, 'Jayrone Nahr', 'speler', 'jayrone.nahr', true, false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  username = EXCLUDED.username,
  must_change_password = EXCLUDED.must_change_password,
  disclaimer_accepted = EXCLUDED.disclaimer_accepted;

-- MH-2 memberships
INSERT INTO player_teams (player_id, team_id)
VALUES
  (34, 'mh2'), -- Sven Maureau
  (35, 'mh2'), -- Eric Bernhard
  (36, 'mh2'), -- Martin van Unen
  (37, 'mh2')  -- Jayrone Nahr
ON CONFLICT (player_id, team_id) DO NOTHING;