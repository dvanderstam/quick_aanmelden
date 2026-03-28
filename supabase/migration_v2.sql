-- ================================================
-- Migration V2: Username-based login
-- Run this AFTER the original migration.sql
-- ================================================

-- Add username column
alter table players add column if not exists username text unique;

-- Set usernames for existing players
update players set username = 'daniel2'       where id = 1;


-- Make username required going forward
alter table players alter column username set not null;

-- Add must_change_password flag (true by default for all existing players)
alter table players add column if not exists must_change_password boolean not null default true;

-- Allow authenticated users to update their own must_change_password flag
create policy "players_update_own_password_flag" on players
  for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Allow anonymous users to look up a player by username (needed for register screen)
-- Drop old anon policy if it exists, then create new one
drop policy if exists "players_select_unclaimed_anon" on players;
create policy "players_select_unclaimed_anon" on players
  for select using (auth_user_id is null);
