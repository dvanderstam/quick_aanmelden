-- ================================================
-- Quick Amsterdam MS-1 - Wedstrijd Aanmeld App
-- Supabase Database Migration
-- ================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- ================================================
-- Tables
-- ================================================

create table players (
  id integer primary key,
  name text not null,
  role text not null default 'speler' check (role in ('admin', 'speler')),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table attendance (
  id bigint generated always as identity primary key,
  game_id text not null,
  player_id integer not null references players(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'uncertain')),
  updated_at timestamptz default now(),
  unique(game_id, player_id)
);

-- ================================================
-- Row Level Security
-- ================================================

alter table players enable row level security;
alter table attendance enable row level security;

-- Players: all authenticated users can view
create policy "players_select" on players
  for select using (auth.role() = 'authenticated');

-- Players: anyone (including anonymous) can view unclaimed players (needed for register page)
create policy "players_select_unclaimed_anon" on players
  for select using (auth_user_id is null);

-- Players: users can claim an unclaimed player (set auth_user_id to own ID)
create policy "players_claim" on players
  for update
  using (auth_user_id is null)
  with check (auth_user_id = auth.uid());

-- Attendance: all authenticated users can view
create policy "attendance_select" on attendance
  for select using (auth.role() = 'authenticated');

-- Attendance: players can insert their own
create policy "attendance_insert_own" on attendance
  for insert with check (
    player_id in (select id from players where auth_user_id = auth.uid())
  );

-- Attendance: players can update their own
create policy "attendance_update_own" on attendance
  for update using (
    player_id in (select id from players where auth_user_id = auth.uid())
  );

-- Attendance: players can delete their own
create policy "attendance_delete_own" on attendance
  for delete using (
    player_id in (select id from players where auth_user_id = auth.uid())
  );

-- Attendance: admins can insert any
create policy "attendance_insert_admin" on attendance
  for insert with check (
    exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin')
  );

-- Attendance: admins can update any
create policy "attendance_update_admin" on attendance
  for update using (
    exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin')
  );

-- Attendance: admins can delete any
create policy "attendance_delete_admin" on attendance
  for delete using (
    exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin')
  );

-- ================================================
-- Seed Players
-- ================================================

insert into players (id, name, role) values
  (1,  'René Bos',         'speler'),
  (2,  'Viktor Clerc',     'speler'),
  (3,  'Bas de Jong',      'admin'),
  (4,  'Geert v''t Land',  'speler'),
  (5,  'Onno Mets',        'speler'),
  (6,  'Olaf van Reeden',  'speler'),
  (7,  'Wim Rieff',        'speler'),
  (8,  'Ramses Serno',     'speler'),
  (9,  'Dave Spoelstra',   'speler'),
  (10, 'Daniël v/d Stam',  'admin'),
  (11, 'Barry Vis',        'speler'),
  (12, 'Ralf Vis',         'speler');
