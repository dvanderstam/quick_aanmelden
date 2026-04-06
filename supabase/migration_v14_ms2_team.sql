-- Migration v14: Add MS-2 team players, memberships, and team-admin roles
-- Run this AFTER migration_v13_vs2_team.sql

-- Ensure MS-2 players exist (upsert by username to avoid duplicate person records)
INSERT INTO players (id, name, role, username, must_change_password, disclaimer_accepted)
VALUES
  (80, 'Giovani Chirinos', 'teamAdmin', 'giovani.chirinos', true, false),
  (81, 'Randolf Axwijk', 'teamAdmin', 'randolf.axwijk', true, false),
  (82, 'Maze de Boer', 'speler', 'maze.deboer', true, false),
  (83, 'Richard de Boer', 'speler', 'richard.deboer', true, false),
  (84, 'Luis Luque', 'speler', 'luis.luque', true, false),
  (85, 'Bart Janssen', 'speler', 'bart.janssen', true, false),
  (86, 'Dave Spoelstra', 'speler', 'davespoelstra', true, false),
  (87, 'Waldo Serno', 'speler', 'waldo.serno', true, false),
  (88, 'Hans Peter Harmsen', 'speler', 'hans.peter.harmsen', true, false),
  (89, 'Nathan Hochland', 'speler', 'nathan.hochland', true, false),
  (90, 'Shanon Welhous', 'speler', 'shanon.welhous', true, false),
  (91, 'Michealsjenko Osepa', 'speler', 'michealsjenko.osepa', true, false)
ON CONFLICT (username) DO UPDATE
SET
  name = EXCLUDED.name,
  role = CASE
    WHEN players.username IN ('giovani.chirinos', 'randolf.axwijk') THEN 'teamAdmin'
    ELSE players.role
  END,
  must_change_password = EXCLUDED.must_change_password,
  disclaimer_accepted = EXCLUDED.disclaimer_accepted;

-- MS-2 memberships for all listed players
INSERT INTO player_teams (player_id, team_id)
SELECT p.id, 'ms2'
FROM players p
WHERE p.username IN (
  'giovani.chirinos',
  'randolf.axwijk',
  'maze.deboer',
  'richard.deboer',
  'luis.luque',
  'bart.janssen',
  'davespoelstra',
  'waldo.serno',
  'hans.peter.harmsen',
  'nathan.hochland',
  'shanon.welhous',
  'michealsjenko.osepa'
)
ON CONFLICT (player_id, team_id) DO NOTHING;

-- Team-admin role assignment for MS-2
UPDATE players
SET role = 'teamAdmin'
WHERE username IN ('giovani.chirinos', 'randolf.axwijk');