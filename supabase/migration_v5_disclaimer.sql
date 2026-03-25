-- Migration v5: Add disclaimer_accepted column to players
-- Run this AFTER migration_v4_teamadmin.sql

ALTER TABLE players ADD COLUMN IF NOT EXISTS disclaimer_accepted boolean DEFAULT false;
