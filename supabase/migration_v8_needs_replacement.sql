-- Migration v8: Vervanger-vlag op attendance
-- Voer dit uit in de Supabase SQL Editor

-- 1. Kolom toevoegen
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS needs_replacement BOOLEAN NOT NULL DEFAULT false;
