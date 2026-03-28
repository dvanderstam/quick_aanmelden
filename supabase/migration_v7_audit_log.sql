-- Migration v7: Audit log voor attendance wijzigingen
-- Voer dit uit in de Supabase SQL Editor

-- 1. Maak de audit log tabel
CREATE TABLE IF NOT EXISTS attendance_log (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  game_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index voor snel opvragen per wedstrijd
CREATE INDEX idx_attendance_log_game ON attendance_log(game_id, changed_at DESC);

-- 3. Index voor snel opvragen per speler
CREATE INDEX idx_attendance_log_player ON attendance_log(player_id, changed_at DESC);

-- 4. Trigger functie die bij elke INSERT/UPDATE op attendance een log regel schrijft
CREATE OR REPLACE FUNCTION log_attendance_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO attendance_log (player_id, game_id, old_status, new_status, changed_by)
  VALUES (
    NEW.player_id,
    NEW.game_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger op de attendance tabel
DROP TRIGGER IF EXISTS trg_attendance_log ON attendance;
CREATE TRIGGER trg_attendance_log
  AFTER INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION log_attendance_change();

-- 6. RLS inschakelen (alleen lezen voor ingelogde gebruikers)
ALTER TABLE attendance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ingelogde gebruikers kunnen log lezen"
  ON attendance_log FOR SELECT
  TO authenticated
  USING (true);

-- Niemand kan handmatig inserteren/updaten/deleten via de API
-- (alleen de trigger kan schrijven dankzij SECURITY DEFINER)
