-- ================================================
-- V3: Multi-team support
-- ================================================
-- Run this in the Supabase SQL Editor

-- Player-team junction table
create table if not exists player_teams (
  player_id integer not null references players(id) on delete cascade,
  team_id text not null,
  primary key (player_id, team_id)
);

alter table player_teams enable row level security;

-- Everyone authenticated can see team memberships
drop policy if exists "player_teams_select" on player_teams;
create policy "player_teams_select" on player_teams
  for select using (auth.role() = 'authenticated');

-- Ensure referenced players exist before creating team memberships
insert into players (id, name, role, username, must_change_password)
values
  (13, 'Ceriel Franken', 'speler', 'ceriel.franken', true),
  (14, 'HP Harmsen', 'speler', 'hp.harmsen', true)
on conflict (id) do update
set
  name = excluded.name,
  role = excluded.role,
  username = excluded.username;

-- Seed: all existing players belong to MS-1
insert into player_teams (player_id, team_id)
select id, 'ms1' from players where id <= 12
on conflict (player_id, team_id) do nothing;

-- Ceriel Franken (id=13) belongs to MS-3
insert into player_teams (player_id, team_id)
values (13, 'ms3')
on conflict (player_id, team_id) do nothing;

-- HP Harmsen (id=14) belongs to MS-1
insert into player_teams (player_id, team_id)
values (14, 'ms1')
on conflict (player_id, team_id) do nothing;
