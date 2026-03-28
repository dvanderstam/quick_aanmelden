-- Migration v10: Scope teamAdmin attendance permissions to own teams only
-- Run this AFTER migration_v9_vs1_team.sql

-- Replace broad teamAdmin policies from v6 with team-scoped policies.
DROP POLICY IF EXISTS "attendance_insert_teamadmin" ON attendance;
DROP POLICY IF EXISTS "attendance_update_teamadmin" ON attendance;
DROP POLICY IF EXISTS "attendance_delete_teamadmin" ON attendance;

CREATE POLICY "attendance_insert_teamadmin"
ON attendance
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM players actor
    JOIN player_teams actor_team
      ON actor_team.player_id = actor.id
    JOIN player_teams target_team
      ON target_team.team_id = actor_team.team_id
     AND target_team.player_id = attendance.player_id
    WHERE actor.auth_user_id = auth.uid()
      AND actor.role = 'teamAdmin'
  )
);

CREATE POLICY "attendance_update_teamadmin"
ON attendance
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM players actor
    JOIN player_teams actor_team
      ON actor_team.player_id = actor.id
    JOIN player_teams target_team
      ON target_team.team_id = actor_team.team_id
     AND target_team.player_id = attendance.player_id
    WHERE actor.auth_user_id = auth.uid()
      AND actor.role = 'teamAdmin'
  )
);

CREATE POLICY "attendance_delete_teamadmin"
ON attendance
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM players actor
    JOIN player_teams actor_team
      ON actor_team.player_id = actor.id
    JOIN player_teams target_team
      ON target_team.team_id = actor_team.team_id
     AND target_team.player_id = attendance.player_id
    WHERE actor.auth_user_id = auth.uid()
      AND actor.role = 'teamAdmin'
  )
);
