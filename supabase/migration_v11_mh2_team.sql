-- Migration v11: Add MH-2 team players, memberships, and team admins
-- Run this AFTER migration_v10_teamadmin_scope.sql

-- Ensure MH-2 players exist
INSERT INTO players (id, name, role, username, must_change_password, disclaimer_accepted)
VALUES
  (26, 'Richard de Boer', 'teamAdmin', 'richard.deboer', true, false),
  (27, 'Joost Comperen', 'speler', 'joost.comperen', true, false),
  (28, 'Carlos Montoya', 'speler', 'carlos.montoya', true, false),
  (29, 'Mike den Breeijen', 'speler', 'mike.denbreeijen', true, false),
  (30, 'Michiel van Velzen', 'teamAdmin', 'michiel.vanvelzen', true, false),
  (31, 'Maze de Boer', 'speler', 'maze.deboer', true, false),
  (32, 'Jeroen van Barneveld', 'speler', 'jeroen.vanbarneveld', true, false),
  (33, 'Chiping Lee', 'speler', 'chiping.lee', true, false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  username = EXCLUDED.username,
  must_change_password = EXCLUDED.must_change_password,
  disclaimer_accepted = EXCLUDED.disclaimer_accepted;

-- Ensure existing players are in requested roles
UPDATE players SET role = 'teamAdmin' WHERE id IN (11, 12); -- Barry, Ralf

-- MH-2 memberships
INSERT INTO player_teams (player_id, team_id)
VALUES
  (26, 'mh2'), -- Richard de Boer
  (27, 'mh2'), -- Joost Comperen
  (28, 'mh2'), -- Carlos Montoya
  (29, 'mh2'), -- Mike den Breeijen
  (30, 'mh2'), -- Michiel van Velzen
  (31, 'mh2'), -- Maze de Boer
  (32, 'mh2'), -- Jeroen van Barneveld
  (33, 'mh2'), -- Chiping Lee
  (9,  'mh2'), -- Dave Spoelstra
  (11, 'mh2'), -- Barry Vis
  (12, 'mh2')  -- Ralf Vis
ON CONFLICT (player_id, team_id) DO NOTHING;

-- Keep requested shared memberships with MS-1 for Dave/Barry/Ralf
INSERT INTO player_teams (player_id, team_id)
VALUES
  (9,  'ms1'),
  (11, 'ms1'),
  (12, 'ms1')
ON CONFLICT (player_id, team_id) DO NOTHING;

-- Team-admin set for MH-2
UPDATE players
SET role = 'teamAdmin'
WHERE id IN (26, 30, 11, 12); -- Richard, Michiel, Barry, Ralf
