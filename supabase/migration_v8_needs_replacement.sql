-- Migration v8: Vervanger-vlag op attendance + audit log uitbreiding
-- Voer dit uit in de Supabase SQL Editor

-- 1. Kolommen toevoegen op attendance
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS needs_replacement BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN NOT NULL DEFAULT false;

-- 2. Kolom toevoegen op attendance_log
ALTER TABLE attendance_log ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN NOT NULL DEFAULT false;

-- 3. Trigger functie updaten zodat is_substitute wordt gelogd
CREATE OR REPLACE FUNCTION log_attendance_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO attendance_log (player_id, game_id, old_status, new_status, changed_by, is_substitute)
  VALUES (
    NEW.player_id,
    NEW.game_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    auth.uid(),
    NEW.is_substitute
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
