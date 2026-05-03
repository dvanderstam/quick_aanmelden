-- Migration v19: Losse teamsetting voor vervangernaam + attendance replacement metadata
-- Run this AFTER migration_v18_teams_table.sql

-- 1) Team setting: replacement name entry los van bestaande vervangersflow
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS enable_replacement_name_entry boolean NOT NULL DEFAULT false;

-- 2) Attendance velden voor vervangernaam-flow
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS replacement_name text,
  ADD COLUMN IF NOT EXISTS replacement_set_by_player_id integer REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_set_at timestamptz;

-- 3) Auditlog uitbreiden met replacement velden
ALTER TABLE public.attendance_log
  ADD COLUMN IF NOT EXISTS is_substitute boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replacement_name text,
  ADD COLUMN IF NOT EXISTS replacement_set_by_player_id integer REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_set_at timestamptz;

-- 4) Triggerfunctie uitbreiden zodat replacement metadata altijd wordt gelogd
CREATE OR REPLACE FUNCTION log_attendance_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO attendance_log (
    player_id,
    game_id,
    old_status,
    new_status,
    changed_by,
    is_substitute,
    replacement_name,
    replacement_set_by_player_id,
    replacement_set_at
  )
  VALUES (
    NEW.player_id,
    NEW.game_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    auth.uid(),
    COALESCE(NEW.is_substitute, false),
    NEW.replacement_name,
    NEW.replacement_set_by_player_id,
    NEW.replacement_set_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
