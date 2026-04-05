-- Migration v9: Add VS-1 team, players, and team-specific captain permissions
-- Run this AFTER migration_v8_needs_replacement.sql

-- 1) Team-specific captain flag on player-team membership
ALTER TABLE player_teams
ADD COLUMN IF NOT EXISTS is_team_captain BOOLEAN NOT NULL DEFAULT false;

-- 2) Team-captain attendance policies (per team)
-- This allows a captain to manage attendance only for players in teams
-- where that captain has is_team_captain = true.
DROP POLICY IF EXISTS "attendance_insert_teamcaptain" ON attendance;
CREATE POLICY "attendance_insert_teamcaptain"
ON attendance
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM players actor
    JOIN player_teams actor_team
      ON actor_team.player_id = actor.id
     AND actor_team.is_team_captain = true
    JOIN player_teams target_team
      ON target_team.team_id = actor_team.team_id
     AND target_team.player_id = attendance.player_id
    WHERE actor.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attendance_update_teamcaptain" ON attendance;
CREATE POLICY "attendance_update_teamcaptain"
ON attendance
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM players actor
    JOIN player_teams actor_team
      ON actor_team.player_id = actor.id
     AND actor_team.is_team_captain = true
    JOIN player_teams target_team
      ON target_team.team_id = actor_team.team_id
     AND target_team.player_id = attendance.player_id
    WHERE actor.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attendance_delete_teamcaptain" ON attendance;
CREATE POLICY "attendance_delete_teamcaptain"
ON attendance
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM players actor
    JOIN player_teams actor_team
      ON actor_team.player_id = actor.id
     AND actor_team.is_team_captain = true
    JOIN player_teams target_team
      ON target_team.team_id = actor_team.team_id
     AND target_team.player_id = attendance.player_id
    WHERE actor.auth_user_id = auth.uid()
  )
);

-- 3) Ensure VS-1 players exist (Olaf already exists with id = 6)
INSERT INTO players (id, name, role, username, must_change_password, disclaimer_accepted)
VALUES
  (15, 'Birgit Piening', 'speler', 'birgit.piening', true, false),
  (16, 'Inge Groot', 'speler', 'inge.groot', true, false),
  (17, 'Tryntje Pasma', 'speler', 'tryntje.pasma', true, false),
  (18, 'Stephanie de Haan-Dekker', 'speler', 'stephanie.dehaan.dekker', true, false),
  (19, 'Anouk de Jong', 'speler', 'anouk.dejong', true, false),
  (20, 'Marjolein Evers', 'speler', 'marjolein.evers', true, false),
  (21, 'Monica Schotel', 'speler', 'monica.schotel', true, false),
  (22, 'Petra Veenstra-Fasel', 'speler', 'petra.veenstra.fasel', true, false),
  (23, 'Maud Engelman', 'speler', 'maud.engelman', true, false),
  (24, 'Gerlous Kulk', 'speler', 'gerlous.kulk', true, false),
  (25, 'Lotte Soumokil-Peters', 'speler', 'lotte.soumokil.peters', true, false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  username = EXCLUDED.username;

-- Keep Olaf in players table up to date
UPDATE players
SET name = 'Olaf van Reeden'
WHERE id = 6;

-- 4) Team memberships for VS-1
INSERT INTO player_teams (player_id, team_id)
VALUES
  (15, 'vs1'),
  (16, 'vs1'),
  (17, 'vs1'),
  (18, 'vs1'),
  (19, 'vs1'),
  (20, 'vs1'),
  (21, 'vs1'),
  (22, 'vs1'),
  (23, 'vs1'),
  (24, 'vs1'),
  (25, 'vs1'),
  (6,  'vs1')
ON CONFLICT (player_id, team_id) DO NOTHING;

-- 5) Captains for VS-1 only
UPDATE player_teams SET is_team_captain = true WHERE player_id = 24 AND team_id = 'vs1'; -- Gerlous
UPDATE player_teams SET is_team_captain = true WHERE player_id = 6  AND team_id = 'vs1'; -- Olaf

-- Ensure Olaf remains a normal member in MS-1 (not captain there)
UPDATE player_teams SET is_team_captain = false WHERE player_id = 6 AND team_id = 'ms1';

-- 6) Ensure Bas is teamAdmin/captain for MS-1
UPDATE players SET role = 'teamAdmin' WHERE id = 3;
INSERT INTO player_teams (player_id, team_id) VALUES (3, 'ms1')
ON CONFLICT (player_id, team_id) DO NOTHING;
UPDATE player_teams SET is_team_captain = true WHERE player_id = 3 AND team_id = 'ms1';
