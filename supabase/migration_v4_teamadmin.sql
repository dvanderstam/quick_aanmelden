-- ================================================
-- V4: teamAdmin role for Bas de Jong
-- ================================================
-- Run this in the Supabase SQL Editor

-- Update the role check constraint to allow 'teamAdmin'
ALTER TABLE players DROP CONSTRAINT players_role_check;
ALTER TABLE players ADD CONSTRAINT players_role_check
  CHECK (role IN ('admin', 'teamAdmin', 'speler'));

-- Change Bas de Jong from admin to teamAdmin
UPDATE players SET role = 'teamAdmin' WHERE id = 3;
